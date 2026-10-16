import express, { type Express, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import cors, { type CorsOptions } from "cors";
import { db } from "./db.ts";
import {
  parseEmail,
  parsePassword,
  parseUsername,
  createSession,
  isParseError,
} from "./helper.ts";

const app: Express = express();
app.use(express.json());

const origins = (process.env.CORS_ORIGINS ?? "http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim());

const corsOptions: CorsOptions = {
  origin: origins,
  methods: "POST",
  allowedHeaders: ["Authorization", "Content-Type"],
};
app.use(cors(corsOptions));

const ERRORS = {
  UNAUTHORIZED: "You are not signed in. Please sign in and try again.",
  SERVER: "Something went wrong. Please try again.",
} as const;

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

// AUTH ROUTES
app.post("/auth/register", async (req: Request, res: Response) => {
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
    const sessionId = await createSession(row.id);

    // Return the session ID to the client
    res.status(201).send({
      userId: row.userId,
      username,
      sessionId: sessionId.sessionId,
      expiresAt: sessionId.expiresAt,
    });
  } catch (error) {
    //error type return from PG promise
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER });
  }
});

app.post("/auth/unregister", async (req: Request, res: Response) => {
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

app.post("/auth/logout", async (req: Request, res: Response) => {
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

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const username = parseUsername(req.body?.username);
    const password = parsePassword(req.body?.password);

    const row = await db.oneOrNone(
      "SELECT id, password_hash FROM auth WHERE username = $1",
      [username],
    );

    if (!row) {
      return res
        .status(403)
        .send({ error: "Incorrect username or password.", field: "username" }); // FORBIDDEN
    }

    if ("error" in username || "error" in password)
      return res.status(400).send({ error: "Invalid input" });

    const pwMatched = await bcrypt.compare(password, row.password_hash);

    if (!pwMatched) {
      return res.status(403).send({ error: "Incorrect username or password." }); // FORBIDDEN
    }

    const sessionId = await createSession(row.id);

    res.status(201).send({
      userId: row.userId,
      username,
      sessionId: sessionId.sessionId,
      expiresAt: sessionId.expiresAt,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: ERRORS.SERVER }); // INTERNAL SERVER ERROR
  }
});

export { app };
