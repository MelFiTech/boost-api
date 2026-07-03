import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
  Query,
  Request,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString, Length, Matches, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NyraWebhookService } from '../providers/nyra/nyra-webhook.service';
import { WalletService } from './wallet.service';

class InitiateFundingDto {
  @IsNumber()
  @Min(300, { message: 'Minimum funding amount is ₦300' })
  amount: number;
}

class WithdrawDto {
  @IsNumber()
  @Min(100, { message: 'Minimum withdrawal amount is ₦100' })
  amount: number;

  @IsString()
  bankAccountId: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly nyraWebhookService: NyraWebhookService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the current user wallet balance' })
  async getWallet(@Request() req) {
    return { success: true, data: await this.walletService.getWallet(req.user.userId) };
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated wallet transaction history' })
  async getTransactions(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.walletService.getTransactions(
      req.user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 100) : 20,
    );
    return { success: true, data };
  }

  @Post('fund')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate wallet funding; returns bank account details to pay into' })
  async fund(@Request() req, @Body() dto: InitiateFundingDto) {
    const data = await this.walletService.initiateFunding(
      req.user.userId,
      dto.amount,
      req.user.email,
    );
    return { success: true, data };
  }

  @Get('fund/:reference/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Poll funding transaction status by reference' })
  async fundingStatus(@Request() req, @Param('reference') reference: string) {
    const data = await this.walletService.getFundingStatus(req.user.userId, reference);
    return { success: true, data };
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Withdraw wallet balance to an approved bank account (requires PIN)' })
  async withdraw(@Request() req, @Body() dto: WithdrawDto) {
    const data = await this.walletService.withdraw(
      req.user.userId,
      dto.amount,
      dto.bankAccountId,
      dto.pin,
    );
    return { success: true, data };
  }

  @Get('withdraw/:reference/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Poll withdrawal transfer status by reference' })
  async withdrawStatus(@Request() req, @Param('reference') reference: string) {
    const data = await this.walletService.getWithdrawalStatus(req.user.userId, reference);
    return { success: true, data };
  }

  @Post('webhook/nyra')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nyra webhook for dynamic funding account confirmations' })
  async nyraWebhook(
    @Body() payload: any,
    @Headers() headers: any,
    @Ip() ipAddress: string,
  ) {
    return this.nyraWebhookService.handleWebhook(payload, headers, ipAddress);
  }
}
