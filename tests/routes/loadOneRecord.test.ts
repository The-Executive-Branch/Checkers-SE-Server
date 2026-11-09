import { it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.ts";
import { ERRORS } from "../../src/errors.ts";
import {
  GAME_ROUTES,
  seedPlayer,
  seedGame,
  gameData,
  userPlayer,
} from "../helpers.ts";

const NOT_FOUND = { error: "Game not found." };

const getGame = (gameId: string, authorization?: string) => {
  const req = request(app).get(GAME_ROUTES.ONE(gameId));
  return authorization ? req.set("Authorization", authorization) : req;
};

const seedTwoPlayerGame = async (options: { expired?: boolean } = {}) => {
  const red = await seedPlayer(options);
  const black = await seedPlayer();
  const data = gameData(userPlayer(red.username), userPlayer(black.username));
  const gameId = await seedGame(red.userId, black.userId, data);
  return { red, black, data, gameId };
};

it("returns the full game record to the red player", async () => {
  const { red, data, gameId } = await seedTwoPlayerGame();

  const response = await getGame(gameId, `Bearer ${red.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ gameId, ...data });
  expect(response.body.data.endedAt).toEqual(expect.any(String));
});

it("returns the full game record to the black player", async () => {
  const { black, data, gameId } = await seedTwoPlayerGame();

  const response = await getGame(gameId, `Bearer ${black.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ gameId, ...data });
  expect(response.body.data.endedAt).toEqual(expect.any(String));
});

it("returns a game played against a guest with the guest's name", async () => {
  const red = await seedPlayer();
  const data = gameData(userPlayer(red.username), {
    kind: "guest",
    name: "Uncle Donte",
  });
  const gameId = await seedGame(red.userId, null, data);

  const response = await getGame(gameId, `Bearer ${red.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body.data.players.black).toEqual({
    kind: "guest",
    name: "Uncle Donte",
  });
});

it("returns not found to a player who did not play in the game", async () => {
  const { gameId } = await seedTwoPlayerGame();
  const outsider = await seedPlayer();

  const response = await getGame(gameId, `Bearer ${outsider.sessionId}`);

  expect(response.status).toBe(404);
  expect(response.body).toEqual(NOT_FOUND);
});

it("returns not found for a game id that does not exist", async () => {
  const player = await seedPlayer();

  const response = await getGame(randomUUID(), `Bearer ${player.sessionId}`);

  expect(response.status).toBe(404);
  expect(response.body).toEqual(NOT_FOUND);
});

it("rejects a request with no Authorization header", async () => {
  const { gameId } = await seedTwoPlayerGame();

  const response = await getGame(gameId);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("rejects a header that is not a Bearer token", async () => {
  const { red, gameId } = await seedTwoPlayerGame();

  const response = await getGame(gameId, `Basic ${red.sessionId}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("rejects an unknown session id", async () => {
  const { gameId } = await seedTwoPlayerGame();

  const response = await getGame(gameId, `Bearer ${randomUUID()}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("rejects an expired session", async () => {
  const { red, gameId } = await seedTwoPlayerGame({ expired: true });

  const response = await getGame(gameId, `Bearer ${red.sessionId}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("returns no user ids or database column names", async () => {
  const { red, gameId } = await seedTwoPlayerGame();

  const response = await getGame(gameId, `Bearer ${red.sessionId}`);

  expect(response.status).toBe(200);
  for (const column of [
    "game_id",
    "game_data",
    "ended_at",
    "red_user_id",
    "black_user_id",
  ]) {
    expect(response.body.data).not.toHaveProperty(column);
  }
  // the player's id appears nowhere in the raw response text
  expect(response.text).not.toContain(red.userId);
});
