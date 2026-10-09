import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { db } from "../db.ts";

export const TEST_PASSWORD = "test-password-123";
export const AUTH_ROUTES = {
  UNREGISTER: "/auth/unregister",
  LOGOUT: "/auth/logout",
};

export const seedTestUser = async (options: { expired?: boolean } = {}) => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);

  const user = await db.one(
    "INSERT INTO auth (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ["testuser", "testuser@example.com", passwordHash],
  );

  const sessionId = randomUUID();
  const lifetime = options.expired ? "-1 day" : "7 days";

  await db.none(
    "INSERT INTO sessions (session_id, user_id, expires_at) VALUES ($1, $2, now() + $3::interval)",
    [sessionId, user.id, lifetime],
  );

  return { userId: user.id, sessionId };
};
