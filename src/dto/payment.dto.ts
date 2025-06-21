import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum PaymentProvider {
  BUDPAY = 'budpay',
  CRYPTO = 'crypto'
}

export class InitiatePaymentDto {
  @ApiProperty({ example: 'cmbulftog00011g7xl0j09ba2', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ 
    enum: PaymentProvider, 
    example: PaymentProvider.BUDPAY,
    description: 'Payment provider to use'
  })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiPropertyOptional({ 
    example: 'boostlab@gmail.com',
    description: 'Customer email for BudPay payments'
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ 
    example: '+2348123456789',
    description: 'Customer phone number'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    example: 'Boost Buddy',
    description: 'Customer name'
  })
  @IsOptional()
  @IsString()
  customerName?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: 'ps_abc123xyz', description: 'Payment reference from provider' })
  @IsString()
  reference: string;

  @ApiProperty({ 
    enum: PaymentProvider, 
    example: PaymentProvider.BUDPAY,
    description: 'Payment provider used'
  })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}

export class CryptoPaymentDto {
  @ApiProperty({ example: 'cmbulftog00011g7xl0j09ba2', description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 'TRX...', description: 'Crypto wallet address to send payment to' })
  @IsString()
  walletAddress: string;

  @ApiProperty({ example: '1.677', description: 'Amount in USDT' })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'USDT', description: 'Cryptocurrency type' })
  @IsString()
  currency: string;
} 