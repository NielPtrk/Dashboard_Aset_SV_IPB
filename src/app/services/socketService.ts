import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./apiClient";

// ─── Socket.IO singleton connected to NestJS WebSocket gateway ────────────────
const SOCKET_URL = API_BASE_URL.replace("/api", "");

let _socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  if (!token || localStorage.getItem("user_logged_out") === "true") {
    if (_socket) {
      _socket.disconnect();
      _socket = null;
    }
    return null;
  }

  if (!_socket) {
    _socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  } else {
    // Keep token up to date in handshake auth
    _socket.auth = { token };
  }
  return _socket;
}

export function connectSocket(): void {
  const socket = getSocket();
  if (socket && !socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (_socket) {
    try {
      _socket.disconnect();
    } catch {
      // ignore
    }
    _socket = null;
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
  if (!socket) return () => {};
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export function emitEvent<T = unknown>(event: string, payload?: T): void {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit(event, payload);
  }
}

export default { getSocket, connectSocket, disconnectSocket, onEvent, emitEvent };
