import { IsString, IsOptional, IsBoolean, IsObject, ValidateNested, MinLength, MaxLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationPreferencesDto {
  @ApiProperty({ description: 'Enable/disable push notifications' })
  @IsBoolean()
  push: boolean;

  @ApiProperty({ description: 'Enable/disable email notifications' })
  @IsBoolean()
  email: boolean;
}

export class UpdateUserSettingsDto {
  @ApiProperty({ description: 'Notification preferences' })
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications: NotificationPreferencesDto;
}

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Username (3-20 characters, alphanumeric and underscore only)', minLength: 3, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username?: string;
}

export class OrderHistoryQueryDto {
  @ApiPropertyOptional({ description: 'Number of orders to return', default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Number of orders to skip', default: 0 })
  @IsOptional()
  offset?: number;

  @ApiPropertyOptional({ description: 'Filter by order status', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;
} 