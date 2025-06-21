import { IsString, IsOptional, IsEnum, IsObject, IsBoolean, IsArray } from 'class-validator';
import { DevicePlatform, NotificationType } from '@prisma/client';

export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: {
    platform?: string;
    version?: string;
    model?: string;
    deviceId?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

export class SendNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceTokens?: string[];

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  clickAction?: string;
}

export class CreateNotificationTemplateDto {
  @IsString()
  name: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDeviceTokenDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;

  @IsOptional()
  @IsObject()
  deviceInfo?: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
    deviceId?: string;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class MarkNotificationDto {
  @IsString()
  notificationId: string;

  @IsOptional()
  @IsString()
  action?: 'read' | 'clicked';
} 