import { it, expect, beforeEach, vi } from "vitest";
import type { GameId, GameRecord, ServerMessage } from "checkers-shared-types";
import GameServer, { CLOSE_CODES, type Account, type Client } from "../../src/websocket/gameServer.ts";
import { FINISHED_GAME_MOVES, FINISHED_GAME_WINNER } from "../fixtures/finishedGame.ts";

const ACCOUNTS: Record<string, Account> = {
  "session-ravae": { userId: "u1", username: "ravae" },
  "session-blake": { userId: "u2", username: "blake" },
  "session-joe": { userId: "u3", username: "joe" },
};

type FakeClient = Client & { received: ServerMessage[]; closedWith: number | null };

const fakeClient = (): FakeClient => {
  const client: FakeClient = {
    received: [],
    closedWith: null,
    send: (message) => client.received.push(message),
    close: (code) => {
      client.closedWith = code;
    },
  };
  return client;
};

const last = (client: FakeClient) => client.received.at(-1)!;
const ofType = <T extends ServerMessage["type"]>(client: FakeClient, type: T) =>
  client.received.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

let server: GameServer;
let nextId: number;
let saved: GameRecord[];

beforeEach(() => {
  nextId = 0;
  saved = [];
  server = new GameServer(
    async (sessionId) => ACCOUNTS[sessionId] ?? null,
    () => `game-${++nextId}` as GameId,
    async (record) => {
      saved.push(record);
    },
  );
});

const send = (client: Client, message: object) =>
  server.handleMessage(client, JSON.stringify(message));

const signedIn = async (sessionId: string) => {
  const client = fakeClient();
  await send(client, { type: "authenticate", sessionId });
  return client;
};

// ── Signing in ─────────────────────────────────────────────

it("signs a player in with a valid session", async () => {
  // Act
  const client = await signedIn("session-ravae");
  // Assert
  expect(last(client)).toEqual({ type: "authenticated", userId: "u1", username: "ravae" });
});

it("closes the connection for an invalid session", async () => {
  // Act
  const client = await signedIn("not-a-session");
  // Assert
  expect(client.closedWith).toBe(CLOSE_CODES.UNAUTHORIZED);
  expect(client.received).toEqual([]);
});

it("closes the connection when the first message isn't authenticate", async () => {
  // Arrange
  const client = fakeClient();
  // Act
  await send(client, { type: "listOpenGames" });
  // Assert
  expect(client.closedWith).toBe(CLOSE_CODES.UNAUTHORIZED);
});

it("answers a malformed request with an error and keeps the connection open", async () => {
  // Arrange
  const client = await signedIn("session-ravae");
  // Act
  await send(client, { type: "move", gameId: "game-1" }); // missing from and to
  // Assert
  expect(last(client)).toMatchObject({ type: "error", requestType: "move" });
  expect(client.closedWith).toBeNull();
});

// ── Local games ────────────────────────────────────────────

it("creates a local game with a guest, and one connection plays both sides", async () => {
  // Arrange
  const client = await signedIn("session-ravae");
  // Act
  await send(client, { type: "createGame", mode: { type: "local", guestName: "Sam" } });
  await send(client, { type: "move", gameId: "game-1", from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
  await send(client, { type: "move", gameId: "game-1", from: { row: 2, col: 1 }, to: { row: 3, col: 0 } });
  // Assert
  const [state] = ofType(client, "gameState");
  expect(state).toMatchObject({
    mode: "local",
    playerColor: "both",
    players: { red: { kind: "user", username: "ravae" }, black: { kind: "guest", name: "Sam" } },
    status: { state: "inProgress" },
  });
  const results = ofType(client, "moveResult");
  expect(results.map((r) => r.nextPlayerTurn)).toEqual(["black", "red"]);
});

// ── Public games ───────────────────────────────────────────

it("lists a public game until someone takes the open seat", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: false } });
  // Act
  await send(blake, { type: "listOpenGames" });
  const before = last(blake);
  await send(blake, { type: "join", gameId: "game-1" });
  await send(blake, { type: "listOpenGames" });
  const after = last(blake);
  // Assert
  expect(before).toMatchObject({ type: "openGames", games: [{ gameId: "game-1", hostUsername: "ravae" }] });
  expect(after).toEqual({ type: "openGames", games: [] });
});

it("starts the game for both players when the open seat is taken", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: false } });
  // Act
  await send(blake, { type: "join", gameId: "game-1" });
  // Assert
  expect(ofType(ravae, "gameState")[0]).toMatchObject({ status: { state: "waiting" }, playerColor: "red" });
  expect(last(ravae)).toMatchObject({ type: "gameState", status: { state: "inProgress" }, playerColor: "red" });
  expect(last(blake)).toMatchObject({ type: "gameState", status: { state: "inProgress" }, playerColor: "black" });
});

it("turns away a third player from a full game", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  const joe = await signedIn("session-joe");
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: false } });
  await send(blake, { type: "join", gameId: "game-1" });
  // Act
  await send(joe, { type: "join", gameId: "game-1" });
  // Assert
  expect(last(joe)).toMatchObject({ type: "error", requestType: "join", gameId: "game-1" });
});

// ── Private games and invites ──────────────────────────────

it("sends an invite to an online opponent", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  // Act
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: true, opponentUsername: "blake" } });
  // Assert
  expect(last(blake)).toEqual({ type: "gameInvite", gameId: "game-1", fromUsername: "ravae" });
});

it("reports an error when the invited opponent isn't online", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  // Act
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: true, opponentUsername: "blake" } });
  // Assert
  expect(last(ravae)).toMatchObject({ type: "error", requestType: "createGame" });
});

