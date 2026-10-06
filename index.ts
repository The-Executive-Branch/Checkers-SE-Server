import express, { type Express, type Request, type Response } from "express";
import pgPromise from "pg-promise";

const pgp = pgPromise();
const db = pgp(process.env.DATABASE_URL!);

const PORT = Number(process.env.PORT) || 3000;
const app: Express = express();

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

// AUTH ROUTES
app.post("/auth/register", (req: Request, res: Response) => {
  // TODO
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

app.listen(process.env.PORT, () => {
  console.log(`Checkers server listening on port ${PORT}`);
});
