import { randomUUID } from "node:crypto";
import { db } from "../db.ts";

export const createSession = async (userId: string) => {
  const sessionId = randomUUID();
  const row = await db.one(
    "INSERT INTO sessions (session_id, user_id) VALUES ($1, $2) RETURNING expires_at",
    [sessionId, userId],
  );
  return { sessionId, expiresAt: row.expires_at };
};
