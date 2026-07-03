import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PinService {
  constructor(private readonly prisma: PrismaService) {}

  async hasPin(userId: string): Promise<boolean> {
    const record = await this.prisma.transactionPin.findUnique({ where: { userId } });
    return Boolean(record);
  }

  async createPin(userId: string, pin: string): Promise<void> {
    this.assertValidPin(pin);

    const existing = await this.prisma.transactionPin.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Transaction PIN already exists');
    }

    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.transactionPin.create({
      data: { userId, pinHash },
    });
  }

  async verifyPin(userId: string, pin: string): Promise<boolean> {
    this.assertValidPin(pin);

    const record = await this.prisma.transactionPin.findUnique({ where: { userId } });
    if (!record) {
      return false;
    }

    return bcrypt.compare(pin, record.pinHash);
  }

  /**
   * Used by debit endpoints (bills, withdrawals) — throws if PIN is missing or wrong.
   */
  async requireValidPin(userId: string, pin: string): Promise<void> {
    const hasPin = await this.hasPin(userId);
    if (!hasPin) {
      throw new BadRequestException('Set a transaction PIN before making payments');
    }
    if (!pin) {
      throw new BadRequestException('Transaction PIN is required');
    }
    const valid = await this.verifyPin(userId, pin);
    if (!valid) {
      throw new UnauthorizedException('Incorrect transaction PIN');
    }
  }

  private assertValidPin(pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new BadRequestException('PIN must be exactly 4 digits');
    }
  }
}
