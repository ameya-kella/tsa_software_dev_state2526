import { ASLWebSocket } from "./ASLWebSocket";

export const aslSocket = new ASLWebSocket(
  "ws://localhost:8000/ws"
);
