import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import type GameServer from "./gameServer.ts";
import type { Client } from "./gameServer.ts";

// Attaches the game's WebSocket endpoint to the existing HTTP server,
// and adapts each real socket to the Client shape GameServer expects.
export const attachGameServer = (
  httpServer: Server,
  gameServer: GameServer,
  path = "/game",
): WebSocketServer => {
  const wss = new WebSocketServer({ server: httpServer, path });

  wss.on("connection", (socket) => {
    const client: Client = {
      send: (message) => socket.send(JSON.stringify(message)),
      close: (code, reason) => socket.close(code, reason),
    };

    socket.on("message", (data) => {
      gameServer.handleMessage(client, data.toString()).catch((error) => {
        console.error("Game server error:", error);
      });
    });
    socket.on("close", () => gameServer.disconnect(client));
  });

  return wss;
};
