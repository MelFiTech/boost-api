import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsArray, IsOptional, IsObject, IsDateString, Min, IsUrl } from 'class-validator';

export enum PaymentMethod {
  NGN = 'ngn',
  CRYPTO = 'crypto'
}

export enum OrderPlatform {
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  TWITTER = 'twitter',
  SNAPCHAT = 'snapchat',
  TELEGRAM = 'telegram',
  LINKEDIN = 'linkedin',
  PINTEREST = 'pinterest',
  TWITCH = 'twitch',
  DISCORD = 'discord',
  REDDIT = 'reddit'
}

export enum ServiceType {
  FOLLOWERS = 'followers',
  LIKES = 'likes',
  VIEWS = 'views',
  COMMENTS = 'comments',
  SHARES = 'shares',
  SUBSCRIBERS = 'subscribers'
}

export class DeviceInfo {
  @ApiProperty({ example: 'ios' })
  @IsString()
  platform: string;

  @ApiProperty({ example: '17.0' })
  @IsString()
  version: string;

  @ApiProperty({ example: 'iPhone 14 Pro' })
  @IsString()
  model: string;
}

export class CreateOrderDto {
  @ApiProperty({ enum: OrderPlatform, example: 'instagram' })
  @IsEnum(OrderPlatform)
  platform: OrderPlatform;

  @ApiProperty({ enum: ServiceType, example: 'followers' })
  @IsEnum(ServiceType)
  service: ServiceType;

  @ApiProperty({ example: 1000, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ enum: PaymentMethod, example: 'ngn' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({ example: 'https://instagram.com/username' })
  @IsUrl()
  socialUrl: string;

  @ApiProperty({ example: '4500' })
  @IsString()
  amount: string;

  @ApiProperty({ example: 'NGN' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ 
    type: [String], 
    example: ['Amazing content! 🔥', 'Love this post so much! ❤️'] 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  comments?: string[];

  @ApiPropertyOptional({ example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({ type: DeviceInfo })
  @IsObject()
  @IsOptional()
  deviceInfo?: DeviceInfo;

  @ApiProperty({ example: '2024-12-15T10:30:00.000Z' })
  @IsDateString()
  timestamp: string;
} 