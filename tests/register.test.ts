import { it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app.ts";
import { seedTestUser, AUTH_ROUTES, TEST_PASSWORD } from "./helpers.ts";
import { db } from "../db.ts";

const seedUser = async () => {
  const { userId, sessionId } = await seedTestUser();
  const { username, email } = await db.one(
    "SELECT username, email FROM auth WHERE id = $1",
    userId,
  );
  return { userId, sessionId, username, email };
};

const validBody = (overrides: Record<string, unknown> = {}) => ({
  username: "newuser",
  email: "newuser@example.com",
  password: TEST_PASSWORD,
  ...overrides,
});

const countUsers = async () =>
  Number((await db.one("SELECT COUNT(*) FROM auth")).count);

it("creates an account and returns user + session info", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody());

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ username: "newuser" });
  expect(response.body.userId).toBeDefined();
  expect(response.body.sessionId).toBeDefined();
  expect(response.body.expiresAt).toBeDefined();

  const row = await db.oneOrNone(
    "SELECT username, email FROM auth WHERE id = $1",
    response.body.userId,
  );
  expect(row).toEqual({ username: "newuser", email: "newuser@example.com" });
});

it("returns no password data in the response", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody());

  const { password_hash } = await db.one(
    "SELECT password_hash FROM auth WHERE id = $1",
    response.body.userId,
  );

  expect(response.body).not.toHaveProperty("password");
  expect(response.body).not.toHaveProperty("password_hash");
  expect(response.body).not.toHaveProperty("passwordHash");
  expect(response.text).not.toContain(TEST_PASSWORD);
  expect(response.text).not.toContain(password_hash);
});

it("stores a bcrypt hash, never the plaintext password", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody());

  const { password_hash } = await db.one(
    "SELECT password_hash FROM auth WHERE id = $1",
    response.body.userId,
  );

  expect(password_hash).not.toBe(TEST_PASSWORD);
  expect(await bcrypt.compare(TEST_PASSWORD, password_hash)).toBe(true);
});

it("creates a session that matches the returned id and expires in the future", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody());

  const sessions = await db.any(
    "SELECT session_id, expires_at FROM sessions WHERE user_id = $1",
    response.body.userId,
  );
  expect(sessions).toHaveLength(1);
  expect(sessions[0].session_id).toBe(response.body.sessionId);

  const returned = new Date(response.body.expiresAt).getTime();
  expect(returned).toBe(new Date(sessions[0].expires_at).getTime());
  expect(returned).toBeGreaterThan(Date.now());
});

it("rejects a duplicate username with a clear error and creates no account", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody({ username }));

  expect(response.status).toBe(409);
  expect(response.body.error).toMatch(/username/i);
  expect(await countUsers()).toBe(1); // only the seeded user
});

it("rejects a duplicate email with a clear error and creates no account", async () => {
  const { email } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody({ email }));

  expect(response.status).toBe(409);
  expect(response.body.error).toMatch(/email/i);
  expect(await countUsers()).toBe(1);
});

it("leaves the existing account untouched after a rejected duplicate", async () => {
  const { userId, username } = await seedUser();
  const before = await db.one("SELECT * FROM auth WHERE id = $1", userId);

  await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody({ username, password: "a-different-password" }));

  const after = await db.one("SELECT * FROM auth WHERE id = $1", userId);
  expect(after).toEqual(before);
});

it("rejects an empty email and creates no account", async () => {
  // parseEmail only checks for non-empty; format validation lives in the frontend
  const response = await request(app)
    .post(AUTH_ROUTES.REGISTER)
    .send(validBody({ email: "   " }));

  expect(response.status).toBe(400);
  expect(await countUsers()).toBe(0);
});

// parsePassword enforces 8-100 characters
it.each([
  ["too short", "x"],
  ["too long", "a".repeat(101)],
])(
  "rejects a password that is %s and creates no account",
  async (_, password) => {
    const response = await request(app)
      .post(AUTH_ROUTES.REGISTER)
      .send(validBody({ password }));

    expect(response.status).toBe(400);
    expect(await countUsers()).toBe(0);
  },
);

it.each(["username", "email", "password"])(
  "rejects a request missing %s",
  async (field) => {
    const body: Record<string, unknown> = validBody();
    delete body[field];

    const response = await request(app).post(AUTH_ROUTES.REGISTER).send(body);

    expect(response.status).toBe(400);
    expect(await countUsers()).toBe(0);
  },
);

it("rejects a request with no body", async () => {
  const response = await request(app).post(AUTH_ROUTES.REGISTER).send();

  expect(response.status).toBe(400);
  expect(await countUsers()).toBe(0);
});
