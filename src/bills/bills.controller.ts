import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { BillType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillsService } from './bills.service';

class PayBillDto {
  @IsEnum(BillType)
  billType: BillType;

  @IsString()
  customerIdentifier: string;

  @IsOptional()
  @IsString()
  billerCode?: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  bundleId?: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsNumber()
  @Min(100, { message: 'Minimum bill amount is ₦100' })
  amount: number;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

class ValidateTvDto {
  @IsString()
  smartCardNumber: string;

  @IsString()
  packageId: string;
}

class ValidateElectricityDto {
  @IsString()
  meterNumber: string;

  @IsString()
  packageId: string;
}

@ApiTags('bills')
@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post('pay')
  @ApiOperation({ summary: 'Pay a bill (airtime, data, electricity, TV) from the wallet' })
  async payBill(@Request() req, @Body() dto: PayBillDto) {
    const data = await this.billsService.payBill(req.user.userId, dto);
    return { success: true, data };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get paginated bill payment history' })
  async history(@Request() req, @Query('page') page?: string, @Query('limit') limit?: string) {
    const data = await this.billsService.getHistory(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
    return { success: true, data };
  }

  @Get('vas/services')
  @ApiOperation({ summary: 'List Nyra VAS services (airtime, data, TV, electricity)' })
  async listServices() {
    const data = await this.billsService.listVasServices();
    return { success: true, data };
  }

  @Get('vas/services/:serviceId/billers')
  @ApiOperation({ summary: 'List billers for a VAS service' })
  async listBillers(@Param('serviceId') serviceId: string) {
    const data = await this.billsService.listVasBillers(serviceId);
    return { success: true, data };
  }

  @Get('vas/data/plans')
  @ApiOperation({ summary: 'List data plans for a network' })
  async listDataPlans(@Query('network') network: string) {
    const data = await this.billsService.listDataPlans(network);
    return { success: true, data };
  }

  @Get('vas/tv/items')
  @ApiOperation({ summary: 'List TV packages for a biller' })
  async listTvItems(@Query('biller_id') billerId: string) {
    const data = await this.billsService.listTvPackages(billerId);
    return { success: true, data };
  }

  @Get('vas/electricity/items')
  @ApiOperation({ summary: 'List electricity packages for a biller' })
  async listElectricityItems(@Query('biller_id') billerId: string) {
    const data = await this.billsService.listElectricityPackages(billerId);
    return { success: true, data };
  }

  @Post('vas/tv/validate')
  @ApiOperation({ summary: 'Validate TV smart card before payment' })
  async validateTv(@Body() dto: ValidateTvDto) {
    const data = await this.billsService.validateTv(dto.smartCardNumber, dto.packageId);
    return { success: true, data };
  }

  @Post('vas/electricity/validate')
  @ApiOperation({ summary: 'Validate electricity meter before payment' })
  async validateElectricity(@Body() dto: ValidateElectricityDto) {
    const data = await this.billsService.validateElectricity(dto.meterNumber, dto.packageId);
    return { success: true, data };
  }

  @Get('vas/transactions/:transactionId')
  @ApiOperation({ summary: 'Poll Nyra transaction status' })
  async getTransaction(@Param('transactionId') transactionId: string) {
    const data = await this.billsService.getTransactionStatus(transactionId);
    return { success: true, data };
  }
}
