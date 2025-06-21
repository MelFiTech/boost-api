import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  Request,
  Logger
} from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { ExpoPushService } from '../services/expo-push.service';
import { 
  RegisterDeviceTokenDto, 
  SendNotificationDto,
  UpdateDeviceTokenDto,
  MarkNotificationDto
} from '../dto/notification.dto';
import { AuthGuard } from '@nestjs/passport';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly expoPushService: ExpoPushService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check Expo Push Notifications status' })
  @ApiResponse({
    status: 200,
    description: 'Notification service status retrieved successfully',
    schema: {
      example: {
        provider: 'expo',
        isAvailable: true,
        status: 'Expo Push Notifications are available and ready to send notifications',
        timestamp: '2024-12-15T10:30:00.000Z'
      }
    }
  })
  async getStatus() {
    const isAvailable = this.expoPushService.isAvailable();
    
    return {
      provider: 'expo',
      isAvailable,
      status: isAvailable
        ? 'Expo Push Notifications are available and ready to send notifications'
        : 'Expo Push Notifications are not available.',
      timestamp: new Date().toISOString()
    };
  }

  @Post('test')
  @ApiOperation({ summary: 'Test Expo push notification' })
  @ApiResponse({
    status: 200,
    description: 'Test notification sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Test notification sent successfully',
        ticketId: 'abc123-def456-ghi789',
        token: 'ExponentPushToken[xyz...]',
        provider: 'expo'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Expo token or service unavailable'
  })
  async testNotification(@Body() body: { 
    token: string;
    title?: string;
    body?: string;
  }) {
    try {
      if (!this.expoPushService.isValidExpoToken(body.token)) {
        return {
          success: false,
          message: 'Invalid Expo push token format. Expected format: ExponentPushToken[...] or ExpoPushToken[...]',
          provider: 'expo',
        };
      }

      const result = await this.expoPushService.sendToDevice({
        to: body.token,
        title: body.title || '🚀 Boost API Test',
        body: body.body || 'Expo push notifications are working correctly!',
        data: {
          test: 'true',
          timestamp: new Date().toISOString(),
        },
        sound: 'default',
        priority: 'high',
        channelId: 'boost_notifications',
      });

      return {
        success: result.status === 'ok',
        message: result.status === 'ok' 
          ? 'Test notification sent successfully' 
          : `Failed to send notification: ${result.message}`,
        ticketId: result.id,
        token: body.token.substring(0, 20) + '...',
        provider: 'expo',
        details: result,
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to send test notification',
        error: error.message,
        isExpoAvailable: this.expoPushService.isAvailable(),
        provider: 'expo',
      };
    }
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register device token for push notifications' })
  @ApiResponse({
    status: 201,
    description: 'Device token registered successfully',
    schema: {
      example: {
        success: true,
        tokenId: 'token123',
        message: 'Device token registered successfully'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Expo token format'
  })
  async registerDeviceToken(@Body() registerDeviceTokenDto: RegisterDeviceTokenDto) {
    return this.notificationService.registerDeviceToken(registerDeviceTokenDto);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send push notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Notification sent to 3 devices',
        sentCount: 3,
        failedCount: 0,
        invalidTokenCount: 0,
        provider: 'expo',
        notificationIds: ['notif123', 'notif124']
      }
    }
  })
  async sendNotification(@Body() dto: SendNotificationDto) {
    const result = await this.notificationService.sendNotification(dto);
    return result;
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'User notifications retrieved successfully',
    schema: {
      example: {
        notifications: [],
        totalCount: 10,
        unreadCount: 3,
        hasMore: false
      }
    }
  })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    return this.notificationService.getUserNotifications(userId, pageNum, limitNum);
  }

  @Post('mark')
  @ApiOperation({ summary: 'Mark notification as read or clicked' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked successfully'
  })
  async markNotification(@Body() markNotificationDto: MarkNotificationDto) {
    return this.notificationService.markNotification(markNotificationDto);
  }

  // Email testing endpoints
  @Post('email/test-otp')
  async testOtpEmail(@Body() dto: { email: string; userName?: string }) {
    // Import ResendService here to avoid circular dependency
    const { ResendService } = await import('../services/resend.service');
    const resendService = new ResendService(this.configService);
    
    const otp = resendService.generateOtp();
    const result = await resendService.sendOtpEmail({
      email: dto.email,
      otp,
      userName: dto.userName,
    });

    return {
      success: result.success,
      message: result.success ? 'OTP email sent successfully' : 'Failed to send OTP email',
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      messageId: result.messageId,
      error: result.error,
    };
  }

  @Post('email/test-welcome')
  async testWelcomeEmail(@Body() dto: { email: string; userName: string }) {
    const { ResendService } = await import('../services/resend.service');
    const resendService = new ResendService(this.configService);
    
    const result = await resendService.sendWelcomeEmail({
      email: dto.email,
      userName: dto.userName,
    });

    return {
      success: result.success,
      message: result.success ? 'Welcome email sent successfully' : 'Failed to send welcome email',
      messageId: result.messageId,
      error: result.error,
    };
  }

  @Post('email/test-order-status')
  async testOrderStatusEmail(@Body() dto: { 
    email: string; 
    userName?: string;
  }) {
    const { ResendService } = await import('../services/resend.service');
    const resendService = new ResendService(this.configService);
    
    const result = await resendService.sendOrderStatusEmail({
      email: dto.email,
      orderData: {
        orderId: 'TEST-12345',
        serviceName: 'Instagram Followers',
        platform: 'Instagram',
        quantity: 1000,
        status: 'completed',
        userName: dto.userName || 'Test User',
        targetUrl: 'https://instagram.com/example',
        orderDate: new Date(),
        completedDate: new Date(),
        progress: 100,
        notes: 'This is a test order status email.'
      }
    });

    return {
      success: result.success,
      message: result.success ? 'Order status email sent successfully' : 'Failed to send order status email',
      messageId: result.messageId,
      error: result.error,
    };
  }

  @Get('email/status')
  async getEmailServiceStatus() {
    const { ResendService } = await import('../services/resend.service');
    const resendService = new ResendService(this.configService);
    
    return resendService.getStatus();
  }
} 