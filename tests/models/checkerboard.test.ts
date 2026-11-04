import { it, expect } from "vitest";
import CheckerBoard, {
  CheckerBoardError,
  CheckerBoardErrorCode,
} from "../../src/models/checkerboard";
import type { CheckerPiece, Position } from "checkers-shared-types";

const isDark = ({ row, col }: Position): boolean => (row + col) % 2 === 1;

const makePiece = (id: string, { row, col }: Position): CheckerPiece => ({
  id,
  color: "red",
  isKing: false,
  row,
  col,
});

it("creates a board with 12 black and 12 red pieces with unique IDs on the dark squares", () => {
  // Arrange
  const checkerboard = new CheckerBoard();

  // Act
  const pieces = checkerboard.getActiveCheckerPieces();

  const redPieces = pieces.filter((p) => p.color === "red");
  const blackPieces = pieces.filter((p) => p.color === "black");
  const uniqueIdSet = new Set(pieces.map((p) => p.id));

  // Assert
  expect(pieces).toHaveLength(24);
  expect(redPieces).toHaveLength(12);
  expect(blackPieces).toHaveLength(12);
  expect(uniqueIdSet.size).toBe(24);
  blackPieces.forEach((p) => {
    expect(p.row).toBeLessThanOrEqual(2);
    expect(isDark(p)).toBe(true);
  });
  redPieces.forEach((p) => {
    expect(p.row).toBeGreaterThanOrEqual(5);
    expect(isDark(p)).toBe(true);
  });
});

it.each([
  { row: 0, col: 1, expected: "black" },
  { row: 7, col: 0, expected: "red" },
  { row: 3, col: 0, expected: null },
  { row: 0, col: 0, expected: null },
])("reports $expected at row $row, column $col", ({ row, col, expected }) => {
  // Arrange
  const checkerboard = new CheckerBoard();
  // Act
  const piece = checkerboard.getPiece({ row, col });
  // Assert
  expect(piece?.color ?? null).toBe(expected);
});

it("moves a checker piece to an empty square, clearing the previous square and keeping the same ID", () => {
  // Arrange
  const checkerboard = new CheckerBoard();
  const startingPosition: Position = { row: 5, col: 0 };
  const endingPosition: Position = { row: 4, col: 1 };
  // Act
  checkerboard.moveCheckerPiece(startingPosition, endingPosition);
  // Assert
  expect(checkerboard.getPiece(startingPosition)).toBeNull();
  expect(checkerboard.getPiece(endingPosition)?.id).toEqual("red-5-0");
});

it.each([
  { row: 5, col: 6, expected: CheckerBoardErrorCode.SquareIsOccupied },
  {
    row: 8,
    col: 2,
    expected: CheckerBoardErrorCode.OutOfBounds,
  },
  { row: 4, col: 0, expected: CheckerBoardErrorCode.SquareIsNotDark },
])(
  "reports $expected when moving to row $row and column $col",
  ({ row, col, expected }) => {
    // Arrange
    const checkerboard = new CheckerBoard();
    // Act
    const move = () =>
      checkerboard.moveCheckerPiece(
        { row: 2, col: 7 },
        {
          row,
          col,
        },
      );
    // Assert
    expect(move).toThrow(CheckerBoardError);
    expect(move).toThrow(expect.objectContaining({ code: expected }));
    expect(checkerboard.getPiece({ row: 2, col: 7 })?.id).toBe("black-2-7");
    expect(checkerboard.getPiece({ row: 5, col: 6 })?.id).toBe("red-5-6");
  },
);

it("crowns a piece and keeps its ID and position", () => {
  // Arrange
  const checkerboard = new CheckerBoard();
  // Act
  checkerboard.crownCheckerPiece({ row: 2, col: 7 });
  // Assert
  expect(checkerboard.getPiece({ row: 2, col: 7 })?.isKing).toBe(true);
});

it.each([
  { row: 3, col: 0, expected: CheckerBoardErrorCode.EmptySquare },
  { row: 8, col: 0, expected: CheckerBoardErrorCode.OutOfBounds },
])(
  "reports $expected when crowning row $row, column $col",
  ({ row, col, expected }) => {
    // Arrange
    const checkerboard = new CheckerBoard();
    // Act
    const crown = () => checkerboard.crownCheckerPiece({ row, col });
    // Assert
    expect(crown).toThrow(CheckerBoardError);
    expect(crown).toThrow(expect.objectContaining({ code: expected }));
  },
);

