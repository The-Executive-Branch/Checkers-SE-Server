import { it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import type { GameId, ServerMessage } from "checkers-shared-types";
import GameServer from "../../src/websocket/gameServer.ts";
import { attachGameServer } from "../../src/websocket/server.ts";

let httpServer: Server;

afterEach(() => new Promise<void>((resolve) => httpServer.close(() => resolve())));

const start = async () => {
  httpServer = createServer();
  const gameServer = new GameServer(
    async (sessionId) => (sessionId === "good" ? { userId: "u1", username: "ravae" } : null),
    () => "game-1" as GameId,
  );
  attachGameServer(httpServer, gameServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  return `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}/game`;
};

const nextMessage = (socket: WebSocket) =>
  new Promise<ServerMessage>((resolve) =>
    socket.once("message", (data) => resolve(JSON.parse(data.toString()))),
  );

it("carries messages over a real WebSocket connection", async () => {
  // Arrange
  const url = await start();
  const socket = new WebSocket(url);
  await new Promise((resolve) => socket.once("open", resolve));
  // Act
  socket.send(JSON.stringify({ type: "authenticate", sessionId: "good" }));
  const authenticated = await nextMessage(socket);
  socket.send(JSON.stringify({ type: "createGame", mode: { type: "local", guestName: "Sam" } }));
  const state = await nextMessage(socket);
  // Assert
  expect(authenticated).toEqual({ type: "authenticated", userId: "u1", username: "ravae" });
  expect(state).toMatchObject({ type: "gameState", gameId: "game-1", mode: "local" });
  socket.close();
});

it("closes a real connection whose session is invalid", async () => {
  // Arrange
  const url = await start();
  const socket = new WebSocket(url);
  await new Promise((resolve) => socket.once("open", resolve));
  // Act
  socket.send(JSON.stringify({ type: "authenticate", sessionId: "bad" }));
  const code = await new Promise<number>((resolve) => socket.once("close", resolve));
  // Assert
  expect(code).toBe(4401);
});
