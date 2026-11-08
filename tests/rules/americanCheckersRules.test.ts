import { it, expect } from "vitest";
import type {
  CheckerColor,
  CheckerPiece,
  Position,
} from "checkers-shared-types";
import CheckerBoard from "../../src/models/checkerboard.ts";
import { AmericanCheckersRules } from "../../src/rules/americanCheckersRules.ts";

const rules = new AmericanCheckersRules();

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

const destinations = (board: CheckerBoard, color: CheckerColor) =>
  rules.getLegalMoves(board, color).map((m) => m.to);

it("gives each color 7 moves from the starting position", () => {
  // Arrange
  const board = new CheckerBoard();
  // Act
  const redMoves = rules.getLegalMoves(board, "red");
  const blackMoves = rules.getLegalMoves(board, "black");
  // Assert
  expect(redMoves).toHaveLength(7);
  expect(blackMoves).toHaveLength(7);
  redMoves.forEach((m) => expect(m.from.row).toBe(5));
  blackMoves.forEach((m) => expect(m.from.row).toBe(2));
});

it("moves a regular red piece forward only", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 4, col: 3 }));
  // Act
  const moves = destinations(board, "red");
  // Assert
  expect(moves).toHaveLength(2);
  expect(moves).toEqual(
    expect.arrayContaining([
      { row: 3, col: 2 },
      { row: 3, col: 4 },
    ]),
  );
});

it("moves a king in all four directions", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 4, col: 3 }, true));
  // Act
  const moves = destinations(board, "red");
  // Assert
  expect(moves).toHaveLength(4);
  expect(moves).toEqual(
    expect.arrayContaining([
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 5, col: 2 },
      { row: 5, col: 4 },
    ]),
  );
});

it("keeps moves on the board at the edge", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 5, col: 0 }));
  // Act
  const moves = destinations(board, "red");
  // Assert
  expect(moves).toEqual([{ row: 4, col: 1 }]);
});

it.each(["red", "black"] as const)(
  "does not list a square blocked by a %s piece",
  (blocker) => {
    // Arrange
    const board = boardWith(
      piece("red", { row: 4, col: 3 }),
      piece(blocker, { row: 3, col: 2 }),
    );
    // Act
    const moves = rules
      .getLegalMoves(board, "red")
      .filter((m) => m.from.row === 4 && m.from.col === 3)
      .map((m) => m.to);
    // Assert
    expect(moves).toEqual([{ row: 3, col: 4 }]);
  },
);

it("only lists moves for the player's own pieces", () => {
  // Arrange
  const board = new CheckerBoard();
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  moves.forEach((m) => expect(board.getPiece(m.from)?.color).toBe("red"));
});

it("finds a legal move and rejects backward and two-square moves", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 4, col: 3 }));
  const from = { row: 4, col: 3 };
  // Act
  const legal = rules.findLegalMove(board, "red", from, { row: 3, col: 2 });
  const backward = rules.findLegalMove(board, "red", from, { row: 5, col: 2 });
  const twoSquares = rules.findLegalMove(board, "red", from, {
    row: 2,
    col: 1,
  });
  // Assert
  expect(legal).toEqual({ from, to: { row: 3, col: 2 }, captured: [] });
  expect(backward).toBeNull();
  expect(twoSquares).toBeNull();
});

it("never changes the board", () => {
  // Arrange
  const board = new CheckerBoard();
  const before = structuredClone(board.getActiveCheckerPieces());
  // Act
  rules.getLegalMoves(board, "red");
  rules.findLegalMove(board, "black", { row: 2, col: 1 }, { row: 3, col: 0 });
  // Assert
  expect(board.getActiveCheckerPieces()).toEqual(before);
});
