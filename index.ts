import express, { type Express, type Request, type Response } from "express";
import pgPromise from "pg-promise";
import type {
  ErrorResponse,
  UnregisterUserRequest,
} from "../Checkers-SE-Shared/auth";
import bcrypt from "bcrypt";

const pgp = pgPromise();
const db = pgp(process.env.DATABASE_URL!);

const PORT = Number(process.env.PORT) || 3000;
const app: Express = express();

app.use(express.json());

const ERRORS = {
  UNAUTHORIZED: "You are not signed in. Please sign in and try again.",
  SERVER: "Something went wrong. Please try again.",
} as const;

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

// AUTH ROUTES
app.post("/auth/register", (req: Request, res: Response) => {
  // TODO
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

app.post("/auth/login", (req: Request, res: Response) => {
  // TODO
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

app.listen(process.env.PORT, () => {
  console.log(`Checkers server listening on port ${PORT}`);
});
