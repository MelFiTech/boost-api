import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KycService } from './kyc.service';

class SubmitKycDto {
  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/, { message: 'BVN must be exactly 11 digits' })
  bvn: string;

  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/, { message: 'NIN must be exactly 11 digits' })
  nin: string;
}

@ApiTags('kyc')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get KYC verification status for the authenticated user' })
  async status(@Request() req) {
    const data = await this.kycService.getStatus(req.user.userId);
    return { success: true, data };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit BVN and NIN for identity verification' })
  async submit(@Request() req, @Body() dto: SubmitKycDto) {
    const data = await this.kycService.submitKyc(req.user.userId, dto);
    return { success: true, data };
  }
}
