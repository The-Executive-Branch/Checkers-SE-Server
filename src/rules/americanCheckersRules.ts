import type { LegalMove } from "./legalMove.ts";
import type { CheckerRules } from "./interface.ts";
import type CheckerBoard from "../models/checkerboard.ts";
import type { CheckerColor, Position } from "checkers-shared-types";

export class AmericanCheckersRules implements CheckerRules {
  getLegalMoves(board: CheckerBoard, color: CheckerColor): LegalMove[] {
    const legalMoves: LegalMove[] = [];
    const checkers = board
      .getActiveCheckerPieces()
      .filter((p) => p.color === color);

    checkers.forEach((checker) => {
      let neighbors: Position[] = [];

      if (checker.isKing)
        neighbors = [
          { row: checker.row - 1, col: checker.col - 1 }, // up-left
          { row: checker.row - 1, col: checker.col + 1 }, // up-right
          { row: checker.row + 1, col: checker.col - 1 }, // down-left
          { row: checker.row + 1, col: checker.col + 1 }, // down-right
        ];
      else if (color === "red")
        neighbors = [
          { row: checker.row - 1, col: checker.col - 1 }, // up-left
          { row: checker.row - 1, col: checker.col + 1 }, // up-right
        ];
      else
        neighbors = [
          { row: checker.row + 1, col: checker.col - 1 }, // down-left
          { row: checker.row + 1, col: checker.col + 1 }, // down-right
        ];

      // Is neighbor a valid position && neighbor space empty
      for (const n of neighbors) {
        if (board.isPositionValid(n) && board.getPiece(n) === null)
          legalMoves.push({
            from: { row: checker.row, col: checker.col },
            to: n,
            captured: [],
          });
      }
    });

    return legalMoves;
  }

  findLegalMove(
    board: CheckerBoard,
    color: CheckerColor,
    from: Position,
    to: Position,
  ): LegalMove | null {
    const legalMoves = this.getLegalMoves(board, color);
    const samePosition = (a: Position, b: Position) =>
      a.row === b.row && a.col === b.col;

    return (
      legalMoves.find(
        (m) => samePosition(m.from, from) && samePosition(m.to, to),
      ) ?? null
    );
  }
}
