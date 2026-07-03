import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface WalletSocketPayload {
  id: string;
  balance: string;
  currency: string;
  active: boolean;
}

/**
 * Pushes wallet balance changes to the owning user in real time.
 * Apps connect to the /wallet namespace with their JWT and listen for
 * "wallet:update"; on connect they receive "wallet:snapshot".
 */
@WebSocketGateway({
  namespace: '/wallet',
  cors: { origin: '*' },
})
export class WalletGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WalletGateway.name);

  @WebSocketServer()
  server: Server;

  snapshotProvider: ((userId: string) => Promise<WalletSocketPayload>) | null = null;

  constructor(private readonly jwtService: JwtService) {}

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }

  private verifyToken(token: string): string | null {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      return payload?.sub || null;
    } catch {
      return null;
    }
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Wallet socket rejected: missing token (${client.id})`);
      client.disconnect();
      return;
    }

    const userId = this.verifyToken(token);
    if (!userId) {
      this.logger.warn(`Wallet socket rejected: invalid token (${client.id})`);
      client.disconnect();
      return;
    }

    client.data.userId = userId;
    await client.join(this.userRoom(userId));
    this.logger.log(`Wallet socket connected: ${client.id} user=${userId}`);

    if (this.snapshotProvider) {
      try {
        client.emit('wallet:snapshot', await this.snapshotProvider(userId));
      } catch (error) {
        this.logger.error(`Failed wallet snapshot for ${userId}: ${error.message}`);
      }
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Wallet socket disconnected: ${client.id}`);
  }

  pushUpdate(userId: string, wallet: WalletSocketPayload) {
    this.server.to(this.userRoom(userId)).emit('wallet:update', wallet);
    this.logger.log(`Pushed wallet update to ${userId}: balance=${wallet.balance}`);
  }
}
