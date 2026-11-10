import type { ClientMessage, GameId, Position } from "checkers-shared-types";

// Messages arrive as text from outside the server, so their shape is
// checked here before anything else trusts them.

type Unknown = Record<string, unknown>;

const isObject = (value: unknown): value is Unknown =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPosition = (value: unknown): value is Position =>
  isObject(value) &&
  Number.isInteger(value.row) &&
  Number.isInteger(value.col);

const parseMode = (mode: unknown) => {
  if (!isObject(mode)) return null;
  if (mode.type === "local" && isString(mode.guestName))
    return { type: "local" as const, guestName: mode.guestName.trim() };
  if (mode.type === "online" && mode.isPrivate === false)
    return { type: "online" as const, isPrivate: false as const };
  if (
    mode.type === "online" &&
    mode.isPrivate === true &&
    isString(mode.opponentUsername)
  )
    return {
      type: "online" as const,
      isPrivate: true as const,
      opponentUsername: mode.opponentUsername.trim().toLowerCase(),
    };
  return null;
};

export const CLIENT_MESSAGE_TYPES = [
  "authenticate",
  "createGame",
  "join",
  "declineInvite",
  "listOpenGames",
  "move",
] as const satisfies readonly ClientMessage["type"][];

export const isClientMessageType = (
  type: unknown,
): type is ClientMessage["type"] =>
  CLIENT_MESSAGE_TYPES.includes(type as ClientMessage["type"]);

// Returns the message, or null when it isn't a valid ClientMessage.
export const parseClientMessage = (raw: string): ClientMessage | null => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data)) return null;

  switch (data.type) {
    case "authenticate":
      return isString(data.sessionId)
        ? { type: "authenticate", sessionId: data.sessionId }
        : null;
    case "createGame": {
      const mode = parseMode(data.mode);
      return mode ? { type: "createGame", mode } : null;
    }
    case "join":
    case "declineInvite":
      return isString(data.gameId)
        ? { type: data.type, gameId: data.gameId as GameId }
        : null;
    case "listOpenGames":
      return { type: "listOpenGames" };
    case "move":
      return isString(data.gameId) && isPosition(data.from) && isPosition(data.to)
        ? {
            type: "move",
            gameId: data.gameId as GameId,
            from: { row: data.from.row, col: data.from.col },
            to: { row: data.to.row, col: data.to.col },
          }
        : null;
    default:
      return null;
  }
};