it("treats row 9 as on the board for a 10 by 10 board", () => {
  // Arrange
  const checkerboard = new CheckerBoard(10);
  // Assert
  expect(checkerboard.isPositionValid({ row: 9, col: 2 })).toBe(true);
  expect(checkerboard.isPositionValid({ row: 10, col: 0 })).toBe(false);
});

it("keeps a moved piece in the list of active pieces", () => {
  const checkerboard = new CheckerBoard();

  checkerboard.moveCheckerPiece({ row: 5, col: 0 }, { row: 4, col: 1 });

  const pieces = checkerboard.getActiveCheckerPieces();
  expect(pieces).toHaveLength(24);
  expect(pieces).toContainEqual(
    expect.objectContaining({ id: "red-5-0", row: 4, col: 1 }),
  );
});

it("reports an empty square when moving from a square with no piece", () => {
  const checkerboard = new CheckerBoard();
  const move = () =>
    checkerboard.moveCheckerPiece({ row: 3, col: 0 }, { row: 4, col: 1 });

  expect(move).toThrow(
    expect.objectContaining({ code: CheckerBoardErrorCode.EmptySquare }),
  );
});

it("starts with no pieces when created empty", () => {
  // Arrange
  const checkerboard = new CheckerBoard(8, { empty: true });
  // Act
  const pieces = checkerboard.getActiveCheckerPieces();
  // Assert
  expect(pieces).toHaveLength(0);
});

it("removes a piece and leaves its square empty", () => {
  // Arrange
  const checkerboard = new CheckerBoard();
  const position: Position = { row: 5, col: 0 };
  // Act
  checkerboard.removeCheckerPiece(position);
  // Assert
  expect(checkerboard.getPiece(position)).toBeNull();
  expect(checkerboard.getActiveCheckerPieces()).toHaveLength(23);
});

it.each([
  { row: 3, col: 0, expected: CheckerBoardErrorCode.EmptySquare },
  { row: 8, col: 0, expected: CheckerBoardErrorCode.OutOfBounds },
])(
  "reports $expected when removing from row $row, column $col",
  ({ row, col, expected }) => {
    // Arrange
    const checkerboard = new CheckerBoard();
    // Act
    const remove = () => checkerboard.removeCheckerPiece({ row, col });
    // Assert
    expect(remove).toThrow(CheckerBoardError);
    expect(remove).toThrow(expect.objectContaining({ code: expected }));
    expect(checkerboard.getActiveCheckerPieces()).toHaveLength(24);
  },
);

it("places a piece on an empty dark square", () => {
  // Arrange
  const checkerboard = new CheckerBoard(8, { empty: true });
  const position: Position = { row: 4, col: 1 };
  // Act
  checkerboard.placeCheckerPiece(makePiece("red-test", position));
  // Assert
  expect(checkerboard.getPiece(position)?.id).toBe("red-test");
  expect(checkerboard.getActiveCheckerPieces()).toHaveLength(1);
});

it.each([
  { row: 5, col: 0, expected: CheckerBoardErrorCode.SquareIsOccupied },
  { row: 4, col: 0, expected: CheckerBoardErrorCode.SquareIsNotDark },
  { row: 8, col: 1, expected: CheckerBoardErrorCode.OutOfBounds },
])(
  "reports $expected when placing on row $row, column $col",
  ({ row, col, expected }) => {
    // Arrange
    const checkerboard = new CheckerBoard();
    // Act
    const place = () =>
      checkerboard.placeCheckerPiece(makePiece("red-test", { row, col }));
    // Assert
    expect(place).toThrow(CheckerBoardError);
    expect(place).toThrow(expect.objectContaining({ code: expected }));
    expect(checkerboard.getPiece({ row: 5, col: 0 })?.id).toBe("red-5-0");
  },
);

it("reports out of bounds when moving from off the board", () => {
  const checkerboard = new CheckerBoard();
  const move = () =>
    checkerboard.moveCheckerPiece({ row: 8, col: 1 }, { row: 4, col: 1 });

  expect(move).toThrow(
    expect.objectContaining({ code: CheckerBoardErrorCode.OutOfBounds }),
  );
});
