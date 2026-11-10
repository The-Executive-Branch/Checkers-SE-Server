import type {
  CheckerColor,
  GameId,
  GameStatus,
  Player,
  Position,
  ServerMessage,
} from "checkers-shared-types";
import CheckerBoard from "./checkerboard.ts";
import type { CheckerRules } from "../rules/interface.ts";
import { AmericanCheckersRules } from "../rules/americanCheckersRules.ts";

export type GameMode = "online" | "local";

export type MoveRecord = {
  color: CheckerColor;
  from: Position;
  to: Position;
  capturedIds: string[];
  crownedId?: string;
  at: Date;
};

export type MoveOutcome =
  | { ok: true; record: MoveRecord }
  | { ok: false; reason: string };

export const GameErrorCode = {
  SeatTaken: "That seat is already taken.",
} as const;

export type GameErrorCode = (typeof GameErrorCode)[keyof typeof GameErrorCode];

export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode) {
    super(code);
    this.code = code;
    this.name = "GameError";
  }
}

type GameOptions = {
  id: GameId;
  mode: GameMode;
  red: Player;
  black?: Player | null;
  board?: CheckerBoard;
  rules?: CheckerRules;
};

type GameStateMessage = Extract<ServerMessage, { type: "gameState" }>;
type MoveResultMessage = Extract<ServerMessage, { type: "moveResult" }>;

const opponentOf = (color: CheckerColor): CheckerColor =>
  color === "red" ? "black" : "red";

export default class Game {
  readonly id: GameId;
  readonly mode: GameMode;
  readonly createdAt = new Date();
  private readonly board: CheckerBoard;
  private readonly rules: CheckerRules;
  private players: { red: Player; black: Player | null };
  private turn: CheckerColor = "red";
  private status: GameStatus;
  private mustJumpFrom: Position | null = null;
  private history: MoveRecord[] = [];

  constructor({ id, mode, red, black = null, board, rules }: GameOptions) {
    this.id = id;
    this.mode = mode;
    this.board = board ?? new CheckerBoard();
    this.rules = rules ?? new AmericanCheckersRules();
    this.players = { red, black };
    this.status = black ? { state: "inProgress" } : { state: "waiting" };
  }

  getPlayers() {
    return { ...this.players };
  }

  getTurn(): CheckerColor {
    return this.turn;
  }

  getStatus(): GameStatus {
    return this.status;
  }

  getMustJumpFrom(): Position | null {
    return this.mustJumpFrom;
  }

  // A copy, so code outside the class can't change the game's history.
  getHistory(): MoveRecord[] {
    return [...this.history];
  }

  seatBlack(player: Player): void {
    if (this.players.black) throw new GameError(GameErrorCode.SeatTaken);
    this.players.black = player;
    this.status = { state: "inProgress" };
  }

  // Applies a move for the given color if the rules allow it.
  // An illegal move is a normal outcome (a player's mistake), so it is
  // returned instead of thrown.
  applyMove(color: CheckerColor, from: Position, to: Position): MoveOutcome {
    if (this.status.state !== "inProgress")
      return { ok: false, reason: "The game is not in progress." };
    if (color !== this.turn)
      return { ok: false, reason: "It is not your turn." };

    const move = this.rules.findLegalMove(
      this.board,
      color,
      from,
      to,
      this.mustJumpFrom ?? undefined,
    );
    if (!move) return { ok: false, reason: "That move isn't allowed." };

    const moving = this.board.getPiece(from)!;
    const capturedIds = move.captured.map((p) => this.board.getPiece(p)!.id);

    this.board.moveCheckerPiece(move.from, move.to);
    move.captured.forEach((p) => this.board.removeCheckerPiece(p));
    if (move.crowns) this.board.crownCheckerPiece(move.to);

    // A capture can continue with the same piece, unless the piece was
    // just crowned: in American checkers, crowning ends the turn.
    const canContinue =
      move.captured.length > 0 &&
      !move.crowns &&
      this.rules.getLegalMoves(this.board, color, move.to).length > 0;

    if (canContinue) {
      this.mustJumpFrom = move.to;
    } else {
      this.mustJumpFrom = null;
      this.turn = opponentOf(color);
    }

    this.status = this.rules.getGameStatus(this.board, this.turn);

    const record: MoveRecord = {
      color,
      from: move.from,
      to: move.to,
      capturedIds,
      crownedId: move.crowns ? moving.id : undefined,
      at: new Date(),
    };
    this.history.push(record);
    return { ok: true, record };
  }

  // Builds the snapshot for one viewer. In a local game, one connection
  // plays both sides, so playerColor is "both".
  toGameState(viewer: CheckerColor): GameStateMessage {
    return {
      type: "gameState",
      gameId: this.id,
      pieces: this.board.getActiveCheckerPieces().map((p) => ({ ...p })),
      playerTurn: this.turn,
      playerColor: this.mode === "local" ? "both" : viewer,
      status: this.status,
      mode: this.mode,
      players: this.getPlayers(),
    };
  }

  toMoveResult(record: MoveRecord): MoveResultMessage {
    return {
      type: "moveResult",
      gameId: this.id,
      from: record.from,
      to: record.to,
      capturedIds: record.capturedIds,
      kingId: record.crownedId,
      nextPlayerTurn: this.turn,
      jumpFrom: this.mustJumpFrom ?? undefined,
      status: this.status,
    };
  }
}
