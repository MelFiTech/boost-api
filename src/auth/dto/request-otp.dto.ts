import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address to send OTP to',
  })
  @IsEmail()
  email: string;
} 