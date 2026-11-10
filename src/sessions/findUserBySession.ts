import { db } from "../db.ts";
import type { Account } from "../websocket/gameServer.ts";

// Returns the signed-in account for a session ID, or null when the
// session doesn't exist or has expired. Shared by the WebSocket server,
// and meant for the session middleware ticket to reuse.
export const findUserBySession = async (
  sessionId: string,
): Promise<Account | null> => {
  const row = await db.oneOrNone<{ user_id: string; username: string }>(
    `SELECT a.id AS user_id, a.username
       FROM sessions s
       JOIN auth a ON a.id = s.user_id
      WHERE s.session_id = $1
        AND s.expires_at > now()`,
    [sessionId],
  );
  return row ? { userId: row.user_id, username: row.username } : null;
};
