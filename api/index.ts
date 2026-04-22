import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import agentsRouter from "./routes/agents";

const app = express();
const PORT = parseInt(process.env.API_PORT ?? "3005", 10);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "taskchain-api" }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/agents", agentsRouter);

app.listen(PORT, () => {
  console.log(`[api] TaskChain API listening on port ${PORT}`);
});
