import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ 
    example: 'admin@boost.com',
    description: 'Admin email address'
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    example: 'Boost2025',
    description: 'Admin password'
  })
  @IsString()
  @MinLength(6)
  password: string;
} 