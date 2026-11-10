import type { Position } from "checkers-shared-types";

// A complete legal game from the opening board: 50 moves, ending with
// red winning. It includes captures, a double jump, and a crowning.
// Each entry is [from, to] as [row, col].
const MOVES: [number, number][][] = [
  [[5, 4], [4, 3]],
  [[2, 1], [3, 2]],
  [[4, 3], [2, 1]],
  [[1, 0], [3, 2]],
  [[5, 2], [4, 1]],
  [[3, 2], [4, 3]],
  [[4, 1], [3, 0]],
  [[4, 3], [5, 4]],
  [[6, 3], [4, 5]],
  [[1, 2], [2, 1]],
  [[3, 0], [1, 2]],
  [[0, 3], [2, 1]],
  [[5, 6], [4, 7]],
  [[2, 3], [3, 2]],
  [[7, 4], [6, 3]],
  [[2, 5], [3, 4]],
  [[4, 5], [2, 3]],
  [[1, 6], [2, 5]],
  [[6, 5], [5, 6]],
  [[0, 7], [1, 6]],
  [[5, 0], [4, 1]],
  [[3, 2], [5, 0]],
  [[2, 3], [1, 2]],
  [[0, 1], [2, 3]],
  [[6, 3], [5, 2]],
  [[2, 5], [3, 6]],
  [[4, 7], [2, 5]],
  [[2, 5], [0, 3]],
  [[2, 3], [3, 4]],
  [[7, 6], [6, 5]],
  [[2, 7], [3, 6]],
  [[5, 2], [4, 3]],
  [[3, 4], [5, 2]],
  [[6, 1], [4, 3]],
  [[3, 6], [4, 5]],
  [[5, 6], [3, 4]],
  [[2, 1], [3, 0]],
  [[6, 7], [5, 6]],
  [[1, 6], [2, 5]],
  [[3, 4], [1, 6]],
  [[0, 5], [2, 7]],
  [[4, 3], [3, 2]],
  [[2, 7], [3, 6]],
  [[3, 2], [2, 3]],
  [[5, 0], [6, 1]],
  [[7, 2], [5, 0]],
  [[3, 6], [4, 5]],
  [[5, 6], [3, 4]],
  [[3, 0], [4, 1]],
  [[5, 0], [3, 2]],
];

export const FINISHED_GAME_WINNER = "red" as const;

export const FINISHED_GAME_MOVES: { from: Position; to: Position }[] = MOVES.map(
  ([[fromRow, fromCol], [toRow, toCol]]) => ({
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
  }),
);
