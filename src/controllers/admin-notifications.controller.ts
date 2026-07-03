import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminSendPushDto, PushAudience } from '../dto/admin-push.dto';
import { NotificationService } from '../services/notification.service';

@ApiTags('admin')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard)
export class AdminNotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List one-click push notification templates' })
  getTemplates() {
    return {
      success: true,
      data: this.notificationService.getAdminPushTemplates(),
    };
  }

  @Get('audience-preview')
  @ApiOperation({ summary: 'Preview recipient counts for a push audience' })
  async previewAudience(
    @Query('audience') audience: PushAudience,
    @Query('userIds') userIds?: string | string[],
  ) {
    const ids = Array.isArray(userIds) ? userIds : userIds ? [userIds] : undefined;
    const data = await this.notificationService.previewPushAudience(audience, ids);
    return { success: true, data };
  }

  @Post('send')
  @ApiOperation({ summary: 'Send a push notification to a targeted audience' })
  async sendPush(@Request() req, @Body() dto: AdminSendPushDto) {
    const data = await this.notificationService.sendAdminPush(dto, {
      sentBy: req.user?.email || req.user?.userId || req.user?.id,
    });
    return { success: true, data };
  }
}
