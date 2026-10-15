import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./apiClient";

// ─── Socket.IO singleton connected to NestJS WebSocket gateway ────────────────
const SOCKET_URL = API_BASE_URL.replace("/api", "");

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const token = localStorage.getItem("access_token");
    _socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return _socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  if (_socket?.connected) {
    _socket.disconnect();
  }
}

// ─── Typed event names emitted by the NestJS gateway ─────────────────────────
export type SocketEvent =
  | "asset:created"
  | "asset:updated"
  | "asset:deleted"
  | "mutasi:status_changed"
  | "pengadaan:status_changed"
  | "maintenance:status_changed"
  | "opname:sesi_started"
  | "opname:record_verified"
  | "notification:new";

export function onEvent<T = unknown>(
  event: SocketEvent,
  handler: (payload: T) => void,
): () => void {
  const socket = getSocket();
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export function emitEvent<T = unknown>(event: string, payload?: T): void {
  getSocket().emit(event, payload);
}

export default { getSocket, connectSocket, disconnectSocket, onEvent, emitEvent };
