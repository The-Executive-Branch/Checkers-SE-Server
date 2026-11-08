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

const getGames = (authorization?: string) => {
  const req = request(app).get(GAME_ROUTES.LIST);
  return authorization ? req.set("Authorization", authorization) : req;
};

const seedPlayerWithGame = async (options: { expired?: boolean } = {}) => {
  const player = await seedPlayer(options);
  const opponent = await seedPlayer();
  await seedGame(
    player.userId,
    opponent.userId,
    gameData(userPlayer(player.username), userPlayer(opponent.username)),
  );
  return player;
};

it("returns every game the player played as red or black", async () => {
  const player = await seedPlayer();
  const opponent = await seedPlayer();

  // player is red in one game, black in the other
  const asRedData = gameData(
    userPlayer(player.username),
    userPlayer(opponent.username),
  );
  const asBlackData = gameData(
    userPlayer(opponent.username),
    userPlayer(player.username),
  );
  const asRedId = await seedGame(player.userId, opponent.userId, asRedData);
  const asBlackId = await seedGame(opponent.userId, player.userId, asBlackData);

  const response = await getGames(`Bearer ${player.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(2);
  expect(response.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        gameId: asRedId,
        ...asRedData,
        endedAt: expect.any(String),
      }),
      expect.objectContaining({
        gameId: asBlackId,
        ...asBlackData,
        endedAt: expect.any(String),
      }),
    ]),
  );
});

it("lists the player's games newest first", async () => {
  const player = await seedPlayer();
  const opponent = await seedPlayer();
  const data = gameData(
    userPlayer(player.username),
    userPlayer(opponent.username),
  );

  const oldest = await seedGame(
    player.userId,
    opponent.userId,
    data,
    new Date("2026-01-01T00:00:00Z"),
  );
  const newest = await seedGame(
    player.userId,
    opponent.userId,
    data,
    new Date("2026-03-01T00:00:00Z"),
  );
  const middle = await seedGame(
    player.userId,
    opponent.userId,
    data,
    new Date("2026-02-01T00:00:00Z"),
  );

  const response = await getGames(`Bearer ${player.sessionId}`);

  expect(response.status).toBe(200);
  expect(
    response.body.data.map((game: { gameId: string }) => game.gameId),
  ).toEqual([newest, middle, oldest]);
});

it("returns an empty list to a player with no saved games", async () => {
  const player = await seedPlayer();
  const response = await getGames(`Bearer ${player.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

it("leaves out games played between other players", async () => {
  const player = await seedPlayer();
  const opponent = await seedPlayer();
  const otherRed = await seedPlayer();
  const otherBlack = await seedPlayer();

  // one game that includes player
  const ownId = await seedGame(
    player.userId,
    opponent.userId,
    gameData(userPlayer(player.username), userPlayer(opponent.username)),
  );
  // one game player had nothing to do with
  await seedGame(
    otherRed.userId,
    otherBlack.userId,
    gameData(userPlayer(otherRed.username), userPlayer(otherBlack.username)),
  );

  const response = await getGames(`Bearer ${player.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(1);
  expect(response.body.data[0].gameId).toBe(ownId);
});

it("rejects a request with no Authorization header", async () => {
  await seedPlayerWithGame();

  const response = await getGames();

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("rejects a header that is not a Bearer token", async () => {
  const player = await seedPlayerWithGame();

  const response = await getGames(`Basic ${player.sessionId}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("rejects an unknown session id", async () => {
  await seedPlayerWithGame();

  const response = await getGames(`Bearer ${randomUUID()}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("rejects an expired session", async () => {
  const player = await seedPlayerWithGame({ expired: true }); // session expired yesterday

  const response = await getGames(`Bearer ${player.sessionId}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: ERRORS.UNAUTHORIZED });
});

it("returns no user ids or database column names", async () => {
  const player = await seedPlayerWithGame();

  const response = await getGames(`Bearer ${player.sessionId}`);

  expect(response.status).toBe(200);
  for (const column of [
    "game_id",
    "game_data",
    "ended_at",
    "red_user_id",
    "black_user_id",
  ]) {
    expect(response.body.data[0]).not.toHaveProperty(column);
  }
  // the player's id appears nowhere in the raw response text
  expect(response.text).not.toContain(player.userId);
});
