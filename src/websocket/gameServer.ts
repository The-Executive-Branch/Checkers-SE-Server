import { randomUUID } from "node:crypto";
import type {
  CheckerColor,
  ClientMessage,
  GameId,
  GameRecord,
  Player,
  ServerMessage,
} from "checkers-shared-types";
import Game from "../models/game.ts";
import {
  isClientMessageType,
  parseClientMessage,
} from "./parseClientMessage.ts";

// One open WebSocket connection, as the game server sees it.
// server.ts adapts a real socket to this shape, and tests use fakes.
export type Client = {
  send: (message: ServerMessage) => void;
  close: (code: number, reason: string) => void;
};

export type Account = { userId: string; username: string };
export type FindAccount = (sessionId: string) => Promise<Account | null>;
export type SaveRecord = (record: GameRecord) => Promise<void>;

export const CLOSE_CODES = {
  UNAUTHORIZED: 4401,
} as const;

type Lobby = {
  game: Game;
  isPublic: boolean;
  invitedUsername: string | null;
  watchers: Set<Client>;
};

type CreateGame = Extract<ClientMessage, { type: "createGame" }>;

export default class GameServer {
  private accounts = new Map<Client, Account>();
  private online = new Map<string, Client>(); // username → latest connection
  private lobbies = new Map<GameId, Lobby>();
  private readonly findAccount: FindAccount;
  private readonly createGameId: () => GameId;
  private readonly saveRecord: SaveRecord;

  // saveRecord stores finished games. It's passed in (index.ts gives it
  // saveGameRecord) so this class never talks to the database itself,
  // and tests can check what was saved without one.
  constructor(
    findAccount: FindAccount,
    createGameId: () => GameId = () => randomUUID() as GameId,
    saveRecord: SaveRecord = async () => {},
  ) {
    this.findAccount = findAccount;
    this.createGameId = createGameId;
    this.saveRecord = saveRecord;
  }

  async handleMessage(client: Client, raw: string): Promise<void> {
    const message = parseClientMessage(raw);
    const account = this.accounts.get(client);

    // The first message on a connection must sign the player in.
    if (!account) {
      if (message?.type !== "authenticate") {
        client.close(CLOSE_CODES.UNAUTHORIZED, "Sign in first.");
        return;
      }
      await this.authenticate(client, message.sessionId);
      return;
    }

    if (!message) {
      this.rejectMalformed(client, raw);
      return;
    }

    switch (message.type) {
      case "authenticate":
        return this.sendError(client, "authenticate", "Already signed in.");
      case "createGame":
        return this.createGame(client, account, message);
      case "join":
        return this.join(client, account, message.gameId);
      case "declineInvite":
        return this.declineInvite(client, account, message.gameId);
      case "listOpenGames":
        return this.listOpenGames(client);
      case "move":
        return this.move(client, account, message);
    }
  }

  disconnect(client: Client): void {
    const account = this.accounts.get(client);
    this.accounts.delete(client);
    if (account && this.online.get(account.username) === client)
      this.online.delete(account.username);
    // The games stay, so the player can rejoin and get a fresh snapshot.
    this.lobbies.forEach((lobby) => lobby.watchers.delete(client));
  }

  // ── Signing in ───────────────────────────────────────────

  private async authenticate(client: Client, sessionId: string) {
    const account = await this.findAccount(sessionId);
    if (!account) {
      client.close(CLOSE_CODES.UNAUTHORIZED, "Session is not valid.");
      return;
    }
    this.accounts.set(client, account);
    this.online.set(account.username, client);
    client.send({ type: "authenticated", ...account });
  }

  // ── Creating and joining ─────────────────────────────────

  private createGame(client: Client, account: Account, { mode }: CreateGame) {
    const red: Player = { kind: "user", username: account.username };
    const id = this.createGameId();

    if (mode.type === "local") {
      const game = new Game({
        id,
        mode: "local",
        red,
        black: { kind: "guest", name: mode.guestName },
      });
      this.openLobby(game, client, { isPublic: false, invitedUsername: null });
      client.send(game.toGameState("red"));
      return;
    }

    if (mode.isPrivate) {
      const opponent = mode.opponentUsername;
      if (opponent === account.username)
        return this.sendError(client, "createGame", "You can't invite yourself.");
      const opponentClient = this.online.get(opponent);
      if (!opponentClient)
        return this.sendError(client, "createGame", `${opponent} isn't online.`);

      const game = new Game({ id, mode: "online", red });
      this.openLobby(game, client, { isPublic: false, invitedUsername: opponent });
      client.send(game.toGameState("red"));
      opponentClient.send({
        type: "gameInvite",
        gameId: id,
        fromUsername: account.username,
      });
      return;
    }

    const game = new Game({ id, mode: "online", red });
    this.openLobby(game, client, { isPublic: true, invitedUsername: null });
    client.send(game.toGameState("red"));
  }

