import { Body, Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KycStatus } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KycService } from './kyc.service';

class ReviewKycDto {
  @IsOptional()
  @IsString()
  adminNote?: string;
}

class RejectKycDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

@ApiTags('admin')
@Controller('admin/kyc')
@UseGuards(JwtAuthGuard)
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  @ApiOperation({ summary: 'List KYC submissions for admin review' })
  async list(
    @Query('status') status?: KycStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.kycService.listForAdmin(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single KYC record with full details' })
  async getOne(@Param('id') id: string) {
    const data = await this.kycService.getForAdmin(id);
    return { success: true, data };
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a user KYC submission' })
  async approve(@Request() req, @Param('id') id: string, @Body() dto: ReviewKycDto) {
    const reviewedBy = req.user?.email || req.user?.userId || req.user?.id;
    const data = await this.kycService.approveKyc(id, reviewedBy, dto.adminNote);
    return { success: true, data };
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending KYC submission' })
  async reject(@Request() req, @Param('id') id: string, @Body() dto: RejectKycDto) {
    const reviewedBy = req.user?.email || req.user?.userId || req.user?.id;
    const data = await this.kycService.rejectKyc(id, reviewedBy, dto.reason, dto.adminNote);
    return { success: true, data };
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke an approved KYC (blocks withdrawals)' })
  async revoke(@Request() req, @Param('id') id: string, @Body() dto: RejectKycDto) {
    const reviewedBy = req.user?.email || req.user?.userId || req.user?.id;
    const data = await this.kycService.revokeKyc(id, reviewedBy, dto.reason, dto.adminNote);
    return { success: true, data };
  }
}
