import express, { type Express, type Request, type Response } from "express";
import cors, { type CorsOptions } from "cors";
import { authRouter } from "./routes/auth.ts";
import { gameRecordsRouter } from "./routes/load_records.ts";

const app: Express = express();
app.use(express.json());

const origins = (process.env.CORS_ORIGINS ?? "http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim());

const corsOptions: CorsOptions = {
  origin: origins,
  methods: ["GET", "POST"],
  allowedHeaders: ["Authorization", "Content-Type"],
};
app.use(cors(corsOptions));
app.use("/auth", authRouter);
app.use("/games", gameRecordsRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

export { app };
