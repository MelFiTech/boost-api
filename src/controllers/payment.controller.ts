import { Controller, Post, Body, Get, Param, Headers, Req } from '@nestjs/common';
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
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully - Bank transfer details provided',
    schema: {
      example: {
        success: true,
        data: {
          reference: 'boost_cmbulftog00011g7xl0j09ba2_1671234567890',
          amount: '2515.50',
          currency: 'NGN',
          accountNumber: '1014692362',
          bankName: 'BudPay Bank',
          accountName: 'Business Name / Firstname lastname',
          expiresAt: '2024-12-15T18:30:00.000Z',
          instructions: [
            'Transfer exactly ₦2515.50 to the account details above',
            'Use the exact amount - any difference will cause payment failure',
            'Payment will be confirmed automatically once received',
            'You will receive confirmation once payment is received'
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Order not found or payment already completed'
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found'
  })
  async initiatePayment(@Body() initiatePaymentDto: InitiatePaymentDto) {
    return this.paymentService.initiatePayment(initiatePaymentDto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify payment status' })
  @ApiResponse({
    status: 200,
    description: 'Payment verification result',
    schema: {
      example: {
        success: true,
        data: {
          status: 'success',
          reference: 'boost_cmbulftog00011g7xl0j09ba2_1671234567890',
          amount: 2515.50,
          currency: 'NGN',
          paid_at: '2024-12-15T10:45:00.000Z',
          orderId: 'cmbulftog00011g7xl0j09ba2'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Payment verification failed'
  })
  @ApiResponse({
    status: 404,
    description: 'Payment record not found'
  })
  async verifyPayment(@Body() verifyPaymentDto: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(verifyPaymentDto);
  }

  @Get('status/:orderId')
  @ApiOperation({ summary: 'Get payment status for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID', example: 'cmbulftog00011g7xl0j09ba2' })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved successfully',
    schema: {
      example: {
        orderId: 'cmbulftog00011g7xl0j09ba2',
        status: 'completed',
        amount: '2515.50',
        currency: 'NGN',
        method: 'ngn',
        gatewayRef: 'boost_cmbulftog00011g7xl0j09ba2_1671234567890',
        createdAt: '2024-12-15T10:30:00.000Z',
        updatedAt: '2024-12-15T10:45:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found'
  })
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(orderId);
  }

  @Post('webhook/budpay')
  @ApiOperation({ summary: 'BudPay webhook endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully'
  })
  async budpayWebhook(
    @Body() payload: any,
    @Headers() headers: any,
    @Req() request: Request
  ) {
    // BudPay webhook handler with complete logging
    console.log('🔔 Received BudPay webhook:', payload);

    try {
      const result = await this.paymentService.handleBudpayWebhook(
        payload, 
        headers, 
        request.ip, 
        request.get('User-Agent')
      );
      
      return { success: true };
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }
} 