  private join(client: Client, account: Account, gameId: GameId) {
    const lobby = this.lobbies.get(gameId);
    if (!lobby) return this.sendError(client, "join", "That game doesn't exist.", gameId);

    const { game } = lobby;
    const seat = this.seatOf(game, account.username);

    // Already in the game: rejoin with a fresh snapshot.
    if (seat) {
      lobby.watchers.add(client);
      client.send(game.toGameState(seat));
      return;
    }

    const isOpenSeat =
      game.mode === "online" &&
      game.getPlayers().black === null &&
      (lobby.isPublic || lobby.invitedUsername === account.username);
    if (!isOpenSeat)
      return this.sendError(client, "join", "You can't join that game.", gameId);

    game.seatBlack({ kind: "user", username: account.username });
    lobby.invitedUsername = null;
    lobby.watchers.add(client);
    this.broadcastState(lobby);
  }

  private declineInvite(client: Client, account: Account, gameId: GameId) {
    const lobby = this.lobbies.get(gameId);
    if (!lobby || lobby.invitedUsername !== account.username)
      return this.sendError(client, "declineInvite", "There's no invite for that game.", gameId);

    this.lobbies.delete(gameId);
    lobby.watchers.forEach((watcher) =>
      watcher.send({ type: "inviteDeclined", gameId, byUsername: account.username }),
    );
  }

  private listOpenGames(client: Client) {
    const games = [...this.lobbies.values()]
      .filter(
        ({ game, isPublic }) =>
          isPublic && game.getPlayers().black === null,
      )
      .map(({ game }) => {
        const red = game.getPlayers().red;
        return {
          gameId: game.id,
          hostUsername: red.kind === "user" ? red.username : red.name,
          createdAt: game.createdAt.toISOString(),
        };
      });
    client.send({ type: "openGames", games });
  }

  // ── Playing ──────────────────────────────────────────────

  private move(
    client: Client,
    account: Account,
    { gameId, from, to }: Extract<ClientMessage, { type: "move" }>,
  ) {
    const lobby = this.lobbies.get(gameId);
    const seat = lobby ? this.seatOf(lobby.game, account.username) : null;
    if (!lobby || !seat) {
      client.send({ type: "moveRejected", gameId, from, to, reason: "You aren't playing in that game." });
      return;
    }

    const { game } = lobby;
    // In a local game, one connection plays whichever side is to move.
    const color = game.mode === "local" ? game.getTurn() : seat;
    const outcome = game.applyMove(color, from, to);

    if (!outcome.ok) {
      client.send({ type: "moveRejected", gameId, from, to, reason: outcome.reason });
      return;
    }

    const result = game.toMoveResult(outcome.record);
    lobby.watchers.forEach((watcher) => watcher.send(result));

    if (game.getStatus().state === "finished") this.finishGame(lobby);
  }

  // Saves the finished game and forgets it. Players keep the final board
  // on screen; the server has nothing left to do with it. A failed save is
  // logged, not sent to the players: the game itself still ended properly.
  private finishGame({ game }: Lobby) {
    this.lobbies.delete(game.id);
    const record = game.toGameRecord();
    if (!record) return;
    this.saveRecord(record).catch((error) => {
      console.error("Couldn't save finished game", game.id, error);
    });
  }

  // ── Helpers ──────────────────────────────────────────────

  private openLobby(
    game: Game,
    creator: Client,
    { isPublic, invitedUsername }: { isPublic: boolean; invitedUsername: string | null },
  ) {
    this.lobbies.set(game.id, {
      game,
      isPublic,
      invitedUsername,
      watchers: new Set([creator]),
    });
  }

  // Which color this user plays in the game, if any.
  private seatOf(game: Game, username: string): CheckerColor | null {
    const { red, black } = game.getPlayers();
    if (red.kind === "user" && red.username === username) return "red";
    if (black?.kind === "user" && black.username === username) return "black";
    return null;
  }

  // Sends each watcher the snapshot from their own seat.
  private broadcastState(lobby: Lobby) {
    lobby.watchers.forEach((watcher) => {
      const account = this.accounts.get(watcher);
      const seat = account ? this.seatOf(lobby.game, account.username) : null;
      if (seat) watcher.send(lobby.game.toGameState(seat));
    });
  }

  private rejectMalformed(client: Client, raw: string) {
    let type: unknown;
    try {
      type = JSON.parse(raw)?.type;
    } catch {
      type = undefined;
    }
    // Only a known request type can be named in an error. Anything else is ignored.
    if (isClientMessageType(type))
      this.sendError(client, type, "That request is missing or has invalid fields.");
  }

  private sendError(
    client: Client,
    requestType: ClientMessage["type"],
    reason: string,
    gameId?: GameId,
  ) {
    client.send({ type: "error", requestType, reason, gameId });
  }
}
