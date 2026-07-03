import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOrdersService } from '../services/admin-orders.service';

class NotifyCustomerDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

@ApiTags('admin')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get('attention')
  @ApiOperation({ summary: 'Orders needing admin action: paid-but-stuck, failed, or cancelled' })
  async attention() {
    return { success: true, data: await this.adminOrdersService.getOrdersNeedingAttention() };
  }

  @Post(':id/refire')
  @ApiOperation({ summary: 'Re-submit a stuck or failed order to the provider' })
  async refire(@Param('id') id: string) {
    return { success: true, data: await this.adminOrdersService.refireOrder(id) };
  }

  @Post(':id/refund')
  @ApiOperation({ summary: "Reverse the order payment into the user's wallet" })
  async refund(@Param('id') id: string) {
    return { success: true, data: await this.adminOrdersService.refundOrderToWallet(id) };
  }

  @Post(':id/notify')
  @ApiOperation({ summary: 'Send an email update to the customer (guest orders)' })
  async notify(@Param('id') id: string, @Body() dto: NotifyCustomerDto) {
    return {
      success: true,
      data: await this.adminOrdersService.notifyCustomer(id, dto.email, dto.message),
    };
  }
}
