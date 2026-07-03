import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeaturesService } from './features.service';

class ToggleFlagDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}

@ApiTags('features')
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feature flags as a key/enabled map (used by app on launch)' })
  async getFlags() {
    return { success: true, data: await this.featuresService.getFlagMap() };
  }
}

@ApiTags('admin')
@Controller('admin/features')
export class AdminFeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List feature flags with metadata' })
  async listFlags() {
    return { success: true, data: await this.featuresService.getFlags() };
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle a feature flag; change is pushed to apps over WebSocket' })
  async toggleFlag(@Param('key') key: string, @Body() dto: ToggleFlagDto) {
    const flag = await this.featuresService.setFlag(key, dto.enabled, dto.updatedBy);
    return { success: true, data: flag };
  }
}
