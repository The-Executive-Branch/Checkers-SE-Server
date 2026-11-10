import { it, expect } from "vitest";
import type { CheckerColor, CheckerPiece, GameId, Player, Position } from "checkers-shared-types";
import CheckerBoard from "../../src/models/checkerboard.ts";
import Game, { GameError, GameErrorCode } from "../../src/models/game.ts";
import { FINISHED_GAME_MOVES, FINISHED_GAME_WINNER } from "../fixtures/finishedGame.ts";

const RAVAE: Player = { kind: "user", username: "ravae" };
const BLAKE: Player = { kind: "user", username: "blake" };
const GUEST: Player = { kind: "guest", name: "Sam" };
const GAME_ID = "game-1" as GameId;

const piece = (
  color: CheckerColor,
  { row, col }: Position,
  isKing = false,
): CheckerPiece => ({ id: `${color}-${row}-${col}`, color, isKing, row, col });

const boardWith = (...pieces: CheckerPiece[]) => {
  const board = new CheckerBoard(8, { empty: true });
  pieces.forEach((p) => board.placeCheckerPiece(p));
  return board;
};

const onlineGame = (board?: CheckerBoard) =>
  new Game({ id: GAME_ID, mode: "online", red: RAVAE, black: BLAKE, board });

it("starts an online game waiting, with the creator as red and an empty black seat", () => {
  // Arrange
  const game = new Game({ id: GAME_ID, mode: "online", red: RAVAE });
  // Act
  const state = game.toGameState("red");
  // Assert
  expect(state.players).toEqual({ red: RAVAE, black: null });
  expect(state.status).toEqual({ state: "waiting" });
  expect(state.pieces).toHaveLength(24);
  expect(game.getHistory()).toEqual([]);
});

it("fills the black seat once and starts the game", () => {
  // Arrange
  const game = new Game({ id: GAME_ID, mode: "online", red: RAVAE });
  // Act
  game.seatBlack(BLAKE);
  // Assert
  expect(game.getPlayers().black).toEqual(BLAKE);
  expect(game.getStatus()).toEqual({ state: "inProgress" });
  expect(() => game.seatBlack(GUEST)).toThrow(GameError);
  expect(() => game.seatBlack(GUEST)).toThrow(
    expect.objectContaining({ code: GameErrorCode.SeatTaken }),
  );
});

it("applies a legal move and passes the turn", () => {
  // Arrange
  const game = onlineGame();
  // Act
  const outcome = game.applyMove("red", { row: 5, col: 0 }, { row: 4, col: 1 });
  // Assert
  expect(outcome.ok).toBe(true);
  expect(game.getTurn()).toBe("black");
  expect(game.toGameState("red").pieces).toContainEqual(
    expect.objectContaining({ id: "red-5-0", row: 4, col: 1 }),
  );
});

it.each([
  { name: "out of turn", color: "black" as const, from: { row: 2, col: 1 }, to: { row: 3, col: 0 } },
  { name: "illegal", color: "red" as const, from: { row: 5, col: 0 }, to: { row: 3, col: 2 } },
])("rejects an $name move and leaves the game unchanged", ({ color, from, to }) => {
  // Arrange
  const game = onlineGame();
  const before = game.toGameState("red");
  // Act
  const outcome = game.applyMove(color, from, to);
  // Assert
  expect(outcome.ok).toBe(false);
  expect(game.toGameState("red")).toEqual(before);
  expect(game.getHistory()).toEqual([]);
});

it("does not allow moves while waiting for an opponent", () => {
  // Arrange
  const game = new Game({ id: GAME_ID, mode: "online", red: RAVAE });
  // Act
  const outcome = game.applyMove("red", { row: 5, col: 0 }, { row: 4, col: 1 });
  // Assert
  expect(outcome).toEqual({ ok: false, reason: "The game is not in progress." });
});

it("removes a captured piece and records its ID", () => {
  // Arrange
  const game = onlineGame(
    boardWith(
      piece("red", { row: 5, col: 2 }),
      piece("black", { row: 4, col: 3 }),
      piece("black", { row: 0, col: 7 }), // keeps black in the game
    ),
  );
  // Act
  const outcome = game.applyMove("red", { row: 5, col: 2 }, { row: 3, col: 4 });
  // Assert
  if (!outcome.ok) throw new Error(outcome.reason);
  expect(outcome.record.capturedIds).toEqual(["black-4-3"]);
  expect(game.toGameState("red").pieces.map((p) => p.id)).not.toContain("black-4-3");
});

it("keeps the turn and requires the same piece to keep jumping", () => {
  // Arrange: red jumps (5,2) over (4,3) to (3,4), then can jump (2,5) to (1,6).
  const game = onlineGame(
    boardWith(
      piece("red", { row: 5, col: 2 }),
      piece("black", { row: 4, col: 3 }),
      piece("black", { row: 2, col: 5 }),
      piece("black", { row: 0, col: 1 }),
    ),
  );
  // Act
  game.applyMove("red", { row: 5, col: 2 }, { row: 3, col: 4 });
  // Assert
  expect(game.getTurn()).toBe("red");
  expect(game.getMustJumpFrom()).toEqual({ row: 3, col: 4 });

  // A different move while a jump is pending is rejected.
  const wrongPiece = game.applyMove("red", { row: 3, col: 4 }, { row: 2, col: 3 });
  expect(wrongPiece.ok).toBe(false);

  // Finishing the jump passes the turn.
  const finish = game.applyMove("red", { row: 3, col: 4 }, { row: 1, col: 6 });
  expect(finish.ok).toBe(true);
  expect(game.getTurn()).toBe("black");
  expect(game.getMustJumpFrom()).toBeNull();
});

