import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FleexaSmsServerSlug } from './fleexa/fleexa.types';
import { VirtualNumbersService } from './virtual-numbers.service';

class BuySmsOtpBody {
  @IsOptional()
  @IsIn(['sms', 'sms2', 'sms3'])
  server?: FleexaSmsServerSlug;

  @IsString()
  countryName: string;

  @IsString()
  appName: string;

  @IsString()
  countryId: string;

  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

class CancelRentalBody {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

@ApiTags('virtual-numbers')
@Controller('virtual-numbers')
@UseGuards(JwtAuthGuard)
export class VirtualNumbersController {
  constructor(private readonly virtualNumbersService: VirtualNumbersService) {}

  @Get('sms/countries')
  @ApiOperation({ summary: 'List SMS OTP countries (Fleexa server 1/2/3)' })
  async countries(@Query('server') server?: FleexaSmsServerSlug) {
    const data = await this.virtualNumbersService.listSmsCountries(server);
    return { success: true, data };
  }

  @Get('sms/apps')
  @ApiOperation({ summary: 'List SMS OTP apps/services for a country with retail NGN prices' })
  async apps(
    @Query('countryId') countryId: string,
    @Query('server') server?: FleexaSmsServerSlug,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.virtualNumbersService.listSmsApps(
      countryId,
      server,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      search,
    );
    return { success: true, data };
  }

  @Get('sms/prices')
  @ApiOperation({ summary: 'SMS OTP 1 price map for a country' })
  async prices(@Query('countryId') countryId: string) {
    const data = await this.virtualNumbersService.getSmsPrices(countryId);
    return { success: true, data };
  }

  @Post('sms/buy')
  @ApiOperation({ summary: 'Buy an SMS OTP number (debits BoostLab wallet, submits to Fleexa)' })
  async buy(@Request() req, @Body() body: BuySmsOtpBody) {
    const data = await this.virtualNumbersService.buySmsOtp(req.user.userId, body);
    return { success: true, data };
  }

  @Get('rentals')
  @ApiOperation({ summary: 'List your virtual number rentals' })
  async history(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.virtualNumbersService.getHistory(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
    return { success: true, data };
  }

  @Get('rentals/:id')
  @ApiOperation({ summary: 'Get rental details and refresh SMS status when waiting' })
  async getRental(@Request() req, @Param('id') id: string) {
    const data = await this.virtualNumbersService.getRental(req.user.userId, id);
    return { success: true, data };
  }

  @Post('rentals/:id/cancel')
  @ApiOperation({ summary: 'Cancel rental within provider window and refund wallet' })
  async cancel(@Request() req, @Param('id') id: string, @Body() body: CancelRentalBody) {
    const data = await this.virtualNumbersService.cancelRental(
      req.user.userId,
      id,
      body.pin,
    );
    return { success: true, data };
  }
}
