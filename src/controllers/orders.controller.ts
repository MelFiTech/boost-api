import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrdersService } from '../services/orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('pricing')
  @ApiOperation({ summary: 'Calculate pricing for a service' })
  @ApiQuery({ name: 'platform', description: 'Platform name (e.g., instagram)', example: 'instagram' })
  @ApiQuery({ name: 'service', description: 'Service type (e.g., followers)', example: 'followers' })
  @ApiQuery({ name: 'quantity', description: 'Quantity needed', example: 1000 })
  @ApiQuery({ name: 'currency', description: 'Currency (NGN or USDT)', example: 'NGN' })
  @ApiResponse({
    status: 200,
    description: 'Pricing calculated successfully',
    schema: {
      example: {
        platform: 'instagram',
        service: 'followers',
        quantity: 1000,
        currency: 'NGN',
        price: 2515.50,
        serviceName: '🇮🇷 Instagram Iranian Followers [NO Refill]',
        providerRate: 1.29,
        ourRate: 1.677
      }
    }
  })
  async calculatePricing(
    @Query('platform') platform: string,
    @Query('service') service: string,
    @Query('quantity') quantity: string,
    @Query('currency') currency: string = 'NGN'
  ) {
    return this.ordersService.calculateServicePricing(
      platform,
      service,
      parseInt(quantity),
      currency
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    schema: {
      example: {
        id: 'order_123456789',
        status: 'pending_payment',
        amount: '2515.50',
        currency: 'NGN',
        paymentMethod: 'ngn',
        platform: 'instagram',
        service: 'followers',
        quantity: 1000,
        socialUrl: 'https://instagram.com/username',
        createdAt: '2024-12-15T10:30:00.000Z',
        payment: {
          id: 'payment_123456789',
          status: 'pending',
          amount: '2515.50',
          currency: 'NGN',
          method: 'ngn'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid input data or price mismatch'
  })
  @ApiResponse({
    status: 404,
    description: 'Service not available for the specified platform'
  })
  async createOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found'
  })
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get order status' })
  @ApiResponse({
    status: 200,
    description: 'Order status retrieved successfully',
    schema: {
      example: {
        id: 'order_123456789',
        status: 'completed',
        progress: 100,
        startCount: 1000,
        remains: 0
      }
    }
  })
  async getOrderStatus(@Param('id') id: string) {
    return this.ordersService.getOrderStatus(id);
  }
} 