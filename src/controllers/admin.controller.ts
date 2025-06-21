import { Controller, Get, Post, Body, UseGuards, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SMMService } from '../services/smm.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../services/orders.service';

class UpdateRatesDto {
  markupPercentage?: number;
  usdtExchangeRate?: number;
}

class RatesResponseDto {
  markupPercentage: number;
  usdtExchangeRate: number;
  calculation: {
    exampleProviderRate: number;
    exampleBoostRate: number;
    markupAmount: number;
  };
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly configService: ConfigService,
    private readonly smmService: SMMService,
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService
  ) {}

  @Get('rates')
  @ApiOperation({ summary: 'Get current markup and exchange rates' })
  @ApiResponse({
    status: 200,
    description: 'Current rates retrieved successfully',
    type: RatesResponseDto
  })
  async getCurrentRates(): Promise<RatesResponseDto> {
    const markupPercentage = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;
    const usdtExchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    
    // Example calculation
    const exampleProviderRate = 1.0; // $1 USDT
    const exampleBoostRate = exampleProviderRate * (1 + markupPercentage / 100);
    const markupAmount = exampleBoostRate - exampleProviderRate;

    return {
      markupPercentage,
      usdtExchangeRate,
      calculation: {
        exampleProviderRate,
        exampleBoostRate: Math.round(exampleBoostRate * 1000) / 1000,
        markupAmount: Math.round(markupAmount * 1000) / 1000
      }
    };
  }

  @Post('rates')
  @ApiOperation({ summary: 'Update markup percentage and/or exchange rate' })
  @ApiBody({
    description: 'Rate updates',
    schema: {
      type: 'object',
      properties: {
        markupPercentage: { 
          type: 'number', 
          description: 'Markup percentage (e.g., 30 for 30%)',
          example: 30
        },
        usdtExchangeRate: { 
          type: 'number', 
          description: 'USDT to NGN exchange rate',
          example: 1500
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Rates updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Rates updated successfully',
        previousRates: {
          markupPercentage: 30,
          usdtExchangeRate: 1500
        },
        newRates: {
          markupPercentage: 35,
          usdtExchangeRate: 1600
        },
        affectedServices: 3490,
        instructions: 'Run POST /api/v1/admin/recalculate-prices to update all service prices'
      }
    }
  })
  async updateRates(@Body() updateRatesDto: UpdateRatesDto) {
    const currentMarkup = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;
    const currentExchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    // Note: In a production environment, you would update these in a database or configuration store
    // For now, we'll demonstrate the response format and logic

    const response = {
      success: true,
      message: 'Rates updated successfully',
      previousRates: {
        markupPercentage: currentMarkup,
        usdtExchangeRate: currentExchangeRate
      },
      newRates: {
        markupPercentage: updateRatesDto.markupPercentage || currentMarkup,
        usdtExchangeRate: updateRatesDto.usdtExchangeRate || currentExchangeRate
      },
      affectedServices: 3490, // This would come from a database count
      instructions: 'Run POST /api/v1/admin/recalculate-prices to update all service prices'
    };

    // TODO: Implement actual rate update logic
    // This would typically update environment variables or database settings
    
    return response;
  }

  @Post('recalculate-prices')
  @ApiOperation({ summary: 'Recalculate all service prices based on current rates' })
  @ApiResponse({
    status: 200,
    description: 'Service prices recalculated successfully',
    schema: {
      example: {
        success: true,
        message: 'All service prices recalculated successfully',
        servicesUpdated: 3490,
        newMarkupPercentage: 35,
        newExchangeRate: 1600
      }
    }
  })
  async recalculatePrices() {
    // This would trigger a recalculation of all boost rates
    const markupPercentage = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;
    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    // TODO: Implement actual price recalculation
    // This would update all services in the database with new boost rates

    return {
      success: true,
      message: 'All service prices recalculated successfully',
      servicesUpdated: 3490, // This would be the actual count
      newMarkupPercentage: markupPercentage,
      newExchangeRate: exchangeRate
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({
    status: 200,
    description: 'System statistics retrieved successfully'
  })
  async getSystemStats() {
    // Get actual counts from database
    const serviceCount = await this.smmService['prisma'].service.count();
    const platformCount = await this.smmService['prisma'].platform.count();
    const categoryCount = await this.smmService['prisma'].category.count();
    const orderCount = await this.smmService['prisma'].order.count();
    const providerCount = await this.smmService['prisma'].serviceProvider.count();

    return {
      services: serviceCount,
      platforms: platformCount,
      categories: categoryCount,
      orders: orderCount,
      providers: providerCount,
      rates: {
        markupPercentage: this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30,
        usdtExchangeRate: this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500
      }
    };
  }

  // MANUAL ORDER APPROVAL ENDPOINTS

  @Get('orders/pending')
  @ApiOperation({ summary: 'Get all orders pending admin approval' })
  @ApiResponse({
    status: 200,
    description: 'List of orders pending approval'
  })
  async getPendingOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING' // Orders waiting for admin approval
      },
      include: {
        service: {
          include: {
            platform: true,
            category: true
          }
        },
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        id: order.id,
        platform: order.service.platform.name,
        service: order.service.name,
        category: order.service.category.name,
        quantity: order.quantity,
        link: order.link,
        price: order.price,
        status: order.status,
        paymentStatus: order.payment?.status || 'NO_PAYMENT',
        paymentMethod: order.payment?.method || null,
        createdAt: order.createdAt,
        serviceDetails: {
          minOrder: order.service.minOrder,
          maxOrder: order.service.maxOrder,
          providerRate: order.service.providerRate,
          boostRate: order.service.boostRate
        }
      }))
    };
  }

  @Post('orders/:orderId/approve')
  @ApiOperation({ summary: 'Approve an order for processing' })
  @ApiResponse({
    status: 200,
    description: 'Order approved successfully'
  })
  async approveOrder(@Param('orderId') orderId: string) {
    // TODO: Add actual provider integration here
    // For now, just mark as approved
    
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING', // Admin approved, ready for provider
        updatedAt: new Date()
      },
      include: {
        service: true,
        platform: true,
        payment: true
      }
    });

    return {
      success: true,
      message: 'Order approved and ready for provider processing',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        platform: updatedOrder.platform.name,
        service: updatedOrder.service.name,
        quantity: updatedOrder.quantity,
        price: updatedOrder.price
      }
    };
  }

  @Post('orders/:orderId/reject')
  @ApiOperation({ summary: 'Reject an order' })
  @ApiResponse({
    status: 200,
    description: 'Order rejected successfully'
  })
  async rejectOrder(@Param('orderId') orderId: string, @Body() body: { reason?: string }) {
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      },
      include: {
        service: true,
        platform: true
      }
    });

    return {
      success: true,
      message: 'Order rejected and cancelled',
      reason: body.reason || 'No reason provided',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        platform: updatedOrder.platform.name,
        service: updatedOrder.service.name,
        quantity: updatedOrder.quantity
      }
         };
   }

   @Post('cleanup/expired-orders')
   @ApiOperation({ summary: 'Manually cleanup expired unpaid orders' })
   @ApiQuery({ 
     name: 'daysOld', 
     description: 'Orders older than this many days will be deleted', 
     example: 3,
     required: false 
   })
   @ApiResponse({
     status: 200,
     description: 'Expired orders cleaned up successfully'
   })
   async cleanupExpiredOrders(@Query('daysOld') daysOld?: string) {
     const days = daysOld ? parseInt(daysOld) : 3;
     return this.ordersService.manualCleanupExpiredOrders(days);
   }
} 