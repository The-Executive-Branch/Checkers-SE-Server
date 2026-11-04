import bcrypt from "bcrypt";
import { Router, type Request, type Response } from "express";
import { db } from "../db.ts";
import { createSession } from "../sessions/index.ts";
import {
  isParseError,
  isUniqueViolation,
  parseEmail,
  parsePassword,
  parseUsername,
} from "../helper.ts";
import { ERRORS } from "../errors.ts";

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  //Ensuring the data entered is valid and changing it to the correct types
  try {
    const email = parseEmail(req.body?.email);
    const username = parseUsername(req.body?.username);
    const password = parsePassword(req.body?.password);

    if (isParseError(username)) return res.status(400).send(username);
    if (isParseError(email)) return res.status(400).send(email);
    if (isParseError(password)) return res.status(400).send(password);

    // Hash the password and insert the new user into the database
    const passwordHash = bcrypt.hashSync(password, 10);
    const row = await db.one(
      "INSERT INTO auth (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, username, passwordHash],
    );

    // Create a new session for the user and return the session ID
    const sessionRow = await createSession(row.id);

    // Return the session ID to the client
    res.status(201).send({
      userId: row.id,
      username,
      sessionId: sessionRow.sessionId,
      expiresAt: sessionRow.expiresAt,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const field =
        error.constraint === "auth_email_key" ? "email" : "username";
      return res
        .status(409)
        .send({ error: `That ${field} is already taken.`, field });
    }

    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER });
  }
});

authRouter.post("/unregister", async (req: Request, res: Response) => {
  // Verify session ID exists inside request headers
  const [scheme, sessionId] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !sessionId)
    return res.status(401).send({ error: ERRORS.UNAUTHORIZED }); // UNAUTHORIZED

  try {
    // Verify session exists in database
    const session = await db.oneOrNone(
      "SELECT user_id FROM sessions WHERE session_id = $1 AND expires_at > now()",
      sessionId,
    );

    if (!session) return res.status(401).send({ error: ERRORS.UNAUTHORIZED }); // UNAUTHORIZED

    // Verify the confirmation password exists on the request body
    const passwordConfirmation = req.body?.passwordConfirmation;

    if (
      typeof passwordConfirmation !== "string" ||
      passwordConfirmation.length === 0
    ) {
      return res
        .status(400)
        .send({ error: "Password is required", field: "passwordConfirmation" });
    }

    // Verify password confirmation matches password in database
    const { user_id } = session;
    const row = await db.oneOrNone(
      "SELECT password_hash FROM auth WHERE id = $1",
      user_id,
    );

    const pwMatched = await bcrypt.compare(
      passwordConfirmation,
      row.password_hash,
    );

    if (!pwMatched)
      return res.status(403).send({ error: "Incorrect password." }); // FORBIDDEN

    // Remove user from auth table and sessions for sessions table.
    // Tables are linked by foreign key and sessions cascade delete when users are deleted.
    await db.none("DELETE FROM auth WHERE id = $1", user_id);

    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER }); // INTERNAL SERVER ERROR
  }
});

authRouter.post("/logout", async (req: Request, res: Response) => {
  const [scheme, sessionId] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !sessionId) return res.sendStatus(204);

  try {
    await db.none("DELETE FROM sessions WHERE session_id = $1", sessionId);
    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER }); // INTERNAL SERVER ERROR
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const username = parseUsername(req.body?.username);
    const password = parsePassword(req.body?.password);

    if (isParseError(username)) return res.status(400).send(username);
    if (isParseError(password)) return res.status(400).send(password);

    const row = await db.oneOrNone(
      "SELECT id, password_hash FROM auth WHERE username = $1",
      [username],
    );

    if (!row) {
      return res.status(403).send({ error: "Incorrect username or password." }); // FORBIDDEN
    }

    const pwMatched = await bcrypt.compare(password, row.password_hash);

    if (!pwMatched) {
      return res.status(403).send({ error: "Incorrect username or password." }); // FORBIDDEN
    }

    const sessionRow = await createSession(row.id);

    res.send({
      userId: row.id,
      username,
      sessionId: sessionRow.sessionId,
      expiresAt: sessionRow.expiresAt,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER }); // INTERNAL SERVER ERROR
  }
});

authRouter.post("/username-available", async (req: Request, res: Response) => {
  try {
    const username = parseUsername(req.body?.username);

    if (isParseError(username)) return res.status(400).send(username);

    const row = await db.oneOrNone("SELECT id FROM auth WHERE username = $1", [
      username,
    ]);

    if (row) {
      return res.status(200).send({ available: false }); // CONFLICT
    } else {
      res.status(200).send({ available: true });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER }); // INTERNAL SERVER ERROR
  }
});
