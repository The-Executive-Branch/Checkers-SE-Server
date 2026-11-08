import type { LegalMove } from "./legalMove.ts";
import type { CheckerRules } from "./interface.ts";
import type CheckerBoard from "../models/checkerboard.ts";
import type { CheckerColor, Position } from "checkers-shared-types";

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

      // Is neighbor a valid position && neighbor space empty
      for (const n of neighbors) {
        if (!board.isPositionValid(n)) continue;
        const neighbor = board.getPiece(n);
        if (neighbor === null)
          simpleMoves.push({
            from: { row: checker.row, col: checker.col },
            to: n,
            captured: [],
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
}
