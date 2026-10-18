import { it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.ts";
import { seedTestUser, AUTH_ROUTES, TEST_PASSWORD } from "./helpers.ts";
import { db } from "../db.ts";

// seedTestUser inserts the user; read the username back from the DB
const seedUser = async () => {
  const { userId } = await seedTestUser();
  const { username } = await db.one(
    "SELECT username FROM auth WHERE id = $1",
    userId,
  );
  return { userId, username };
};

it("returns available: true for a username no account uses", async () => {
  await seedTestUser(); // table isn't empty, so "true" isn't just an empty-table result

  const response = await request(app)
    .post(AUTH_ROUTES.USERNAME_AVAILABLE)
    .send({ username: "Newuser42" });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ available: true });
});

it("returns available: false for a username an account already uses", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.USERNAME_AVAILABLE)
    .send({ username });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ available: false });
});

it("returns available: false for an existing username in different letter case", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.USERNAME_AVAILABLE)
    .send({ username: username.toUpperCase() });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ available: false });
});

it.each([
  ["missing", undefined],
  ["too short", "ab"],
  ["too long", "a".repeat(31)],
  ["not a string", 12345],
])(
  "returns 400 naming the field when the username is %s",
  async (_, username) => {
    const response = await request(app)
      .post(AUTH_ROUTES.USERNAME_AVAILABLE)
      .send({ username });

    expect(response.status).toBe(400);
    expect(response.body.field).toMatch(/username/i);
  },
);

it("works without an Authorization header", async () => {
  const { username } = await seedUser();

  const response = await request(app)
    .post(AUTH_ROUTES.USERNAME_AVAILABLE)
    .send({ username });

  expect(response.status).toBe(200);
});
