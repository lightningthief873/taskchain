"use client";

import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    socket = io(API_URL, { transports: ["websocket", "polling"], reconnection: true });
  }
  return socket;
}

export function joinTaskRoom(taskId: string): Socket {
  const s = getSocket();
  s.emit("join:task", taskId);
  return s;
}

export function leaveTaskRoom(taskId: string): void {
  socket?.emit("leave:task", taskId);
}
