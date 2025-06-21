import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address associated with the OTP',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'The 6-digit OTP code',
  })
  @IsString()
  @Length(6, 6)
  otp: string;
} 