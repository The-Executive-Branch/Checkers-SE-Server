import { it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.ts";
import { seedTestUser, AUTH_ROUTES, addDeviceSession } from "./helpers.ts";
import { db } from "../db.ts";

it("removes only the session for current device", async () => {
  const { userId, sessionId } = await seedTestUser();
  const response = await request(app)
    .post(AUTH_ROUTES.LOGOUT)
    .set("Authorization", `Bearer ${sessionId}`)
    .send();

  const secondSessionId = await addDeviceSession(userId);

  expect(response.status).toBe(204);

  const sessions = await db.any(
    "SELECT session_id FROM sessions WHERE user_id = $1",
    userId,
  );

  expect(sessions).toEqual([{ session_id: secondSessionId }]);
});

it("returns no content status code if header is invalid", async () => {
  const { userId, sessionId } = await seedTestUser();
  const response = await request(app)
    .post(AUTH_ROUTES.LOGOUT)
    .set("Authorization", `Basic ${sessionId}`)
    .send();

  expect(response.status).toBe(204);
});

it("returns no content status code if the session does not exist", async () => {
  const { userId, sessionId } = await seedTestUser();
  const response = await request(app)
    .post(AUTH_ROUTES.LOGOUT)
    .set("Authorization", `Bearer ${sessionId}-secondary`)
    .send();

  expect(response.status).toBe(204);
});

it("accepts a valid session and removes it from the database, returning no content status code", async () => {
  const { userId, sessionId } = await seedTestUser();
  const response = await request(app)
    .post(AUTH_ROUTES.LOGOUT)
    .set("Authorization", `Bearer ${sessionId}`)
    .send();

  expect(response.status).toBe(204);

  const sessions = await db.any(
    "SELECT session_id FROM sessions WHERE user_id = $1",
    userId,
  );
  expect(sessions).toEqual([]);
});
