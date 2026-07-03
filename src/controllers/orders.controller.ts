import { Controller, Post, Body, Get, Param, Query, Header, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrdersService } from '../services/orders.service';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('catalog')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({ summary: 'Available platforms and services with valid quantity ranges' })
  @ApiResponse({
    status: 200,
    description: 'Service catalog retrieved successfully',
    schema: {
      example: {
        platforms: [
          {
            id: 'youtube',
            label: 'YouTube',
            services: [
              { id: 'views', label: 'Views', minOrder: 100, maxOrder: 1000000 },
              { id: 'followers', label: 'Subscribers', minOrder: 10, maxOrder: 50000 },
            ],
          },
        ],
      },
    },
  })
  async getCatalog() {
    return this.ordersService.getServiceCatalog();
  }

  @Get('pricing')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Calculate pricing for a service' })
  @ApiQuery({ name: 'platform', description: 'Platform name (e.g., instagram)', example: 'instagram' })
  @ApiQuery({ name: 'service', description: 'Service type (e.g., followers)', example: 'followers' })
  @ApiQuery({ name: 'serviceId', required: false, description: 'Exact SMMStone provider service id from catalog', example: '11773' })
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
    @Query('serviceId') serviceId: string,
    @Query('quantity') quantity: string,
    @Query('currency') currency: string = 'NGN'
  ) {
    return this.ordersService.calculateServicePricing(
      platform,
      service,
      parseInt(quantity),
      currency,
      serviceId,
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
  @UseGuards(OptionalAuthGuard)
  async createOrder(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    // Link the order to the user when a valid token is supplied (e.g. the
    // web flow opened from the app); guests still order anonymously.
    return this.ordersService.createOrder(createOrderDto, req.user?.userId);
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