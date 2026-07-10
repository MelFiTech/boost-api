import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppSettingsService } from './app-settings.service';

class UpdateAppSettingsDto {
  @ApiPropertyOptional({ example: '+2348012345678', description: 'WhatsApp support phone or wa.me link' })
  @IsOptional()
  @IsString()
  whatsappSupportLine?: string;

  @ApiPropertyOptional({ example: 'https://boostlab.com/help' })
  @IsOptional()
  @IsString()
  helpSupportUrl?: string;

  @ApiPropertyOptional({ example: 'https://boostlab.com/about' })
  @IsOptional()
  @IsString()
  aboutPageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://boostlab.ng/boost',
    description:
      'Hosted SMM web flow URL. Independent of the mobile `smm` feature flag — web keeps working when SMM is hidden in the app.',
  })
  @IsOptional()
  @IsString()
  smmWebUrl?: string;

  @ApiPropertyOptional({ example: 50, description: 'Flat NGN fee deducted when wallet funding is confirmed' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fundingFee?: number;

  @ApiPropertyOptional({ example: 50, description: 'Flat NGN fee charged on top of each withdrawal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawalFee?: number;

  @ApiPropertyOptional({ example: 10, description: 'Markup % applied to SMMStone provider prices' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  smmMarkupPercent?: number;
}

@ApiTags('app')
@Controller('app')
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get public app settings (support links, SMM web URL, wallet fees)',
  })
  async getPublicSettings() {
    const data = await this.appSettingsService.getPublicSettings();
    return { success: true, data };
  }
}

@ApiTags('admin')
@Controller('admin/app-settings')
@UseGuards(JwtAuthGuard)
export class AdminAppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get app settings with metadata (admin)' })
  async getSettings() {
    const data = await this.appSettingsService.getSettings();
    return { success: true, data };
  }

  @Patch()
  @ApiOperation({ summary: 'Update support links, SMM web URL, wallet fees, and markup' })
  async updateSettings(@Request() req, @Body() dto: UpdateAppSettingsDto) {
    const data = await this.appSettingsService.updateSettings({
      ...dto,
      updatedBy: req.user?.email || req.user?.userId || req.user?.id,
    });
    return { success: true, data };
  }
}
