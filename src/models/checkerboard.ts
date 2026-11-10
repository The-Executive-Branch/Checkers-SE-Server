import type {
  CheckerColor,
  CheckerPiece,
  Position,
} from "checkers-shared-types";

export type Move = {
  from: Position;
  to: Position;
};

export const CheckerBoardErrorCode = {
  EmptySquare: "Square is empty",
  SquareIsOccupied: "Square is occupied",
  SquareIsNotDark: "Square must be a dark square",
  OutOfBounds: "Position coordinates must be within the checker board.",
} as const;

export type CheckerBoardErrorCode =
  (typeof CheckerBoardErrorCode)[keyof typeof CheckerBoardErrorCode];

export class CheckerBoardError extends Error {
  readonly code: CheckerBoardErrorCode;

  constructor(code: CheckerBoardErrorCode) {
    super(code);
    this.code = code;
    this.name = "CheckerBoardError";
  }
}

export default class CheckerBoard {
  private size: number;
  readonly RED_BOUNDARY: number;
  readonly BLACK_BOUNDARY: number = 3;
  private grid: (CheckerPiece | null)[][] = [];

  constructor(size: number = 8, options: { empty?: boolean } = {}) {
    this.size = size;
    this.RED_BOUNDARY = size - 3;
    this.buildGrid(options.empty ?? false);
  }

  private isStartingPosition({ row, col }: Position): boolean {
    return row < this.BLACK_BOUNDARY || row >= this.RED_BOUNDARY;
  }

  private isSquareDark({ row, col }: Position): boolean {
    return (row + col) % 2 === 1;
  }

  private isSquareEmpty(position: Position): boolean {
    return this.grid[position.row][position.col] === null;
  }

  private buildGrid(empty: boolean): void {
    for (let row = 0; row < this.size; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.size; col++) {
        if (empty) {
          this.grid[row][col] = null;
        } else if (
          this.isSquareDark({ row, col }) &&
          this.isStartingPosition({ row, col })
        ) {
          const color: CheckerColor =
            row < this.BLACK_BOUNDARY ? "black" : "red";
          this.grid[row][col] = {
            id: `${color}-${row}-${col}`,
            color,
            isKing: false,
            row,
            col,
          };
        } else this.grid[row][col] = null;
      }
    }
  }

  private verifyCanOccupy(position: Position): void {
    if (!this.isPositionValid(position))
      throw new CheckerBoardError(CheckerBoardErrorCode.OutOfBounds);
    if (!this.isSquareDark(position))
      throw new CheckerBoardError(CheckerBoardErrorCode.SquareIsNotDark);
    if (!this.isSquareEmpty(position))
      throw new CheckerBoardError(CheckerBoardErrorCode.SquareIsOccupied);
  }

  private verifyCheckerPieceExists(position: Position): void {
    if (!this.isPositionValid(position))
      throw new CheckerBoardError(CheckerBoardErrorCode.OutOfBounds);

    if (this.isSquareEmpty(position))
      throw new CheckerBoardError(CheckerBoardErrorCode.EmptySquare);
  }

  isPositionValid(position: Position): boolean {
    return (
      position.row >= 0 &&
      position.row < this.size &&
      position.col >= 0 &&
      position.col < this.size
    );
  }

  getSize(): number {
    return this.size;
  }

  getPiece(position: Position): CheckerPiece | null {
    if (!this.isPositionValid(position)) return null;
    const { row, col } = position;
    return this.grid[row][col];
  }

  removeCheckerPiece(position: Position): void {
    this.verifyCheckerPieceExists(position);
    this.grid[position.row][position.col] = null;
  }

  crownCheckerPiece(position: Position): void {
    this.verifyCheckerPieceExists(position);
    this.grid[position.row][position.col]!.isKing = true;
  }

  getActiveCheckerPieces(): CheckerPiece[] {
    const activePieces: CheckerPiece[] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const cell = this.grid[row][col];
        if (cell) activePieces.push(cell);
      }
    }

    return activePieces;
  }

  placeCheckerPiece(checkerPiece: CheckerPiece): void {
    this.verifyCanOccupy({ row: checkerPiece.row, col: checkerPiece.col });
    this.grid[checkerPiece.row][checkerPiece.col] = checkerPiece;
  }

  moveCheckerPiece(from: Position, to: Position): void {
    this.verifyCanOccupy(to);
    this.verifyCheckerPieceExists(from);

    const pieceToMove = this.getPiece(from);

    this.grid[from.row][from.col] = null;
    this.grid[to.row][to.col] = pieceToMove;

    pieceToMove!.row = to.row;
    pieceToMove!.col = to.col;
  }
}
