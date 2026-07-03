import { Controller, Post, Body, Get, Param, Headers, Req, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { InitiatePaymentDto, VerifyPaymentDto } from '../dto/payment.dto';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate payment for an order' })
  @ApiResponse({ status: 201, description: 'Payment initiated — bank transfer details provided' })
  async initiatePayment(@Body() initiatePaymentDto: InitiatePaymentDto) {
    return this.paymentService.initiatePayment(initiatePaymentDto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify payment status' })
  @ApiResponse({ status: 200, description: 'Payment verification result' })
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(verifyPaymentDto);
  }

  @Get('status/:orderId')
  @ApiOperation({ summary: 'Get payment status for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId);
  }

  @Post('webhook/nyra')
  @HttpCode(200)
  @ApiOperation({ summary: 'Nyra webhook for order payment confirmations' })
  async nyraWebhook(@Body() payload: any, @Headers() headers: any, @Req() request: Request) {
    return this.paymentService.handleNyraWebhook(payload, headers, request.ip);
  }
}
