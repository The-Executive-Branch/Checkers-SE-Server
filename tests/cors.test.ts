import { it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.ts";
import { AUTH_ROUTES } from "./helpers.ts";

const ALLOWED_ORIGIN = "http://localhost:5173";

it("accepts a request with PREFLIGHT options", async () => {
  const response = await request(app)
    .options(AUTH_ROUTES.LOGOUT)
    .set("Origin", ALLOWED_ORIGIN)
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "authorization, content-type");

  expect(response.status).toBe(204);
  expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  expect(response.headers["access-control-allow-methods"]).toContain("POST");
  expect(
    response.headers["access-control-allow-headers"]?.toLowerCase(),
  ).toContain("authorization");
});

it("accepts a POST request from an allowed origin and responds with origin in access-control-allow-origin header", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.LOGOUT)
    .set("Origin", ALLOWED_ORIGIN)
    .send();

  expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
});

it("does not allow an origin outside the list", async () => {
  const response = await request(app)
    .post(AUTH_ROUTES.LOGOUT)
    .set("Origin", "http://not-allowed.example")
    .send();

  expect(response.headers["access-control-allow-origin"]).toBeUndefined();
});
