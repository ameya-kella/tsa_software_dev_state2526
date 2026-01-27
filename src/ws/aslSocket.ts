// src/ws/aslSocket.ts
import { ASLWebSocket } from "./ASLWebSocket";

export const aslSocket = new ASLWebSocket(
  "ws://192.168.1.175:8000/ws"
);