it("crowns a piece that reaches the far row and ends the turn", () => {
  // Arrange: after crowning at (0,3), the new king could jump (1,4),
  // but crowning ends the turn.
  const game = onlineGame(
    boardWith(
      piece("red", { row: 2, col: 1 }),
      piece("black", { row: 1, col: 2 }),
      piece("black", { row: 1, col: 4 }),
    ),
  );
  // Act
  const outcome = game.applyMove("red", { row: 2, col: 1 }, { row: 0, col: 3 });
  // Assert
  if (!outcome.ok) throw new Error(outcome.reason);
  expect(outcome.record.crownedId).toBe("red-2-1");
  expect(game.getTurn()).toBe("black");
  expect(game.getMustJumpFrom()).toBeNull();
  expect(game.toGameState("red").pieces).toContainEqual(
    expect.objectContaining({ id: "red-2-1", isKing: true }),
  );
});

it("finishes the game when the last opponent piece is captured", () => {
  // Arrange
  const game = onlineGame(
    boardWith(piece("red", { row: 5, col: 2 }), piece("black", { row: 4, col: 3 })),
  );
  // Act
  game.applyMove("red", { row: 5, col: 2 }, { row: 3, col: 4 });
  // Assert
  expect(game.getStatus()).toEqual({ state: "finished", winner: "red" });
});

it("records moves in order, and the returned history can't change the game", () => {
  // Arrange
  const game = onlineGame();
  game.applyMove("red", { row: 5, col: 0 }, { row: 4, col: 1 });
  game.applyMove("black", { row: 2, col: 1 }, { row: 3, col: 0 });
  // Act
  const history = game.getHistory();
  history.pop();
  // Assert
  expect(game.getHistory().map((m) => m.color)).toEqual(["red", "black"]);
});

it("builds a snapshot for each viewer of an online game", () => {
  // Arrange
  const game = onlineGame();
  // Act
  const forRed = game.toGameState("red");
  const forBlack = game.toGameState("black");
  // Assert
  expect(forRed.playerColor).toBe("red");
  expect(forBlack.playerColor).toBe("black");
  expect(forRed.players).toEqual({ red: RAVAE, black: BLAKE });
  expect(forRed.pieces).toEqual(forBlack.pieces);
});

it("builds a local snapshot with a guest and both colors", () => {
  // Arrange
  const game = new Game({ id: GAME_ID, mode: "local", red: RAVAE, black: GUEST });
  // Act
  const state = game.toGameState("red");
  // Assert
  expect(state.playerColor).toBe("both");
  expect(state.players.black).toEqual(GUEST);
  expect(state.status).toEqual({ state: "inProgress" });
});

it("builds a move result with the next turn and any must-jump square", () => {
  // Arrange
  const game = onlineGame();
  // Act
  const outcome = game.applyMove("red", { row: 5, col: 0 }, { row: 4, col: 1 });
  if (!outcome.ok) throw new Error(outcome.reason);
  const message = game.toMoveResult(outcome.record);
  // Assert
  expect(message).toEqual({
    type: "moveResult",
    gameId: GAME_ID,
    from: { row: 5, col: 0 },
    to: { row: 4, col: 1 },
    capturedIds: [],
    kingId: undefined,
    nextPlayerTurn: "black",
    jumpFrom: undefined,
    status: { state: "inProgress" },
  });
});

// ── Saving finished games ──────────────────────────────────

const playToTheEnd = (game: Game) => {
  for (const { from, to } of FINISHED_GAME_MOVES) {
    const outcome = game.applyMove(game.getTurn(), from, to);
    if (!outcome.ok) throw new Error(outcome.reason);
  }
};

it("has no record to save while the game is still going", () => {
  // Arrange
  const game = onlineGame();
  // Act
  game.applyMove("red", { row: 5, col: 0 }, { row: 4, col: 1 });
  // Assert
  expect(game.toGameRecord()).toBeNull();
});

it("builds a record of a finished game with every move", () => {
  // Arrange
  const game = onlineGame();
  // Act
  playToTheEnd(game);
  const record = game.toGameRecord();
  // Assert
  expect(record).toMatchObject({
    gameId: GAME_ID,
    players: { red: RAVAE, black: BLAKE },
    winner: FINISHED_GAME_WINNER,
  });
  expect(record!.moves).toHaveLength(FINISHED_GAME_MOVES.length);
});

it("saves each move the same way moveResult sends it, without empty fields", () => {
  // Arrange
  const game = onlineGame();
  // Act
  playToTheEnd(game);
  const moves = game.toGameRecord()!.moves;
  // Assert
  expect(moves[0]).toEqual({
    from: FINISHED_GAME_MOVES[0].from,
    to: FINISHED_GAME_MOVES[0].to,
    nextPlayerTurn: "black",
  });
  expect(moves.some((m) => m.capturedIds && m.capturedIds.length > 0)).toBe(true);
  expect(moves.some((m) => m.kingId)).toBe(true);
  expect(moves.some((m) => m.jumpFrom)).toBe(true);
});
