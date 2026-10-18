import { it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.ts";
import { seedTestUser, AUTH_ROUTES, TEST_PASSWORD } from "./helpers.ts";
import { db } from "../db.ts";

const WRONG_PASSWORD = `${TEST_PASSWORD}-wrong`;

// seedTestUser inserts the user, read the username back from the DB
const seedUser = async () => {
  const { userId, sessionId } = await seedTestUser();
  const { username } = await db.one(
    "SELECT username FROM auth WHERE id = $1",
    userId,
  );
  return { userId, sessionId, username };
};

const sessionsFor = (userId: string) =>
  db.any("SELECT session_id FROM sessions WHERE user_id = $1", userId);

it("signs in with correct credentials and returns a session", async () => {
  const { userId, username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });

  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ userId, username });
  expect(response.body.sessionId).toBeDefined();
  expect(response.body.expiresAt).toBeDefined();
});

it("stores the returned session id for that user", async () => {
  const { userId, username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });

  const row = await db.oneOrNone(
    "SELECT user_id FROM sessions WHERE session_id = $1",
    response.body.sessionId,
  );
  expect(row).not.toBeNull();
  expect(row.user_id).toBe(userId);
});

it("returns an expiry in the future that matches the stored session", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });

  const row = await db.one(
    "SELECT expires_at FROM sessions WHERE session_id = $1",
    response.body.sessionId,
  );

  const returned = new Date(response.body.expiresAt).getTime();
  expect(returned).toBe(new Date(row.expires_at).getTime());
  expect(returned).toBeGreaterThan(Date.now());
});

it("returns no password data on success", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });

  expect(response.body).not.toHaveProperty("password");
  expect(response.body).not.toHaveProperty("password_hash");
  expect(response.body).not.toHaveProperty("passwordHash");
  expect(response.text).not.toContain(TEST_PASSWORD);
});

it("adds a new session without removing the one already in the database", async () => {
  //Adds new seesion without removing any from the database
  const { userId, sessionId, username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });

  const sessions = await sessionsFor(userId);
  expect(sessions).toHaveLength(2);
  expect(sessions).toContainEqual({ session_id: sessionId });
  expect(sessions).toContainEqual({ session_id: response.body.sessionId });
});

it("creates a different session id for each sign-in", async () => {
  const { username } = await seedUser();

  const first = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });
  const second = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: TEST_PASSWORD });

  expect(first.body.sessionId).not.toBe(second.body.sessionId);
});

it("rejects a wrong password and creates no session", async () => {
  const { userId, username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: WRONG_PASSWORD });

  expect(response.status).toBe(403);
  expect(response.body.sessionId).toBeUndefined();
  expect(await sessionsFor(userId)).toHaveLength(1);
});

it("rejects an unknown username", async () => {
  await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username: "nobody-here", password: TEST_PASSWORD });

  expect(response.status).toBe(403);
  expect(response.body.sessionId).toBeUndefined();
});

it("gives an identical error for unknown username and wrong password", async () => {
  const { username } = await seedUser();

  const wrongPassword = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username, password: WRONG_PASSWORD });
  const unknownUser = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username: "nobody-here", password: TEST_PASSWORD });

  expect(unknownUser.body).toEqual({
    error: "Incorrect username or password.",
  });
  expect(wrongPassword.body).toEqual({
    error: "Incorrect username or password.",
  });
});

it("rejects a request missing the username", async () => {
  await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ password: TEST_PASSWORD });

  expect(response.status).toBe(400);
});

it("rejects a request missing the password", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username });

  expect(response.status).toBe(400);
});

it("rejects a request with no body", async () => {
  const response = await request(app).post(AUTH_ROUTES.LOGIN).send();

  expect(response.status).toBe(400);
});

it("does not crash on non-string credentials", async () => {
  await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.LOGIN)
    .send({ username: { $ne: null }, password: ["a", "b"] });

  expect(response.status).toBe(400);
});
