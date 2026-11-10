import { it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { GameId } from "checkers-shared-types";
import { app } from "../src/app.ts";
import Game from "../src/models/game.ts";
import { saveGameRecord } from "../src/save_game.ts";
import { GAME_ROUTES, seedPlayer, userPlayer } from "./helpers.ts";
import { FINISHED_GAME_MOVES } from "./fixtures/finishedGame.ts";

// The whole path a replay depends on: a game played on the server, saved,
// then loaded by the player. What comes back must be exactly what was played.
it("loads a finished game back with every move as it was played", async () => {
  // Arrange
  const red = await seedPlayer();
  const black = await seedPlayer();
  const game = new Game({
    id: randomUUID() as GameId,
    mode: "online",
    red: userPlayer(red.username),
    black: userPlayer(black.username),
  });
  for (const { from, to } of FINISHED_GAME_MOVES) game.applyMove(game.getTurn(), from, to);
  const record = game.toGameRecord()!;

  // Act
  await saveGameRecord(record);
  const res = await request(app)
    .get(GAME_ROUTES.LIST)
    .set("Authorization", `Bearer ${red.sessionId}`);

  // Assert
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0]).toMatchObject({
    gameId: record.gameId,
    players: record.players,
    winner: record.winner,
    moves: record.moves,
  });
});
