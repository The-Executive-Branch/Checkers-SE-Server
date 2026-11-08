import { LegalMove } from "./legalMove";
import CheckerBoard from "../models/checkerboard";
import { CheckerColor, Position } from "checkers-shared-types";

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
}
