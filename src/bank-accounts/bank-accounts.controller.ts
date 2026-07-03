import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BankAccountsService } from './bank-accounts.service';

class AddBankAccountDto {
  @IsString()
  bankName: string;

  @IsOptional()
  @IsString()
  bankCode?: string;

  @IsString()
  @Length(10, 10)
  @Matches(/^\d{10}$/, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;
}

@ApiTags('bank-accounts')
@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List bank accounts for the authenticated user' })
  async list(@Request() req) {
    const accounts = await this.bankAccountsService.listAccounts(req.user.userId);
    return { success: true, data: { accounts } };
  }

  @Get('banks')
  @ApiOperation({ summary: 'List Nigerian banks and codes (Nyra transfer bank list)' })
  async listBanks() {
    const banks = await this.bankAccountsService.listBanks();
    return { success: true, data: { banks } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single bank account approval status' })
  async getOne(@Request() req, @Param('id') id: string) {
    const data = await this.bankAccountsService.getAccount(req.user.userId, id);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({
    summary:
      'Add a bank account — resolves account name and matches against BVN/NIN (≥2 tokens on each)',
  })
  async add(@Request() req, @Body() dto: AddBankAccountDto) {
    const data = await this.bankAccountsService.addAccount(req.user.userId, dto);
    return { success: true, data };
  }
}
