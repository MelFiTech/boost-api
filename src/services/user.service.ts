import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserSettingsDto, UpdateUserProfileDto } from '../dto/user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      username: user.username,
      email: user.email,
      avatar: null, // Will be implemented later if needed
      memberSince: user.createdAt,
      isVerified: user.isVerified,
    };
  }

  async updateUserProfile(userId: string, updateData: UpdateUserProfileDto) {
    // Check if username is already taken
    if (updateData.username) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          username: updateData.username,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new BadRequestException('Username is already taken');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        isVerified: true,
        createdAt: true,
      },
    });

    this.logger.log(`User profile updated for user: ${userId}`);

    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        username: updatedUser.username,
        email: updatedUser.email,
        memberSince: updatedUser.createdAt,
        isVerified: updatedUser.isVerified,
      },
    };
  }

  async getUserSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        username: true,
        pushNotifications: true,
        emailNotifications: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      notifications: {
        push: user.pushNotifications,
        email: user.emailNotifications,
      },
      profile: {
        email: user.email,
        username: user.username,
      },
    };
  }

  async updateUserSettings(userId: string, settingsData: UpdateUserSettingsDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        pushNotifications: settingsData.notifications.push,
        emailNotifications: settingsData.notifications.email,
      },
      select: {
        pushNotifications: true,
        emailNotifications: true,
      },
    });

    this.logger.log(`User settings updated for user: ${userId}`);

    return {
      success: true,
      message: 'Settings updated successfully',
      notifications: {
        push: updatedUser.pushNotifications,
        email: updatedUser.emailNotifications,
      },
    };
  }

  async getUserOrders(userId: string, options: { limit: number; offset: number; status?: string }) {
    const { limit, offset, status } = options;

    const whereClause: any = {
      userId,
    };

    if (status) {
      whereClause.status = status;
    }

    const [orders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          platform: {
            select: {
              name: true,
              slug: true,
            },
          },
          service: {
            select: {
              name: true,
              type: true,
            },
          },
          payment: {
            select: {
              amount: true,
              currency: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.order.count({
        where: whereClause,
      }),
    ]);

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      platform: order.platform.name,
      service: order.service.name,
      quantity: order.quantity,
      amount: order.payment 
        ? `${order.payment.currency} ${order.payment.amount}` 
        : `NGN ${order.price}`,
      status: order.status.toLowerCase(),
      createdAt: order.createdAt,
      socialUrl: order.link,
      progress: this.calculateProgress(order.status),
      // These fields would be populated from external provider data
      startCount: null,
      remains: null,
    }));

    const hasMore = offset + limit < totalCount;

    return {
      orders: formattedOrders,
      totalCount,
      hasMore,
    };
  }

  async getOrderDetails(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        platform: {
          select: {
            name: true,
            slug: true,
          },
        },
        service: {
          select: {
            name: true,
            type: true,
          },
        },
        payment: {
          select: {
            amount: true,
            currency: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      platform: order.platform.name,
      service: order.service.name,
      quantity: order.quantity,
      amount: order.payment 
        ? `${order.payment.currency} ${order.payment.amount}` 
        : `NGN ${order.price}`,
      status: order.status.toLowerCase(),
      createdAt: order.createdAt,
      socialUrl: order.link,
      progress: this.calculateProgress(order.status),
      startCount: null,
      remains: null,
    };
  }

  async deleteAccount(userId: string, confirmPassword?: string) {
    // In a real implementation, you might want to verify the password
    // For now, we'll just delete the account

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete user and all related data (cascading deletes should handle this)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`User account deleted: ${userId}`);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }



  private calculateProgress(status: string): number {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'PROCESSING':
        return 50;
      case 'COMPLETED':
        return 100;
      case 'FAILED':
      case 'CANCELLED':
        return 0;
      default:
        return 0;
    }
  }
} 