import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

// ─── Socket.IO events emitted to connected clients ───────────────────────────
export type ServerToClientEvent =
  | "asset:created"
  | "asset:updated"
  | "asset:deleted"
  | "mutasi:status_changed"
  | "pengadaan:status_changed"
  | "maintenance:status_changed"
  | "opname:sesi_started"
  | "opname:record_verified"
  | "notification:new";

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true },
  namespace: "/",
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  handleConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Broadcast a typed event to all connected clients
  emit<T>(event: ServerToClientEvent, payload: T): void {
    this.server.emit(event, payload);
  }

  // Broadcast to clients in a specific room (e.g., per-unit filtering)
  emitToRoom<T>(room: string, event: ServerToClientEvent, payload: T): void {
    this.server.to(room).emit(event, payload);
  }

  @SubscribeMessage("join_room")
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    room: string,
  ): void {
    client.join(room);
  }
}
