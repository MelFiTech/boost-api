import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Pushes feature-flag changes to connected apps in real time.
 * Apps listen on the "features:update" event; on connect they receive
 * the current flag map via "features:snapshot" (emitted by FeaturesService).
 */
@WebSocketGateway({
  namespace: '/features',
  cors: { origin: '*' },
})
export class FeaturesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(FeaturesGateway.name);

  @WebSocketServer()
  server: Server;

  // Set by FeaturesService so the gateway stays free of DB concerns
  snapshotProvider: (() => Promise<Record<string, boolean>>) | null = null;

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    if (this.snapshotProvider) {
      try {
        client.emit('features:snapshot', await this.snapshotProvider());
      } catch (error) {
        this.logger.error(`Failed to send feature snapshot: ${error.message}`);
      }
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastFlag(key: string, enabled: boolean) {
    this.server.emit('features:update', { key, enabled });
    this.logger.log(`Broadcasted feature update: ${key}=${enabled}`);
  }
}
