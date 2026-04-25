import "dotenv/config";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import agentsRouter from "./routes/agents";
import tasksRouter from "./routes/tasks";
import adminRouter from "./routes/admin";
import faucetRouter from "./routes/faucet";

const app = express();
const httpServer = createServer(app);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3010,http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Socket.io ─────────────────────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"], credentials: true },
});

io.on("connection", (socket) => {
  socket.on("join:task", (taskId: string) => { void socket.join(`task:${taskId}`); });
  socket.on("leave:task", (taskId: string) => { void socket.leave(`task:${taskId}`); });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests — try again in 15 minutes" },
});

// POST /tasks is expensive; limit to 10 per minute
const taskCreateLimiter = rateLimit({
  windowMs: 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many task submissions — slow down" },
});

app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", service: "taskchain-api" }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/agents", agentsRouter);
app.use("/tasks", taskCreateLimiter, tasksRouter);
app.use("/admin", adminRouter);
app.use("/faucet", faucetRouter);

const PORT = parseInt(process.env.API_PORT ?? "3005", 10);
httpServer.listen(PORT, () => console.log(`[api] TaskChain API listening on port ${PORT}`));
