import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PinService } from './pin.service';

class CreatePinDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

class VerifyPinDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

@ApiTags('pin')
@Controller('pin')
@UseGuards(JwtAuthGuard)
export class PinController {
  constructor(private readonly pinService: PinService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if the user has a transaction PIN' })
  async status(@Request() req) {
    const hasPin = await this.pinService.hasPin(req.user.userId);
    return { success: true, data: { hasPin } };
  }

  @Post('create')
  @ApiOperation({ summary: 'Create a 4-digit transaction PIN (bcrypt-hashed server-side)' })
  async create(@Request() req, @Body() dto: CreatePinDto) {
    await this.pinService.createPin(req.user.userId, dto.pin);
    return { success: true, data: { created: true } };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify a transaction PIN' })
  async verify(@Request() req, @Body() dto: VerifyPinDto) {
    const valid = await this.pinService.verifyPin(req.user.userId, dto.pin);
    return { success: true, data: { valid } };
  }
}
