import { it, expect } from "vitest";
import type { CheckerColor, CheckerPiece, Position } from "checkers-shared-types";
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

// ── Simple moves ───────────────────────────────────────────

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
    expect.arrayContaining([{ row: 3, col: 2 }, { row: 3, col: 4 }]),
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
      piece("red", { row: 2, col: 1 }), // fills the landing square, so no capture
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
  const twoSquares = rules.findLegalMove(board, "red", from, { row: 2, col: 1 });
  // Assert
  expect(legal).toEqual({ from, to: { row: 3, col: 2 }, captured: [], crowns: false });
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

// ── Captures ───────────────────────────────────────────────

it("lists a capture over an opponent onto the empty square beyond", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 5, col: 2 }), piece("black", { row: 4, col: 3 }));
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  expect(moves).toEqual([
    { from: { row: 5, col: 2 }, to: { row: 3, col: 4 }, captured: [{ row: 4, col: 3 }], crowns: false },
  ]);
});

it("only lists captures when one is available", () => {
  // Arrange
  const board = boardWith(
    piece("red", { row: 5, col: 2 }),
    piece("black", { row: 4, col: 3 }),
    piece("red", { row: 5, col: 6 }), // can only step forward
  );
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  expect(moves).toHaveLength(1);
  expect(moves[0].captured).toHaveLength(1);
});

it.each([
  { name: "occupied", blocker: piece("black", { row: 3, col: 4 }), red: { row: 5, col: 2 }, black: { row: 4, col: 3 } },
  { name: "off the board", blocker: null, red: { row: 2, col: 1 }, black: { row: 1, col: 0 } },
])("does not capture when the landing square is $name", ({ blocker, red, black }) => {
  // Arrange
  const pieces = [piece("red", red), piece("black", black)];
  if (blocker) pieces.push(blocker);
  const board = boardWith(...pieces);
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  moves.forEach((m) => expect(m.captured).toEqual([]));
});

it("does not capture a piece of its own color", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 5, col: 2 }), piece("red", { row: 4, col: 3 }));
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  moves.forEach((m) => expect(m.captured).toEqual([]));
});

it("only lets a king capture backward", () => {
  // Arrange
  const regular = boardWith(piece("red", { row: 3, col: 2 }), piece("black", { row: 4, col: 3 }));
  const king = boardWith(piece("red", { row: 3, col: 2 }, true), piece("black", { row: 4, col: 3 }));
  // Act
  const regularMoves = rules.getLegalMoves(regular, "red");
  const kingMoves = rules.getLegalMoves(king, "red");
  // Assert
  regularMoves.forEach((m) => expect(m.captured).toEqual([]));
  expect(kingMoves).toEqual([
    { from: { row: 3, col: 2 }, to: { row: 5, col: 4 }, captured: [{ row: 4, col: 3 }], crowns: false },
  ]);
});

it("only lists the must-jump piece's captures", () => {
  // Arrange
  const board = boardWith(
    piece("red", { row: 5, col: 2 }),
    piece("black", { row: 4, col: 3 }),
    piece("red", { row: 5, col: 6 }),
    piece("black", { row: 4, col: 5 }),
  );
  // Act
  const moves = rules.getLegalMoves(board, "red", { row: 5, col: 6 });
  // Assert
  expect(moves).toHaveLength(1);
  expect(moves[0].from).toEqual({ row: 5, col: 6 });
});

it("continues a jump from the landing square", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 3, col: 4 }), piece("black", { row: 2, col: 5 }));
  // Act
  const moves = rules.getLegalMoves(board, "red", { row: 3, col: 4 });
  // Assert
  expect(moves).toEqual([
    { from: { row: 3, col: 4 }, to: { row: 1, col: 6 }, captured: [{ row: 2, col: 5 }], crowns: false },
  ]);
});

// ── Crowning ───────────────────────────────────────────────

it("crowns a regular red piece that reaches row 0", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 1, col: 2 }));
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  expect(moves).toHaveLength(2);
  moves.forEach((m) => {
    expect(m.to.row).toBe(0);
    expect(m.crowns).toBe(true);
  });
});

it("crowns a regular black piece that reaches row 7", () => {
  // Arrange
  const board = boardWith(piece("black", { row: 6, col: 1 }));
  // Act
  const moves = rules.getLegalMoves(board, "black");
  // Assert
  expect(moves).toHaveLength(2);
  moves.forEach((m) => {
    expect(m.to.row).toBe(7);
    expect(m.crowns).toBe(true);
  });
});

it("crowns a piece that captures onto its far row", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 2, col: 1 }), piece("black", { row: 1, col: 2 }));
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  expect(moves).toEqual([
    { from: { row: 2, col: 1 }, to: { row: 0, col: 3 }, captured: [{ row: 1, col: 2 }], crowns: true },
  ]);
});

it("does not crown a king again", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 1, col: 2 }, true));
  // Act
  const moves = rules.getLegalMoves(board, "red");
  // Assert
  moves.forEach((m) => expect(m.crowns).toBe(false));
});

it("does not crown any opening move", () => {
  // Arrange
  const board = new CheckerBoard();
  // Act
  const moves = [
    ...rules.getLegalMoves(board, "red"),
    ...rules.getLegalMoves(board, "black"),
  ];
  // Assert
  moves.forEach((m) => expect(m.crowns).toBe(false));
});

it("does not crown the piece on the board", () => {
  // Arrange
  const board = boardWith(piece("red", { row: 1, col: 2 }));
  // Act
  rules.getLegalMoves(board, "red");
  // Assert
  expect(board.getPiece({ row: 1, col: 2 })?.isKing).toBe(false);
});