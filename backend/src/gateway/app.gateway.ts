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
import { JwtService } from "@nestjs/jwt";

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

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        (typeof client.handshake.headers?.authorization === "string" &&
        client.handshake.headers.authorization.startsWith("Bearer ")
          ? client.handshake.headers.authorization.slice(7)
          : null);

      if (!rawToken) {
        this.logger.warn(`Rejecting socket connection ${client.id}: Missing authentication token.`);
        client.disconnect(true);
        return;
      }

      const decoded = await this.jwtService.verifyAsync(rawToken);
      (client as any).user = decoded;
      this.logger.log(`Client authenticated and connected: ${client.id} (user: ${decoded.email || decoded.sub})`);
    } catch (err: any) {
      this.logger.warn(`Rejecting socket connection ${client.id}: Invalid token (${err.message}).`);
      client.disconnect(true);
    }
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
