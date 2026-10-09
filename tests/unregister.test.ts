import { it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.ts";
import { seedTestUser, AUTH_ROUTES, TEST_PASSWORD } from "./helpers.ts";
import { db } from "../db.ts";

it("rejects a request with no Authorization header", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .send({ passwordConfirmation: "anything" });

  expect(response.status).toBe(401);
});

it("rejects a wrong password and keeps the account", async () => {
  const { userId, sessionId } = await seedTestUser();

  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", `Bearer ${sessionId}`)
    .send({ passwordConfirmation: "wrong-password" });

  expect(response.status).toBe(403);

  const user = await db.oneOrNone("SELECT id FROM auth WHERE id = $1", userId);
  expect(user).not.toBeNull();
});

it("rejects an invalid header and keeps the account", async () => {
  const { userId, sessionId } = await seedTestUser();

  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", `Basic ${sessionId}`)
    .send({ passwordConfirmation: TEST_PASSWORD });

  expect(response.status).toBe(401);

  const user = await db.oneOrNone("SELECT id FROM auth WHERE id = $1", userId);
  expect(user).not.toBeNull();
});

it("rejects a Bearer header with no session id", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", "Bearer")
    .send({ passwordConfirmation: TEST_PASSWORD });

  expect(response.status).toBe(401);
});

it("rejects an unknown session id and keeps the account", async () => {
  const { userId, sessionId } = await seedTestUser();

  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", `Bearer unknown-${sessionId}`)
    .send({ passwordConfirmation: TEST_PASSWORD });

  expect(response.status).toBe(401);

  const user = await db.oneOrNone("SELECT id FROM auth WHERE id = $1", userId);
  expect(user).not.toBeNull();
});

it("rejects an expired session and keeps the account", async () => {
  const { userId, sessionId } = await seedTestUser({ expired: true });

  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", `Bearer ${sessionId}`)
    .send({ passwordConfirmation: TEST_PASSWORD });

  expect(response.status).toBe(401);

  const user = await db.oneOrNone("SELECT id FROM auth WHERE id = $1", userId);
  expect(user).not.toBeNull();
});

it("rejects a valid session with no password and keeps the account", async () => {
  const { userId, sessionId } = await seedTestUser();

  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", `Bearer ${sessionId}`)
    .send({ passwordConfirmation: "" });

  expect(response.status).toBe(400);
  expect(response.body.field).toBe("passwordConfirmation");

  const user = await db.oneOrNone("SELECT id FROM auth WHERE id = $1", userId);
  expect(user).not.toBeNull();
});

it("accepts a valid session with the correct password and deletes the account", async () => {
  const { userId, sessionId } = await seedTestUser();

  const response = await request(app)
    .post(AUTH_ROUTES.UNREGISTER)
    .set("Authorization", `Bearer ${sessionId}`)
    .send({ passwordConfirmation: TEST_PASSWORD });
  expect(response.status).toBe(204);

  const user = await db.oneOrNone("SELECT id FROM auth WHERE id = $1", userId);
  expect(user).toBeNull();

  const sessions = await db.any(
    "SELECT session_id FROM sessions WHERE user_id = $1",
    userId,
  );
  expect(sessions).toEqual([]);
});
