import { db } from "./db.ts";
import { randomUUID } from "node:crypto";

type Email = string & { __brand: "Email" };
type Username = string & { __brand: "Username" };
type Password = string & { __brand: "Password" };
type ParseError = {
  error: string;
  field: string;
};

export const parseEmail = (input: string): Email | ParseError => {
  if (typeof input !== "string") {
    return {
      error: "Email is required.",
      field: "Email",
    };
  }

  const email = input.trim().toLowerCase();

  if (email.length === 0) {
    return {
      error: "Email is required.",
      field: "Email",
    };
  }

  return email as Email;
};

export const parseUsername = (input: String): Username | ParseError => {
  if (typeof input !== "string") {
    return {
      error: "Username is required.",
      field: "Username",
    };
  }

  const username = input.trim().toLowerCase();

  if (username.length < 3 || username.length > 30)
    return {
      error: "Username must be between 3 and 30 characters long.",
      field: "Username",
    };
  return username as Username;
};

export const parsePassword = (input: String): Password | ParseError => {
  if (typeof input !== "string") {
    return {
      error: "Password is required.",
      field: "Password",
    };
  }

  const password = input.trim().toLowerCase();

  if (password.length < 8 || password.length > 100) {
    return {
      error: "Password must be between 8 and 100 characters long.",
      field: "Password",
    };
  }
  return password as Password;
};

export const createSession = async (userId: string) => {
  const sessionId = randomUUID();
  const row = await db.one(
    "INSERT INTO sessions (session_id, user_id) VALUES ($1, $2) RETURNING expires_at",
    [sessionId, userId],
  );
  return { sessionId, expiresAt: row.expires_at };
};

export function isParseError(value: unknown): value is ParseError {
  return typeof value === "object" && value !== null;
}
