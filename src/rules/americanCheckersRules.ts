import type { LegalMove } from "./legalMove.ts";
import type { CheckerRules } from "./interface.ts";
import type CheckerBoard from "../models/checkerboard.ts";
import type { CheckerColor, CheckerPiece, Position } from "checkers-shared-types";

export class AmericanCheckersRules implements CheckerRules {
  getLegalMoves(
    board: CheckerBoard,
    color: CheckerColor,
    mustJumpFrom?: Position,
  ): LegalMove[] {
    const simpleMoves: LegalMove[] = [];
    const captures: LegalMove[] = [];
    let checkers = board
      .getActiveCheckerPieces()
      .filter((p) => p.color === color);

    if (mustJumpFrom)
      checkers = checkers.filter(
        (c) => c.row === mustJumpFrom.row && c.col === mustJumpFrom.col,
      );

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

      for (const n of neighbors) {
        if (!board.isPositionValid(n)) continue;
        const neighbor = board.getPiece(n);

        if (neighbor === null)
          simpleMoves.push({
            from: { row: checker.row, col: checker.col },
            to: n,
            captured: [],
            crowns: this.wouldCrown(board, checker, n),
          });
        else if (neighbor.color !== color) {
          const landing = {
            row: n.row + (n.row - checker.row),
            col: n.col + (n.col - checker.col),
          };
          if (
            board.isPositionValid(landing) &&
            board.getPiece(landing) === null
          )
            captures.push({
              from: { row: checker.row, col: checker.col },
              to: landing,
              captured: [n],
              crowns: this.wouldCrown(board, checker, landing),
            });
        }
      }
    });

    if (captures.length > 0) return captures;
    if (mustJumpFrom) return [];
    return simpleMoves;
  }

  findLegalMove(
    board: CheckerBoard,
    color: CheckerColor,
    from: Position,
    to: Position,
    mustJumpFrom?: Position,
  ): LegalMove | null {
    const legalMoves = this.getLegalMoves(board, color, mustJumpFrom);
    const samePosition = (a: Position, b: Position) =>
      a.row === b.row && a.col === b.col;

    return (
      legalMoves.find(
        (m) => samePosition(m.from, from) && samePosition(m.to, to),
      ) ?? null
    );
  }

  // A regular piece is crowned when it lands on its far row:
  // row 0 for red, the last row for black. Kings never crown again.
  private wouldCrown(
    board: CheckerBoard,
    checker: CheckerPiece,
    to: Position,
  ): boolean {
    if (checker.isKing) return false;
    const farRow = checker.color === "red" ? 0 : board.getSize() - 1;
    return to.row === farRow;
  }
}