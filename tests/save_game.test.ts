import { it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { GameId, GameRecord, Player } from "checkers-shared-types";
import { app } from "../src/app.ts";
import { db } from "../src/db.ts";
import { saveGameRecord } from "../src/save_game.ts";
import { GAME_ROUTES, seedPlayer, userPlayer } from "./helpers.ts";

// A finished game
const makeRecord = (red: Player, black: Player): GameRecord => ({
  gameId: randomUUID() as GameId,
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

const findRow = (gameId: string) =>
  db.oneOrNone("SELECT * FROM game_records WHERE game_id = $1", [gameId]);

it("saves a game between two players under each player's account", async () => {
  const red = await seedPlayer();
  const black = await seedPlayer();
  const record = makeRecord(
    userPlayer(red.username),
    userPlayer(black.username),
  );

  await saveGameRecord(record);

  const row = await findRow(record.gameId);
  expect(row).not.toBeNull();
  expect(row.red_user_id).toBe(red.userId);
  expect(row.black_user_id).toBe(black.userId);
  expect(row.game_data).toEqual({
    players: record.players,
    winner: record.winner,
    moves: record.moves,
  });
});

it("saves a game against a guest without tying the guest to any account", async () => {
  const red = await seedPlayer();
  const guest: Player = { kind: "guest", name: "Uncle Donte" };
  const record = makeRecord(userPlayer(red.username), guest);

  await saveGameRecord(record);

  const row = await findRow(record.gameId);
  expect(row.red_user_id).toBe(red.userId);
  expect(row.black_user_id).toBeNull();
  expect(row.game_data.players.black).toEqual(guest);
});

it("sets the end time to when the game was saved", async () => {
  const red = await seedPlayer();
  const black = await seedPlayer();
  const record = makeRecord(
    userPlayer(red.username),
    userPlayer(black.username),
  );

  await saveGameRecord(record);

  const row = await findRow(record.gameId);
  const secondsAgo = (Date.now() - row.ended_at.getTime()) / 1000;
  expect(secondsAgo).toBeLessThan(60);
});

it("rejects a game id that is already saved and keeps the original", async () => {
  const red = await seedPlayer();
  const black = await seedPlayer();
  const original = makeRecord(
    userPlayer(red.username),
    userPlayer(black.username),
  );
  await saveGameRecord(original);

  const duplicate: GameRecord = { ...original, winner: "black", moves: [] };

  await expect(saveGameRecord(duplicate)).rejects.toThrow();

  const row = await findRow(original.gameId);
  expect(row.game_data.winner).toBe("red");
  expect(row.game_data.moves).toEqual(original.moves);
});

it("returns the saved players, winner, and moves when a player loads the game", async () => {
  const red = await seedPlayer();
  const black = await seedPlayer();
  const record = makeRecord(
    userPlayer(red.username),
    userPlayer(black.username),
  );

  await saveGameRecord(record);
  const response = await request(app)
    .get(GAME_ROUTES.ONE(record.gameId))
    .set("Authorization", `Bearer ${black.sessionId}`);

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject(record);
});
