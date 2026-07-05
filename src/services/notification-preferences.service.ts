import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async canReceivePush(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pushNotifications: true },
    });
    return user?.pushNotifications !== false;
  }

  async filterPushEnabledUserIds(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, pushNotifications: true },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  async canReceiveEmail(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotifications: true },
    });
    return user?.emailNotifications !== false;
  }

  async canReceiveEmailByAddress(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { emailNotifications: true },
    });
    if (!user) return true;
    return user.emailNotifications !== false;
  }

  async filterEmailEnabledAddresses(emails: string[]): Promise<string[]> {
    if (!emails.length) return [];

    const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
    const users = await this.prisma.user.findMany({
      where: { email: { in: unique } },
      select: { email: true, emailNotifications: true },
    });

    const blocked = new Set(
      users.filter((u) => !u.emailNotifications).map((u) => u.email.toLowerCase()),
    );

    return unique.filter((email) => !blocked.has(email));
  }
}
