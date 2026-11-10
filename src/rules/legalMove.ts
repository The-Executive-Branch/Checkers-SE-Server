import { Position } from "checkers-shared-types";
import { Move } from "../models/checkerboard";

export type LegalMove = Move & {
  captured: Position[];
  crowns: boolean;
};
