import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString } from 'class-validator';
import { ProviderKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SmmProviderRegistryService } from '../smm/smm-provider.registry';
import { VirtualNumberProviderRegistryService } from '../virtual-numbers/virtual-number.registry';
import { FleexaVirtualNumberProvider } from '../virtual-numbers/fleexa/fleexa-virtual-number.provider';
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
    private readonly smmRegistry: SmmProviderRegistryService,
    private readonly virtualNumberRegistry: VirtualNumberProviderRegistryService,
    private readonly fleexaProvider: FleexaVirtualNumberProvider,
    private readonly nyraApi: NyraApiService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List provider configs and registered providers' })
  async listProviders() {
    const [fundingBillsConfigs, smmConfigs, virtualConfigs, activeSmmProvider, activeVirtualProvider] =
      await Promise.all([
      this.registry.listConfigs(),
      this.smmRegistry.listConfigs(),
      this.virtualNumberRegistry.listConfigs(),
      this.smmRegistry.getActiveSlug(),
      this.virtualNumberRegistry.getActiveSlug(),
    ]);

    return {
      success: true,
      data: {
        registered: {
          ...this.registry.registeredProviders(),
          SMM: this.smmRegistry.registeredSlugs(),
          VIRTUAL_NUMBERS: this.virtualNumberRegistry.registeredSlugs(),
        },
        configs: [...fundingBillsConfigs, ...smmConfigs, ...virtualConfigs],
        activeSmmProvider,
        activeVirtualNumbersProvider: activeVirtualProvider,
        nyraFundingRail: await this.registry.getNyraFundingRail(),
        nyraFundingRails: this.registry.listNyraFundingRails(),
      },
    };
  }

  @Patch('active')
  @ApiOperation({ summary: 'Switch the active provider for FUNDING, BILLS, SMM, or VIRTUAL_NUMBERS' })
  async setActive(@Body() dto: SetActiveProviderDto) {
    if (dto.kind === ProviderKind.SMM) {
      const config = await this.smmRegistry.setActiveProvider(dto.provider);
      return { success: true, data: config };
    }
    if (dto.kind === ProviderKind.VIRTUAL_NUMBERS) {
      const config = await this.virtualNumberRegistry.setActiveProvider(dto.provider);
      return { success: true, data: config };
    }

    const config = await this.registry.setActiveProvider(dto.kind, dto.provider);
    return { success: true, data: config };
  }

  @Get('fleexa/balance')
  @ApiOperation({ summary: 'Fleexa reseller wallet balance (NGN)' })
  async getFleexaBalance() {
    if (!this.fleexaProvider.isConfigured()) {
      return { success: false, error: 'FLEEXA_API_KEY is not configured' };
    }
    try {
      const balance = await this.fleexaProvider.getBalance();
      return { success: true, data: { balance, currency: 'NGN' } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
