import type { CheckerColor, GameStatus, Position } from "checkers-shared-types";
import type CheckerBoard from "../models/checkerboard.ts";
import type { LegalMove } from "./legalMove.ts";

export interface CheckerRules {
  getLegalMoves(
    board: CheckerBoard,
    color: CheckerColor,
    mustJumpFrom?: Position,
  ): LegalMove[];

  findLegalMove(
    board: CheckerBoard,
    color: CheckerColor,
    from: Position,
    to: Position,
    mustJumpFrom?: Position,
  ): LegalMove | null;

  getGameStatus(board: CheckerBoard, turn: CheckerColor): GameStatus;
}
