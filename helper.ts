import { db } from "./db.ts";
import { randomUUID } from "node:crypto";

type Email = string & { __brand: "Email" };
type Username = string & { __brand: "Username" };
type Password = string & { __brand: "Password" };

export const parseEmail = (email: String): Email => {
  if (typeof email !== "string") {
    throw new Error("Invalid email format.");
  }
  return email as Email;
};

export const parseUsername = (username: String): Username => {
  if (
    typeof username !== "string" ||
    username.length < 3 ||
    username.length > 30
  ) {
    throw new Error("Username must be between 3 and 30 characters long.");
  }
  return username as Username;
};

export const parsePassword = (password: String): Password => {
  if (typeof password !== "string" || password.length < 10) {
    throw new Error("Password must be at least 10 characters long.");
  }
  return password as Password;
};

export const CreateSession = async (userId: string) => {
  const sessionId = randomUUID();
  await db.none(
    "INSERT INTO sessions (session_id, user_id, expires_at) VALUES ($1, $2, $3)",
    [sessionId, userId],
  );

  return sessionId;
};
