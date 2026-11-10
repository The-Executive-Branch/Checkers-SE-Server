import { app } from "./app.ts";
import GameServer from "./websocket/gameServer.ts";
import { attachGameServer } from "./websocket/server.ts";
import { findUserBySession } from "./sessions/findUserBySession.ts";
import { saveGameRecord } from "./save_game.ts";

const PORT = Number(process.env.PORT) || 8000;

const server = app.listen(PORT, () => {
  console.log(`Checkers server listening on port ${PORT}`);
});

attachGameServer(
  server,
  new GameServer(findUserBySession, undefined, saveGameRecord),
);