it("only lets the invited player take the seat in a private game", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  const joe = await signedIn("session-joe");
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: true, opponentUsername: "blake" } });
  // Act
  await send(joe, { type: "join", gameId: "game-1" });
  await send(blake, { type: "join", gameId: "game-1" });
  // Assert
  expect(last(joe)).toMatchObject({ type: "error", requestType: "join" });
  expect(last(blake)).toMatchObject({ type: "gameState", playerColor: "black" });
});

it("tells the creator when an invite is declined", async () => {
  // Arrange
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: true, opponentUsername: "blake" } });
  // Act
  await send(blake, { type: "declineInvite", gameId: "game-1" });
  // Assert
  expect(last(ravae)).toEqual({ type: "inviteDeclined", gameId: "game-1", byUsername: "blake" });
});

// ── Playing ────────────────────────────────────────────────

const startedGame = async () => {
  const ravae = await signedIn("session-ravae");
  const blake = await signedIn("session-blake");
  await send(ravae, { type: "createGame", mode: { type: "online", isPrivate: false } });
  await send(blake, { type: "join", gameId: "game-1" });
  return { ravae, blake };
};

it("sends a valid move's result to both players", async () => {
  // Arrange
  const { ravae, blake } = await startedGame();
  // Act
  await send(ravae, { type: "move", gameId: "game-1", from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
  // Assert
  expect(last(ravae)).toMatchObject({ type: "moveResult", nextPlayerTurn: "black" });
  expect(last(blake)).toEqual(last(ravae));
});

it("rejects a move out of turn only to the player who made it", async () => {
  // Arrange
  const { ravae, blake } = await startedGame();
  const ravaeCount = ravae.received.length;
  // Act
  await send(blake, { type: "move", gameId: "game-1", from: { row: 2, col: 1 }, to: { row: 3, col: 0 } });
  // Assert
  expect(last(blake)).toMatchObject({ type: "moveRejected", reason: "It is not your turn." });
  expect(ravae.received).toHaveLength(ravaeCount);
});

it("rejects a move from someone who isn't playing", async () => {
  // Arrange
  await startedGame();
  const joe = await signedIn("session-joe");
  // Act
  await send(joe, { type: "move", gameId: "game-1", from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
  // Assert
  expect(last(joe)).toMatchObject({ type: "moveRejected" });
});

it("gives a player who reconnects a fresh snapshot of the current game", async () => {
  // Arrange
  const { ravae } = await startedGame();
  await send(ravae, { type: "move", gameId: "game-1", from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
  server.disconnect(ravae);
  // Act
  const ravaeAgain = await signedIn("session-ravae");
  await send(ravaeAgain, { type: "join", gameId: "game-1" });
  // Assert
  const state = last(ravaeAgain);
  expect(state).toMatchObject({ type: "gameState", playerTurn: "black", playerColor: "red" });
  if (state.type !== "gameState") throw new Error("expected gameState");
  expect(state.pieces).toContainEqual(expect.objectContaining({ id: "red-5-0", row: 4, col: 1 }));
});

it("stops sending game updates to a disconnected connection", async () => {
  // Arrange
  const { ravae, blake } = await startedGame();
  server.disconnect(blake);
  const blakeCount = blake.received.length;
  // Act
  await send(ravae, { type: "move", gameId: "game-1", from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
  // Assert
  expect(blake.received).toHaveLength(blakeCount);
});

// ── Finishing games ────────────────────────────────────────

const playLocalGameToTheEnd = async () => {
  const client = await signedIn("session-ravae");
  await send(client, { type: "createGame", mode: { type: "local", guestName: "Sam" } });
  for (const { from, to } of FINISHED_GAME_MOVES) {
    await send(client, { type: "move", gameId: "game-1", from, to });
  }
  return client;
};

it("saves a game once when it finishes", async () => {
  // Act
  const client = await playLocalGameToTheEnd();
  // Assert
  expect(ofType(client, "moveRejected")).toEqual([]);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    gameId: "game-1",
    players: { red: { kind: "user", username: "ravae" }, black: { kind: "guest", name: "Sam" } },
    winner: FINISHED_GAME_WINNER,
  });
  expect(saved[0].moves).toHaveLength(FINISHED_GAME_MOVES.length);
});

it("tells the players the game is over before forgetting it", async () => {
  // Act
  const client = await playLocalGameToTheEnd();
  // Assert
  expect(ofType(client, "moveResult").at(-1)?.status).toEqual({
    state: "finished",
    winner: FINISHED_GAME_WINNER,
  });
});

it("rejects moves in a game that has finished", async () => {
  // Arrange
  const client = await playLocalGameToTheEnd();
  // Act
  await send(client, { type: "move", gameId: "game-1", from: { row: 5, col: 0 }, to: { row: 4, col: 1 } });
  // Assert
  expect(last(client)).toMatchObject({ type: "moveRejected", reason: "You aren't playing in that game." });
});

it("logs a failed save without crashing the game server", async () => {
  // Arrange
  const error = new Error("database is down");
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  server = new GameServer(
    async (sessionId) => ACCOUNTS[sessionId] ?? null,
    () => `game-${++nextId}` as GameId,
    async () => {
      throw error;
    },
  );
  // Act
  await playLocalGameToTheEnd();
  await Promise.resolve(); // let the failed save finish
  // Assert
  expect(logged).toHaveBeenCalledWith("Couldn't save finished game", "game-1", error);
  logged.mockRestore();
});
