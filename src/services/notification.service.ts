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
import { AdminSendPushDto, PushAudience } from '../dto/admin-push.dto';
import { DevicePlatform, NotificationType, NotificationStatus, Prisma } from '@prisma/client';
import { NotificationPreferencesService } from './notification-preferences.service';
import { EmailService } from '../emails/email.service';
import { resolveOrderReceiptEmail } from './order-receipt.util';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private static readonly ADMIN_PUSH_TEMPLATES = [
    {
      key: 'promo_boost',
      label: 'Boost promo',
      title: 'Boost your socials 🚀',
      body: 'Get real followers, likes & views. Tap to start boosting today!',
      type: NotificationType.PROMOTIONAL,
    },
    {
      key: 'fund_wallet',
      label: 'Fund wallet',
      title: 'Top up your wallet 💰',
      body: 'Fund your BoostLab wallet instantly and pay for boosts & bills.',
      type: NotificationType.PROMOTIONAL,
    },
    {
      key: 'pay_bills',
      label: 'Pay bills',
      title: 'Bills made easy ⚡',
      body: 'Pay airtime, data, TV and electricity straight from your wallet.',
      type: NotificationType.PROMOTIONAL,
    },
    {
      key: 'kyc_reminder',
      label: 'KYC reminder',
      title: 'Complete your verification',
      body: 'Verify your identity to unlock withdrawals and higher limits.',
      type: NotificationType.SECURITY,
    },
    {
      key: 'security_tip',
      label: 'Security tip',
      title: 'Keep your account safe',
      body: 'Never share your PIN or OTP with anyone — including BoostLab staff.',
      type: NotificationType.SECURITY,
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      title: 'Scheduled maintenance',
      body: 'We will perform brief maintenance tonight. Services may be briefly unavailable.',
      type: NotificationType.SYSTEM_ALERT,
    },
    {
      key: 'new_feature',
      label: 'New feature',
      title: 'Something new on BoostLab',
      body: 'Check out our latest update in the app.',
      type: NotificationType.SYSTEM_ALERT,
    },
    {
      key: 'withdrawal_ready',
      label: 'Withdrawals live',
      title: 'Withdraw to your bank',
      body: 'Verified users can now withdraw wallet balance to any approved bank account.',
      type: NotificationType.SYSTEM_ALERT,
    },
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPushService: ExpoPushService,
    private readonly notificationPreferences: NotificationPreferencesService,
    private readonly emailService: EmailService,
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

      const token = await this.prisma.deviceToken.upsert({
        where: { token: dto.token },
        update: {
          ...(validUserId ? { userId: validUserId } : {}),
          platform: dto.platform,
          ...(dto.deviceInfo ? { deviceInfo: dto.deviceInfo } : {}),
          isActive: true,
          lastUsed: new Date(),
        },
        create: {
          token: dto.token,
          platform: dto.platform,
          userId: validUserId,
          deviceInfo: dto.deviceInfo,
          isActive: true,
          lastUsed: new Date(),
        },
      });

      this.logger.log(
        `Device token registered: ${dto.token.substring(0, 20)}...${token.userId ? ` for user ${token.userId}` : ' as guest'}`,
      );
      return {
        success: true,
        tokenId: token.id,
        message: 'Device token registered successfully',
        isGuest: !token.userId,
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
      let targetUserIds = dto.userIds?.length
        ? await this.notificationPreferences.filterPushEnabledUserIds([...new Set(dto.userIds)])
        : undefined;

      let deviceTokens: string[] = [];
      const pushEnabledFilter: Prisma.DeviceTokenWhereInput = {
        OR: [{ userId: null }, { user: { pushNotifications: true } }],
      };

      if (dto.deviceTokens && dto.deviceTokens.length > 0) {
        const tokens = await this.prisma.deviceToken.findMany({
          where: {
            token: { in: dto.deviceTokens },
            isActive: true,
            ...pushEnabledFilter,
          },
          select: { token: true },
        });
        deviceTokens = tokens.map((t) => t.token);
      } else if (targetUserIds && targetUserIds.length > 0) {
        const tokens = await this.prisma.deviceToken.findMany({
          where: {
            userId: { in: targetUserIds },
            isActive: true,
            user: { pushNotifications: true },
          },
          select: { token: true },
          distinct: ['token'],
        });
        deviceTokens = tokens.map((t) => t.token);
      } else if (dto.userIds?.length) {
        this.logger.log('Push skipped: all target users opted out of push notifications');
        return {
          success: true,
          message: 'Push disabled by user preference',
          sentCount: 0,
          failedCount: 0,
        };
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
      const notificationPromises = targetUserIds?.map(userId =>
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
          payment: {
            select: {
              customerEmail: true,
              transactions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { customerEmail: true },
              },
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Order not found: ${orderId}`);
        return;
      }

      const recipient = await resolveOrderReceiptEmail(this.prisma, orderId);
      if (!order.userId && !recipient?.email) {
        this.logger.warn(`Order ${orderId} has no receipt email on record`);
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

      let pushResult: Awaited<ReturnType<NotificationService['sendNotification']>> | null = null;
      if (order.userId) {
        pushResult = await this.sendNotification({
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
      }

      void this.sendOrderEmail(order, type, recipient).catch((err) =>
        this.logger.warn(`Order email failed for ${orderId}: ${err.message}`),
      );

      return (
        pushResult ?? {
          success: true,
          message: 'Email-only notification (guest order)',
          sentCount: 0,
          failedCount: 0,
        }
      );

    } catch (error) {
      this.logger.error(`Failed to send order notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async sendOrderEmail(
    order: {
      id: string;
      userId: string | null;
      link: string;
      quantity: number;
      price: number;
      createdAt: Date;
      updatedAt: Date;
      user: { id: string; email: string; username: string | null } | null;
      service: { name: string };
      platform: { name: string };
    },
    type: 'payment_received' | 'order_approved' | 'order_rejected' | 'order_completed',
    recipient?: { email: string; userId?: string; userName: string } | null,
  ) {
    const resolved =
      recipient ??
      (await resolveOrderReceiptEmail(this.prisma, order.id));
    if (!resolved?.email) return;

    const userName = resolved.userName;
    const userId = resolved.userId;
    const email = resolved.email;
    const baseData = {
      orderId: order.id,
      serviceName: order.service.name,
      platform: order.platform.name,
      quantity: order.quantity,
      targetUrl: order.link,
      userName,
    };

    if (type === 'order_completed') {
      const result = await this.emailService.sendOrderCompletionEmail({
        email,
        userId,
        orderData: {
          ...baseData,
          completedDate: order.updatedAt,
          amount: order.price,
        },
      });
      if (result.skipped) {
        this.logger.debug(`Order completion email skipped for ${order.id} (opted out)`);
      }
      return;
    }

    const statusMap = {
      payment_received: 'pending' as const,
      order_approved: 'processing' as const,
      order_rejected: 'cancelled' as const,
    };
    const status = statusMap[type];
    if (!status) return;

    const result = await this.emailService.sendOrderStatusEmail({
      email,
      userId,
      orderData: {
        ...baseData,
        status,
        orderDate: order.createdAt,
      },
    });
    if (result.skipped) {
      this.logger.debug(`Order status email skipped for ${order.id} (opted out)`);
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

  getAdminPushTemplates() {
    return NotificationService.ADMIN_PUSH_TEMPLATES;
  }

  async previewPushAudience(audience: PushAudience, userIds?: string[]) {
    const resolved = await this.resolvePushAudience(audience, userIds);
    return {
      audience,
      userCount: resolved.userIds.length,
      deviceCount: resolved.deviceTokens.length,
      guestDeviceCount: resolved.guestTokenCount,
    };
  }

  async sendAdminPush(
    dto: AdminSendPushDto,
    meta?: { sentBy?: string },
  ) {
    const resolved = await this.resolvePushAudience(dto.audience, dto.userIds);

    if (resolved.deviceTokens.length === 0) {
      return {
        success: false,
        message: 'No active device tokens found for this audience',
        sentCount: 0,
        failedCount: 0,
        audience: dto.audience,
        userCount: resolved.userIds.length,
        deviceCount: 0,
      };
    }

    const data: Record<string, string> = {
      source: 'admin_broadcast',
      audience: dto.audience,
      ...(dto.templateKey ? { templateKey: dto.templateKey } : {}),
      ...(dto.clickAction ? { clickAction: dto.clickAction } : {}),
      ...(meta?.sentBy ? { sentBy: meta.sentBy } : {}),
    };

    return this.sendNotification({
      title: dto.title,
      body: dto.body,
      type: dto.type,
      userIds: resolved.userIds.length > 0 ? resolved.userIds : undefined,
      deviceTokens: resolved.deviceTokens,
      data,
    });
  }

  private async resolvePushAudience(audience: PushAudience, userIds?: string[]) {
    const activeSince = new Date();
    activeSince.setDate(activeSince.getDate() - 30);

    let tokenWhere: Prisma.DeviceTokenWhereInput = { isActive: true };
    let resolvedUserIds: string[] = [];

    switch (audience) {
      case PushAudience.INDIVIDUALS: {
        if (!userIds?.length) {
          throw new BadRequestException('userIds is required when audience is individuals');
        }
        resolvedUserIds = await this.notificationPreferences.filterPushEnabledUserIds([
          ...new Set(userIds),
        ]);
        tokenWhere = { ...tokenWhere, userId: { in: resolvedUserIds } };
        break;
      }
      case PushAudience.VERIFIED_USERS: {
        const users = await this.prisma.user.findMany({
          where: { isVerified: true, pushNotifications: true },
          select: { id: true },
        });
        resolvedUserIds = users.map((u) => u.id);
        tokenWhere = { ...tokenWhere, userId: { in: resolvedUserIds } };
        break;
      }
      case PushAudience.UNVERIFIED_USERS: {
        const users = await this.prisma.user.findMany({
          where: { isVerified: false, pushNotifications: true },
          select: { id: true },
        });
        resolvedUserIds = users.map((u) => u.id);
        tokenWhere = { ...tokenWhere, userId: { in: resolvedUserIds } };
        break;
      }
      case PushAudience.IOS_ONLY:
        tokenWhere = { ...tokenWhere, platform: DevicePlatform.IOS };
        break;
      case PushAudience.ANDROID_ONLY:
        tokenWhere = { ...tokenWhere, platform: DevicePlatform.ANDROID };
        break;
      case PushAudience.ACTIVE_30D: {
        const users = await this.prisma.user.findMany({
          where: { updatedAt: { gte: activeSince }, pushNotifications: true },
          select: { id: true },
        });
        resolvedUserIds = users.map((u) => u.id);
        tokenWhere = { ...tokenWhere, userId: { in: resolvedUserIds } };
        break;
      }
      case PushAudience.WITH_ORDERS: {
        const users = await this.prisma.user.findMany({
          where: { orders: { some: {} }, pushNotifications: true },
          select: { id: true },
        });
        resolvedUserIds = users.map((u) => u.id);
        tokenWhere = { ...tokenWhere, userId: { in: resolvedUserIds } };
        break;
      }
      case PushAudience.GUEST_DEVICES:
        tokenWhere = { ...tokenWhere, userId: null };
        break;
      case PushAudience.ALL:
      default:
        break;
    }

    const tokens = await this.prisma.deviceToken.findMany({
      where: {
        ...tokenWhere,
        OR: [{ userId: null }, { user: { pushNotifications: true } }],
      },
      select: { token: true, userId: true },
    });

    const deviceTokens = [...new Set(tokens.map((t) => t.token))];
    if (resolvedUserIds.length === 0) {
      resolvedUserIds = [...new Set(tokens.map((t) => t.userId).filter(Boolean) as string[])];
    }

    return {
      userIds: resolvedUserIds,
      deviceTokens,
      guestTokenCount: tokens.filter((t) => !t.userId).length,
    };
  }

  /** Push for wallet ledger events (funding, bills, withdrawal, refunds, orders). */
  async notifyWalletTransaction(
    userId: string,
    tx: {
      id: string;
      type: string;
      category: string;
      amount: string;
      balanceAfter: string;
      title: string;
      status: string;
      reference?: string;
    },
  ) {
    if (!['COMPLETED', 'PROCESSING'].includes(tx.status)) return;

    const canPush = await this.notificationPreferences.canReceivePush(userId);
    if (!canPush) {
      this.logger.debug(`Wallet push skipped for ${userId}: push notifications disabled`);
      return;
    }

    const amount = this.formatNgn(tx.amount);
    const balance = this.formatNgn(tx.balanceAfter);
    const isCredit = tx.type === 'CREDIT';
    const body = isCredit
      ? `${amount} credited. Balance: ${balance}`
      : `${amount} debited. Balance: ${balance}`;

    const type =
      tx.category === 'SMM_ORDER'
        ? NotificationType.ORDER_UPDATE
        : NotificationType.PAYMENT_UPDATE;

    try {
      await this.sendNotification({
        title: tx.title,
        body,
        type,
        userIds: [userId],
        data: {
          type: 'wallet_transaction',
          transactionId: tx.id,
          category: tx.category,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          reference: tx.reference || '',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Wallet push failed for ${userId} (${tx.id}): ${error.message}`,
      );
    }
  }

  /** Push + email when Nyra delivers a prepaid electricity token. */
  async notifyElectricityTokenDelivered(
    userId: string,
    payload: {
      billPaymentId: string;
      token: string;
      meterNumber: string;
      amount: number;
      reference: string;
      numberOfUnits?: string;
      providerName?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });
    if (!user?.email) {
      this.logger.warn(`Electricity token notify skipped: no email for user ${userId}`);
      return;
    }

    const userName = user.username || user.email.split('@')[0];
    const unitsSuffix = payload.numberOfUnits ? ` · ${payload.numberOfUnits} kWh` : '';

    try {
      await this.sendNotification({
        title: 'Electricity token ready',
        body: `Token: ${payload.token}${unitsSuffix}`,
        type: NotificationType.PAYMENT_UPDATE,
        userIds: [userId],
        data: {
          type: 'electricity_token',
          billPaymentId: payload.billPaymentId,
          token: payload.token,
          numberOfUnits: payload.numberOfUnits || '',
          meterNumber: payload.meterNumber,
          reference: payload.reference,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Electricity token push failed for ${userId}: ${error.message}`,
      );
    }

    try {
      const result = await this.emailService.sendElectricityTokenEmail({
        email: user.email,
        userId,
        tokenData: {
          userName,
          token: payload.token,
          meterNumber: payload.meterNumber,
          amount: payload.amount,
          reference: payload.reference,
          numberOfUnits: payload.numberOfUnits,
          providerName: payload.providerName,
          date: new Date(),
        },
      });
      if (result.skipped) {
        this.logger.debug(`Electricity token email skipped for ${userId} (opted out)`);
      }
    } catch (error) {
      this.logger.warn(
        `Electricity token email failed for ${userId}: ${error.message}`,
      );
    }
  }

  private formatNgn(value: string | number): string {
    const num = typeof value === 'string' ? Number(value) : value;
    return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
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