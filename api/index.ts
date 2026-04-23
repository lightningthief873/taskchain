import "dotenv/config";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import agentsRouter from "./routes/agents";
import tasksRouter from "./routes/tasks";
import adminRouter from "./routes/admin";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socket.on("join:task", (taskId: string) => {
    void socket.join(`task:${taskId}`);
  });
  socket.on("leave:task", (taskId: string) => {
    void socket.leave(`task:${taskId}`);
  });
});

const PORT = parseInt(process.env.API_PORT ?? "3005", 10);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "taskchain-api" }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/agents", agentsRouter);
app.use("/tasks", tasksRouter);
app.use("/admin", adminRouter);

httpServer.listen(PORT, () => {
  console.log(`[api] TaskChain API listening on port ${PORT}`);
});
