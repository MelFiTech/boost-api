import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, Min } from 'class-validator';

export enum Currency {
  NGN = 'NGN',
  USDT = 'USDT'
}

export class ServiceRequestDto {
  @ApiProperty({
    description: 'Platform name (e.g., instagram)',
    example: 'instagram'
  })
  @IsString()
  platform: string;

  @ApiProperty({
    description: 'Service category (e.g., followers)',
    example: 'followers'
  })
  @IsString()
  category: string;

  @ApiProperty({
    description: 'Quantity of service requested',
    example: 1000,
    minimum: 1
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Link or username for the service',
    example: 'https://instagram.com/username'
  })
  @IsString()
  link: string;

  @ApiProperty({
    description: 'Preferred currency for payment',
    enum: Currency,
    example: Currency.NGN
  })
  @IsEnum(Currency)
  currency: Currency;
} 