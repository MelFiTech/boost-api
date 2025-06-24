import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService, ExpoMessage } from './expo-push.service';
import { 
  RegisterDeviceTokenDto, 
  SendNotificationDto, 
  CreateNotificationTemplateDto,
  UpdateDeviceTokenDto,
  MarkNotificationDto
} from '../dto/notification.dto';
import { DevicePlatform, NotificationType, NotificationStatus } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPushService: ExpoPushService,
  ) {}

  // Device Token Management
  async registerDeviceToken(dto: RegisterDeviceTokenDto) {
    this.logger.debug(`Registering device token for platform: ${dto.platform}`);

    try {
      // For EXPO platform, validate token format, but allow registration even with invalid format for testing
      if (dto.platform === DevicePlatform.EXPO) {
        const isValidToken = this.expoPushService.isValidExpoToken(dto.token);
        if (!isValidToken) {
          this.logger.warn(`Invalid Expo token format, but allowing registration: ${dto.token.substring(0, 20)}...`);
        }
      }

      // Validate userId if provided - if user doesn't exist, set to null for guest registration
      let validUserId = null;
      if (dto.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: dto.userId },
        });

        if (user) {
          validUserId = dto.userId;
          this.logger.debug(`User found: ${dto.userId}`);
        } else {
          this.logger.warn(`User not found: ${dto.userId}, registering as guest token`);
          // Don't throw error, just proceed with null userId for guest user
        }
      }

      // Check if token already exists
      const existingToken = await this.prisma.deviceToken.findUnique({
        where: { token: dto.token },
      });

      if (existingToken) {
        // Update existing token
        const updatedToken = await this.prisma.deviceToken.update({
          where: { token: dto.token },
          data: {
            userId: validUserId || existingToken.userId,
            platform: dto.platform,
            deviceInfo: dto.deviceInfo || existingToken.deviceInfo,
            isActive: true,
            lastUsed: new Date(),
            updatedAt: new Date(),
          },
        });

        this.logger.log(`Device token updated: ${dto.token.substring(0, 20)}...`);
        return {
          success: true,
          tokenId: updatedToken.id,
          message: 'Device token updated successfully',
          isGuest: !validUserId,
        };
      }

      // Create new token
      const newToken = await this.prisma.deviceToken.create({
        data: {
          token: dto.token,
          platform: dto.platform,
          userId: validUserId, // This will be null if user doesn't exist
          deviceInfo: dto.deviceInfo,
          isActive: true,
          lastUsed: new Date(),
        },
      });

      this.logger.log(`Device token registered: ${dto.token.substring(0, 20)}...${validUserId ? ` for user ${validUserId}` : ' as guest'}`);
      return {
        success: true,
        tokenId: newToken.id,
        message: 'Device token registered successfully',
        isGuest: !validUserId,
      };

    } catch (error) {
      this.logger.error(`Failed to register device token: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateDeviceToken(tokenId: string, dto: UpdateDeviceTokenDto) {
    this.logger.debug(`Updating device token: ${tokenId}`);

    try {
      const updatedToken = await this.prisma.deviceToken.update({
        where: { id: tokenId },
        data: {
          ...dto,
          lastUsed: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Device token updated successfully',
        token: updatedToken,
      };

    } catch (error) {
      this.logger.error(`Failed to update device token: ${error.message}`, error.stack);
      throw new NotFoundException('Device token not found');
    }
  }

  async removeDeviceToken(token: string) {
    this.logger.debug(`Removing device token: ${token.substring(0, 20)}...`);

    try {
      await this.prisma.deviceToken.delete({
        where: { token },
      });

      return {
        success: true,
        message: 'Device token removed successfully',
      };

    } catch (error) {
      this.logger.error(`Failed to remove device token: ${error.message}`, error.stack);
      throw new NotFoundException('Device token not found');
    }
  }

  async getUserDeviceTokens(userId: string) {
    this.logger.debug(`Getting device tokens for user: ${userId}`);

    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: {
          userId: userId,
          isActive: true,
        },
        orderBy: { lastUsed: 'desc' },
      });

      return tokens;

    } catch (error) {
      this.logger.error(`Failed to get user device tokens: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Notification Templates
  async createNotificationTemplate(dto: CreateNotificationTemplateDto) {
    this.logger.debug(`Creating notification template: ${dto.name}`);

    try {
      const template = await this.prisma.notificationTemplate.create({
        data: dto,
      });

      return {
        success: true,
        templateId: template.id,
        message: 'Notification template created successfully',
      };

    } catch (error) {
      this.logger.error(`Failed to create notification template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getNotificationTemplate(name: string) {
    this.logger.debug(`Getting notification template: ${name}`);

    try {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { name },
      });

      if (!template) {
        throw new NotFoundException('Notification template not found');
      }

      return template;

    } catch (error) {
      this.logger.error(`Failed to get notification template: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Send Notifications
  async sendNotification(dto: SendNotificationDto) {
    this.logger.debug(`Sending notification: ${dto.title}`);

    try {
      let deviceTokens: string[] = [];

      // Get device tokens
      if (dto.deviceTokens && dto.deviceTokens.length > 0) {
        deviceTokens = dto.deviceTokens;
      } else if (dto.userIds && dto.userIds.length > 0) {
        const tokens = await this.prisma.deviceToken.findMany({
          where: {
            userId: { in: dto.userIds },
            isActive: true,
          },
          select: { token: true },
          distinct: ['token'], // Ensure we don't get duplicate tokens from database
        });
        deviceTokens = tokens.map(t => t.token);
      } else {
        throw new BadRequestException('Either userIds or deviceTokens must be provided');
      }

      // Remove duplicate tokens to prevent sending multiple notifications to the same device
      const originalTokenCount = deviceTokens.length;
      deviceTokens = [...new Set(deviceTokens)];
      
      if (originalTokenCount > deviceTokens.length) {
        this.logger.debug(`Removed ${originalTokenCount - deviceTokens.length} duplicate device tokens`);
      }

      if (deviceTokens.length === 0) {
        this.logger.warn('No device tokens found for notification');
        return {
          success: false,
          message: 'No active device tokens found',
          sentCount: 0,
          failedCount: 0,
        };
      }

      // Validate all tokens are Expo tokens
      const invalidTokens = deviceTokens.filter(token => !this.expoPushService.isValidExpoToken(token));
      if (invalidTokens.length > 0) {
        this.logger.warn(`Found ${invalidTokens.length} invalid Expo push tokens`);
        deviceTokens = deviceTokens.filter(token => this.expoPushService.isValidExpoToken(token));
      }

      if (deviceTokens.length === 0) {
        throw new BadRequestException('No valid Expo push tokens found');
      }

      // Create notification records in database
      const notificationPromises = dto.userIds?.map(userId => 
        this.prisma.userNotification.create({
          data: {
            userId: userId,
            title: dto.title,
            body: dto.body,
            type: dto.type,
            data: dto.data,
            orderId: dto.orderId,
            status: NotificationStatus.PENDING,
          },
        })
      ) || [];

      const notifications = await Promise.all(notificationPromises);

      // Send via Expo Push Service
      const expoMessages = this.expoPushService.createMessage({
        tokens: deviceTokens,
        title: dto.title,
        body: dto.body,
        data: {
          type: dto.type,
          orderId: dto.orderId || '',
          notificationId: notifications[0]?.id || '',
          ...Object.fromEntries(
            Object.entries(dto.data || {}).map(([key, value]) => [key, String(value)])
          ),
        },
        sound: 'default',
        priority: 'high',
        channelId: 'boost_notifications',
      });

      const tickets = await this.expoPushService.sendToMultipleDevices(expoMessages);
      
      const successCount = tickets.filter(ticket => ticket.status === 'ok').length;
      const failureCount = tickets.filter(ticket => ticket.status === 'error').length;

      // Update notification status
      await Promise.all(notifications.map(notification =>
        this.prisma.userNotification.update({
          where: { id: notification.id },
          data: {
            status: successCount > 0 ? NotificationStatus.SENT : NotificationStatus.FAILED,
            sentAt: new Date(),
          },
        })
      ));

      // Log failed tickets for debugging
      const failedTickets = tickets.filter(ticket => ticket.status === 'error');
      if (failedTickets.length > 0) {
        this.logger.warn(`Failed tickets: ${JSON.stringify(failedTickets)}`);
      }

      this.logger.log(`Notification sent via Expo Push. Success: ${successCount}, Failed: ${failureCount}`);

      return {
        success: successCount > 0,
        message: `Notification sent to ${successCount} devices${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
        sentCount: successCount,
        failedCount: failureCount,
        invalidTokenCount: invalidTokens.length,
        notificationIds: notifications.map(n => n.id),
        provider: 'expo',
      };

    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Send notification using template
  async sendTemplateNotification(templateName: string, data: {
    userIds?: string[];
    deviceTokens?: string[];
    orderId?: string;
    templateData?: Record<string, string>;
  }) {
    this.logger.debug(`Sending template notification: ${templateName}`);

    try {
      const template = await this.getNotificationTemplate(templateName);

      if (!template.isActive) {
        throw new BadRequestException('Notification template is not active');
      }

      // Replace template variables
      let title = template.title;
      let body = template.body;

      if (data.templateData) {
        Object.entries(data.templateData).forEach(([key, value]) => {
          title = title.replace(new RegExp(`{{${key}}}`, 'g'), value);
          body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });
      }

      const notificationDto: SendNotificationDto = {
        title,
        body,
        type: template.type,
        userIds: data.userIds,
        deviceTokens: data.deviceTokens,
        orderId: data.orderId,
      };

      return await this.sendNotification(notificationDto);

    } catch (error) {
      this.logger.error(`Failed to send template notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Order-specific notification helpers
  async sendOrderNotification(orderId: string, type: 'payment_received' | 'order_approved' | 'order_rejected' | 'order_completed') {
    this.logger.debug(`Sending order notification: ${type} for order ${orderId}`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          service: true,
          platform: true,
        },
      });

      if (!order || !order.userId) {
        this.logger.warn(`Order not found or no user associated: ${orderId}`);
        return;
      }

      const templates = {
        payment_received: {
          title: 'Payment Received! 💰',
          body: `Your payment for ${order.quantity} ${order.service.name} has been confirmed. We'll start processing your order soon!`,
          type: NotificationType.PAYMENT_UPDATE,
        },
        order_approved: {
          title: 'Order Approved! ✅',
          body: `Your order for ${order.quantity} ${order.service.name} has been approved and is now being processed.`,
          type: NotificationType.ORDER_UPDATE,
        },
        order_rejected: {
          title: 'Order Rejected ❌',
          body: `Your order for ${order.quantity} ${order.service.name} has been rejected. Please contact support for more information.`,
          type: NotificationType.ORDER_UPDATE,
        },
        order_completed: {
          title: 'Order Completed! 🎉',
          body: `Your order for ${order.quantity} ${order.service.name} has been completed successfully!`,
          type: NotificationType.ORDER_UPDATE,
        },
      };

      const template = templates[type];
      if (!template) {
        throw new BadRequestException('Invalid notification type');
      }

      return await this.sendNotification({
        title: template.title,
        body: template.body,
        type: template.type,
        userIds: [order.userId],
        orderId: orderId,
        data: {
          orderId: orderId,
          platform: order.platform.name,
          service: order.service.name,
          quantity: order.quantity.toString(),
          price: order.price.toString(),
        },
      });

    } catch (error) {
      this.logger.error(`Failed to send order notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId: string, limit: number = 50, offset: number = 0) {
    this.logger.debug(`Getting notifications for user: ${userId}`);

    try {
      const notifications = await this.prisma.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          template: true,
          order: {
            include: {
              service: true,
              platform: true,
            },
          },
        },
      });

      const totalCount = await this.prisma.userNotification.count({
        where: { userId },
      });

      const unreadCount = await this.prisma.userNotification.count({
        where: {
          userId,
          readAt: null,
        },
      });

      return {
        notifications,
        totalCount,
        unreadCount,
        hasMore: offset + notifications.length < totalCount,
      };

    } catch (error) {
      this.logger.error(`Failed to get user notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Mark notifications as read/clicked
  async markNotification(dto: MarkNotificationDto) {
    this.logger.debug(`Marking notification as ${dto.action}: ${dto.notificationId}`);

    try {
      const updateData: any = { updatedAt: new Date() };

      if (dto.action === 'read') {
        updateData.readAt = new Date();
      } else if (dto.action === 'clicked') {
        updateData.clickedAt = new Date();
        updateData.readAt = updateData.readAt || new Date();
      }

      const notification = await this.prisma.userNotification.update({
        where: { id: dto.notificationId },
        data: updateData,
      });

      return {
        success: true,
        message: `Notification marked as ${dto.action}`,
        notification,
      };

    } catch (error) {
      this.logger.error(`Failed to mark notification: ${error.message}`, error.stack);
      throw new NotFoundException('Notification not found');
    }
  }

  // Clean up old notifications
  async cleanupOldNotifications(daysOld: number = 30) {
    this.logger.debug(`Cleaning up notifications older than ${daysOld} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deletedCount = await this.prisma.userNotification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          readAt: {
            not: null,
          },
        },
      });

      this.logger.log(`Cleaned up ${deletedCount.count} old notifications`);
      return deletedCount.count;

    } catch (error) {
      this.logger.error(`Failed to cleanup old notifications: ${error.message}`, error.stack);
      throw error;
    }
  }
} 