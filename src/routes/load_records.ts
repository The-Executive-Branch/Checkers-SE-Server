import { Router, type Request, type Response } from "express";
import type { GetGameRecordsResponse } from "checkers-shared-types";
import { db } from "../db.ts";
import { ERRORS } from "../errors.ts";

export const gameRouter = Router();

gameRouter.get("/list", async (req: Request, res: Response) => {
  try {
    const [scheme, sessionId] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !sessionId)
      return res.status(401).send({ error: ERRORS.UNAUTHORIZED });

    const session = await db.oneOrNone(
      "SELECT user_id FROM sessions WHERE session_id = $1 AND expires_at > now()",
      [sessionId],
    );
    if (!session) return res.status(401).send({ error: ERRORS.UNAUTHORIZED });

    const rows = await db.manyOrNone(
      `SELECT game_id, game_data, ended_at
       FROM game_records
       WHERE red_user_id = $1 OR black_user_id = $1
       ORDER BY ended_at DESC`,
      [session.user_id],
    );

    const response: GetGameRecordsResponse = {
      data: rows.map((row) => ({
        gameId: row.game_id,
        ...row.game_data,
        endedAt: row.ended_at,
      })),
    };
    res.send(response);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER });
  }
});

gameRouter.get("/:gameId", async (req: Request, res: Response) => {
  try {
    const [scheme, sessionId] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !sessionId)
      return res.status(401).send({ error: ERRORS.UNAUTHORIZED });

    const session = await db.oneOrNone(
      "SELECT user_id FROM sessions WHERE session_id = $1 AND expires_at > now()",
      [sessionId],
    );
    if (!session) return res.status(401).send({ error: ERRORS.UNAUTHORIZED });
    const row = await db.oneOrNone(
      `SELECT game_id, game_data, ended_at
       FROM game_records
       WHERE game_id = $1 AND (red_user_id = $2 OR black_user_id = $2)`,
      [req.params.gameId, session.user_id],
    );
    if (!row) return res.status(404).send({ error: "Game not found." });
    const response: GetGameRecordsResponse = {
      data: {
        gameId: row.game_id,
        ...row.game_data,
        endedAt: row.ended_at,
      },
    };
    res.send(response);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER });
  }
});
