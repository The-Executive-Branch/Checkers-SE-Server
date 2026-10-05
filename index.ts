import express, { type Express, type Request, type Response } from "express";
import pgPromise from "pg-promise";

const pgp = pgPromise();
const db = pgp("postgresql://teb@localhost:5432/checkers");

const app: Express = express();
const PORT = 3000;

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

// AUTH ROUTES
app.post("/auth/register", (req: Request, res: Response) => {
  // TODO
  db.one(
    "INSERT INTO auth (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    ["bob", "bob@example.com", "unique_hash"],
  )
    .then(console.log)
    .catch(console.log);
});

app.post("/auth/unregister", (req: Request, res: Response) => {
  // TODO
});

app.post("/auth/login", (req: Request, res: Response) => {
  // TODO
});

app.post("/auth/logout", (req: Request, res: Response) => {
  // TODO
});

app.listen(PORT, () => {
  console.log(`Checkers server listening on port ${PORT}`);
});
