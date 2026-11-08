import type { GameRecord, Player } from "checkers-shared-types";
import { db } from "./db.ts";

const usernameOf = (player: Player) =>
  player.kind === "user" ? player.username : null;

export const saveGameRecord = async (gameRecord: GameRecord) => {
  const { gameId, ...gameData } = gameRecord;
  const { red, black } = gameRecord.players;
  try {
    await db.none(
      `INSERT INTO game_records (game_id, red_user_id, black_user_id, game_data)
     VALUES (
       $1,
       (SELECT id FROM auth WHERE username = $2),
       (SELECT id FROM auth WHERE username = $3),
       $4
     )`,
      [gameId, usernameOf(red), usernameOf(black), gameData],
    );
  } catch (error) {
    console.error("Failed to save game", gameId, error);
    throw error;
  }
};
