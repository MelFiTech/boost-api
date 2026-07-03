import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum PushAudience {
  ALL = 'all',
  INDIVIDUALS = 'individuals',
  VERIFIED_USERS = 'verified_users',
  UNVERIFIED_USERS = 'unverified_users',
  IOS_ONLY = 'ios_only',
  ANDROID_ONLY = 'android_only',
  ACTIVE_30D = 'active_30d',
  WITH_ORDERS = 'with_orders',
  GUEST_DEVICES = 'guest_devices',
}

export class AdminSendPushDto {
  @ApiProperty({ example: 'all', enum: PushAudience })
  @IsEnum(PushAudience)
  audience: PushAudience;

  @ApiProperty({ example: 'Boost your socials 🚀' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Get real followers, likes & views. Tap to open the app.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ApiProperty({ example: 'PROMOTIONAL', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({
    description: 'Required when audience is individuals',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Optional deep-link or screen hint for the app' })
  @IsOptional()
  @IsString()
  clickAction?: string;

  @ApiPropertyOptional({ description: 'Optional template key used for this send' })
  @IsOptional()
  @IsString()
  templateKey?: string;
}

export class AdminPushPreviewQueryDto {
  @ApiProperty({ enum: PushAudience })
  @IsEnum(PushAudience)
  audience: PushAudience;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  userIds?: string[];
}
