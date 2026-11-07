import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { db } from "../src/db.ts";
import type { Player } from "checkers-shared-types/game";

export const TEST_PASSWORD = "Testpassword123!";
export const AUTH_ROUTES = {
  UNREGISTER: "/auth/unregister",
  LOGOUT: "/auth/logout",
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  USERNAME_AVAILABLE: "/auth/username-available",
} as const;

export const GAME_ROUTES = {
  LIST: "/games/list",
  ONE: (gameId: string) => `/games/${gameId}`,
} as const;

export const addDeviceSession = async (userId: string) => {
  const sessionId = randomUUID();
  await db.none("INSERT INTO sessions (session_id, user_id) VALUES ($1, $2)", [
    sessionId,
    userId,
  ]);

  return sessionId;
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
export const seedPlayer = async (options: { expired?: boolean } = {}) => {
  const username = `user_${randomUUID().slice(0, 8)}`;
  const user = await db.one(
    "INSERT INTO auth (username, email, password_hash) VALUES ($1, $2, 'not-a-real-hash') RETURNING id",
    [username, `${username}@example.com`],
  );

  const sessionId = randomUUID();
  const lifetime = options.expired ? "-1 day" : "7 days";

  await db.none(
    "INSERT INTO sessions (session_id, user_id, expires_at) VALUES ($1, $2, now() + $3::interval)",
    [sessionId, user.id, lifetime],
  );

  return { userId: user.id as string, username, sessionId };
};

export const userPlayer = (username: string): Player => ({
  kind: "user",
  username,
});

export const gameData = (red: Player, black: Player) => ({
  players: { red, black },
  winner: "red",
  moves: [
    {
      from: { row: 5, col: 0 },
      to: { row: 4, col: 1 },
      nextPlayerTurn: "black",
    },
  ],
});

export const seedGame = async (
  redUserId: string | null,
  blackUserId: string | null,
  data: object,
  endedAt?: Date,
) => {
  const gameId = randomUUID();
  await db.none(
    `INSERT INTO game_records (game_id, red_user_id, black_user_id, game_data, ended_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [gameId, redUserId, blackUserId, data, endedAt ?? new Date()],
  );
  return gameId;
};
