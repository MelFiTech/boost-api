import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString } from 'class-validator';
import { ProviderKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NyraFundingRail } from './nyra/nyra.types';
import { NyraApiService } from './nyra/nyra-api.service';
import { ProviderRegistryService } from './provider-registry.service';

class SetActiveProviderDto {
  @IsEnum(ProviderKind)
  kind: ProviderKind;

  @IsString()
  provider: string;
}

class SetNyraFundingRailDto {
  @ApiProperty({ enum: ['Safe_Haven', 'Flutterwave'] })
  @IsIn(['Safe_Haven', 'Flutterwave'])
  rail: NyraFundingRail;
}

@ApiTags('admin')
@Controller('admin/providers')
@UseGuards(JwtAuthGuard)
export class AdminProvidersController {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly nyraApi: NyraApiService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List provider configs and registered providers' })
  async listProviders() {
    return {
      success: true,
      data: {
        registered: this.registry.registeredProviders(),
        configs: await this.registry.listConfigs(),
        nyraFundingRail: await this.registry.getNyraFundingRail(),
        nyraFundingRails: this.registry.listNyraFundingRails(),
      },
    };
  }

  @Patch('active')
  @ApiOperation({ summary: 'Switch the active provider for FUNDING or BILLS at runtime' })
  async setActive(@Body() dto: SetActiveProviderDto) {
    const config = await this.registry.setActiveProvider(dto.kind, dto.provider);
    return { success: true, data: config };
  }

  @Get('nyra/funding-rail')
  @ApiOperation({ summary: 'Get the active Nyra dynamic VA rail (Safe_Haven or Flutterwave)' })
  async getNyraFundingRail() {
    return {
      success: true,
      data: {
        rail: await this.registry.getNyraFundingRail(),
        available: this.registry.listNyraFundingRails(),
      },
    };
  }

  @Patch('nyra/funding-rail')
  @ApiOperation({ summary: 'Switch Nyra dynamic VA rail between Safe_Haven and Flutterwave' })
  async setNyraFundingRail(@Body() dto: SetNyraFundingRailDto) {
    const config = await this.registry.setNyraFundingRail(dto.rail);
    return { success: true, data: config };
  }

  @Get('nyra/wallet-balance')
  @ApiOperation({
    summary: 'Get Nyra master business wallet balance (available_balance is spendable)',
  })
  async getNyraWalletBalance() {
    const data = await this.nyraApi.getBusinessWalletBalance();
    return { success: true, data };
  }
}
