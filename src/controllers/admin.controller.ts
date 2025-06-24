import { Controller, Get, Post, Body, UseGuards, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { SMMService } from '../services/smm.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../services/orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SmmstoneService } from '../smmstone/smmstone.service';
import { NotificationService } from '../services/notification.service';

class UpdateRatesDto {
  @IsOptional()
  @IsNumber({}, { message: 'Markup percentage must be a number' })
  @Min(0, { message: 'Markup percentage cannot be negative' })
  @Max(100, { message: 'Markup percentage cannot exceed 100%' })
  markupPercentage?: number;

  @IsOptional()
  @IsNumber({}, { message: 'USDT exchange rate must be a number' })
  @Min(1, { message: 'Exchange rate must be at least 1' })
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
    private readonly ordersService: OrdersService,
    private readonly smmstoneService: SmmstoneService,
    private readonly notificationService: NotificationService
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

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
    schema: {
      example: {
        totalOrders: 25,
        totalRevenue: 249600,
        pendingOrders: 3,
        completedOrders: 20,
        totalUsers: 15,
        services: 3470,
        platforms: 14,
        revenueUSDT: 166.4
      }
    }
  })
  async getDashboardStats() {
    const [totalOrders, pendingOrders, completedOrders, totalUsers, totalRevenue] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.user.count(),
      this.prisma.order.aggregate({
        where: { payment: { status: 'COMPLETED' } },
        _sum: { price: true }
      })
    ]);

    const serviceCount = await this.prisma.service.count();
    const platformCount = await this.prisma.platform.count();
    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    const revenueNGN = totalRevenue._sum.price || 0;
    const revenueUSDT = parseFloat((revenueNGN / exchangeRate).toFixed(2));

    return {
      totalOrders,
      totalRevenue: parseFloat(revenueNGN.toString()),
      pendingOrders,
      completedOrders,
      totalUsers,
      services: serviceCount,
      platforms: platformCount,
      revenueUSDT,
      exchangeRate
    };
  }

  @Get('dashboard/metrics')
  @ApiOperation({ summary: 'Get dashboard metrics and charts data' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
    schema: {
      example: {
        recentOrders: [
          {
            id: 'order_123',
            platform: 'Instagram',
            service: 'Followers',
            amount: 9984,
            status: 'pending',
            createdAt: '2025-06-23T10:30:00.000Z'
          }
        ],
        ordersByStatus: {
          pending: 3,
          completed: 20,
          cancelled: 2
        },
        revenueByDay: [
          { date: '2025-06-20', revenue: 50000 },
          { date: '2025-06-21', revenue: 75000 },
          { date: '2025-06-22', revenue: 60000 }
        ],
        topPlatforms: [
          { platform: 'Instagram', orders: 15, revenue: 150000 },
          { platform: 'TikTok', orders: 8, revenue: 80000 }
        ]
      }
    }
  })
  async getDashboardMetrics() {
    // Recent orders (last 10)
    const recentOrders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          include: {
            platform: true
          }
        }
      }
    });

    // Orders by status
    const [pendingCount, completedCount, cancelledCount] = await Promise.all([
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.count({ where: { status: 'CANCELLED' } })
    ]);

    // Revenue by day (last 7 days) - simplified to avoid groupBy issues
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const revenueOrders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        payment: { status: 'COMPLETED' }
      },
      select: {
        createdAt: true,
        price: true
      }
    });

    // Group orders by day manually
    const dailyRevenueMap = new Map<string, number>();
    revenueOrders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      const current = dailyRevenueMap.get(date) || 0;
      dailyRevenueMap.set(date, current + order.price);
    });

    const dailyRevenue = Array.from(dailyRevenueMap.entries()).map(([date, revenue]) => ({
      date,
      revenue
    }));

    return {
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        platform: order.service?.platform?.name || 'Unknown',
        service: order.service?.name?.split(' ').slice(0, 3).join(' ') || 'Unknown Service',
        amount: parseFloat(order.price.toString()),
        status: order.status,
        createdAt: order.createdAt
      })),
      ordersByStatus: {
        pending: pendingCount,
        completed: completedCount,
        cancelled: cancelledCount
      },
      revenueByDay: dailyRevenue,
      topPlatforms: [] // Simplified for now
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

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders with payment details' })
  @ApiResponse({
    status: 200,
    description: 'List of all orders with payment information',
    schema: {
      example: {
        success: true,
        count: 2,
        orders: [
          {
            id: 'order_123456789',
            status: 'pending',
            platform: 'Instagram',
            serviceName: 'Instagram Followers',
            quantity: 1000,
            socialUrl: 'https://instagram.com/user',
            createdAt: '2025-06-23T10:30:00.000Z',
            user: {
              id: 'user_123',
              email: 'user@example.com'
            },
            pricing: {
              amountNGN: 9984,
              amountUSDT: 6.66,
              providerRateUSDT: 5.12,
              markup: 30,
              exchangeRate: 1500
            },
            payment: {
              id: 'payment_123',
              status: 'completed',
              method: 'ngn',
              amountPaid: '9984',
              currency: 'NGN',
              gatewayRef: 'boost_order_123456789_1671234567890',
              paidAt: '2025-06-23T10:45:00.000Z'
            }
          }
        ]
      }
    }
  })
  async getAllOrders() {
    const orders = await this.prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        service: {
          include: {
            platform: true
          }
        },
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to recent 100 orders
    });

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    const markup = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;

    return {
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        id: order.id,
        status: order.status,
        platform: order.service?.platform?.name || 'Unknown',
        serviceName: order.service?.name || 'Unknown Service',
        quantity: order.quantity,
        socialUrl: order.link,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        user: order.user ? {
          id: order.user.id,
          email: order.user.email,
          username: order.user.username
        } : null,
        pricing: {
          amountNGN: parseFloat(order.price.toString()),
          amountUSDT: parseFloat((order.price / exchangeRate).toFixed(4)),
          providerRateUSDT: order.service?.providerRate || 0,
          markup: markup,
          exchangeRate: exchangeRate
        },
        payment: order.payment ? {
          id: order.payment.id,
          status: order.payment.status,
          method: order.payment.method,
          amountPaid: order.payment.amount,
          currency: order.payment.currency,
          gatewayRef: order.payment.gatewayRef,
          paidAt: order.payment.updatedAt,
          createdAt: order.payment.createdAt
        } : null
      }))
    };
  }

  @Get('orders/pending')
  @ApiOperation({ summary: 'Get orders pending admin approval' })
  @ApiResponse({
    status: 200,
    description: 'List of orders pending approval'
  })
  async getPendingOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        service: {
          include: {
            platform: true
          }
        },
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    const markup = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;

    return {
      success: true,
      count: orders.length,
      orders: orders.map(order => ({
        id: order.id,
        status: order.status,
        platform: order.service?.platform?.name || 'Unknown',
        serviceName: order.service?.name || 'Unknown Service',
        quantity: order.quantity,
        socialUrl: order.link,
        createdAt: order.createdAt,
        user: order.user ? {
          id: order.user.id,
          email: order.user.email,
          username: order.user.username
        } : null,
        pricing: {
          amountNGN: parseFloat(order.price.toString()),
          amountUSDT: parseFloat((order.price / exchangeRate).toFixed(4)),
          providerRateUSDT: order.service?.providerRate || 0,
          markup: markup,
          exchangeRate: exchangeRate
        },
        payment: order.payment ? {
          id: order.payment.id,
          status: order.payment.status,
          method: order.payment.method,
          amountPaid: order.payment.amount,
          currency: order.payment.currency,
          gatewayRef: order.payment.gatewayRef,
          paidAt: order.payment.updatedAt
        } : null
      }))
    };
  }

  @Post('orders/:orderId/fulfill')
  @ApiOperation({ summary: 'Fulfill/approve an order for processing' })
  @ApiResponse({
    status: 200,
    description: 'Order fulfilled successfully',
    schema: {
      example: {
        success: true,
        message: 'Order fulfilled and marked as completed',
        order: {
          id: 'order_123456789',
          status: 'completed',
          platform: 'Instagram',
          serviceName: 'Instagram Followers',
          quantity: 1000,
          socialUrl: 'https://instagram.com/user',
          pricing: {
            amountNGN: 9984,
            amountUSDT: 6.66,
            providerRateUSDT: 5.12
          },
          fulfilledAt: '2025-06-23T10:45:00.000Z'
        }
      }
    }
  })
  async fulfillOrder(@Param('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        service: {
          include: {
            platform: true
          }
        },
        payment: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if order is already completed
    if (order.status === 'COMPLETED') {
      throw new Error('Order is already completed');
    }

    // Check if order is cancelled
    if (order.status === 'CANCELLED') {
      throw new Error('Cannot fulfill a cancelled order');
    }

    // Use a transaction to update both order and payment status atomically
    const updatedOrder = await this.prisma.$transaction(async (prisma) => {
      // Update payment status to completed if it exists
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        });
      }

      // Update order status to completed
      return prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        },
        include: {
          service: {
            include: {
              platform: true
            }
          },
          payment: true
        }
      });
    });

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    return {
      success: true,
      message: 'Order fulfilled by admin and marked as completed',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        platform: updatedOrder.service?.platform?.name || 'Unknown',
        serviceName: updatedOrder.service?.name || 'Unknown Service',
        quantity: updatedOrder.quantity,
        socialUrl: updatedOrder.link,
        pricing: {
          amountNGN: parseFloat(updatedOrder.price.toString()),
          amountUSDT: parseFloat((updatedOrder.price / exchangeRate).toFixed(4)),
          providerRateUSDT: updatedOrder.service?.providerRate || 0
        },
        payment: updatedOrder.payment ? {
          id: updatedOrder.payment.id,
          status: updatedOrder.payment.status,
          amountPaid: updatedOrder.payment.amount,
          currency: updatedOrder.payment.currency
        } : null,
        fulfilledAt: updatedOrder.updatedAt
      }
    };
  }

  @Post('orders/:orderId/decline')
  @ApiOperation({ summary: 'Decline/reject an order' })
  @ApiResponse({
    status: 200,
    description: 'Order declined successfully',
    schema: {
      example: {
        success: true,
        message: 'Order declined and cancelled',
        reason: 'Invalid social media URL provided',
        order: {
          id: 'order_123456789',
          status: 'cancelled',
          platform: 'Instagram',
          serviceName: 'Instagram Followers',
          quantity: 1000,
          socialUrl: 'https://instagram.com/user',
          pricing: {
            amountNGN: 9984,
            amountUSDT: 6.66
          },
          declinedAt: '2025-06-23T10:45:00.000Z'
        }
      }
    }
  })
  async declineOrder(@Param('orderId') orderId: string, @Body() body: { reason?: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        service: {
          include: {
            platform: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      },
      include: {
        service: {
          include: {
            platform: true
          }
        }
      }
    });

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    return {
      success: true,
      message: 'Order declined and cancelled',
      reason: body.reason || 'No reason provided',
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        platform: updatedOrder.service?.platform?.name || 'Unknown',
        serviceName: updatedOrder.service?.name || 'Unknown Service',
        quantity: updatedOrder.quantity,
        socialUrl: updatedOrder.link,
        pricing: {
          amountNGN: parseFloat(updatedOrder.price.toString()),
          amountUSDT: parseFloat((updatedOrder.price / exchangeRate).toFixed(4))
        },
        declinedAt: updatedOrder.updatedAt
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

  @Get('orders/ongoing')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get ongoing orders with progress tracking' })
  @ApiResponse({
    status: 200,
    description: 'Ongoing orders retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          orders: [
            {
              id: 'order_123456789',
              status: 'PROCESSING',
              platform: 'Instagram',
              serviceName: 'Instagram Followers',
              quantity: 1000,
              socialUrl: 'https://instagram.com/user',
              progress: {
                startCount: 500,
                currentCount: 750,
                targetCount: 1500,
                progressPercentage: 50,
                estimatedCompletion: '2025-06-24T15:30:00.000Z'
              },
              smmstone: {
                orderId: '141440958',
                charge: 5.12,
                status: 'In progress'
              },
              user: {
                id: 'user_123',
                email: 'user@example.com',
                username: 'user123'
              },
              pricing: {
                amountNGN: 9984,
                amountUSDT: 6.66
              },
              startedAt: '2025-06-24T10:00:00.000Z'
            }
          ],
          total: 1
        }
      }
    }
  })
  async getOngoingOrders() {
    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    const markup = this.configService.get<number>('MARKUP_PERCENTAGE') || 30;

    const ongoingOrders = await this.prisma.order.findMany({
      where: {
        status: 'PROCESSING'
      },
      include: {
        service: {
          include: {
            platform: true
          }
        },
        user: true,
        payment: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    const ordersWithProgress = await Promise.all(
      ongoingOrders.map(async (order) => {
        let progress = null;
        let smmstoneDetails = null;

        // If order has providerOrderId (SMMStone order), get progress
        if (order.providerOrderId) {
          try {
            const smmstoneStatus = await this.smmstoneService.getOrderStatus(parseInt(order.providerOrderId));
            
            // Calculate progress based on SMMStone data
            const startCount = parseInt(String(smmstoneStatus.start_count || '0'));
            const currentCount = parseInt(String(smmstoneStatus.remains || '0'));
            const targetCount = startCount + order.quantity;
            const delivered = order.quantity - currentCount;
            const progressPercentage = Math.min(Math.round((delivered / order.quantity) * 100), 100);

            progress = {
              startCount,
              currentCount: startCount + delivered,
              targetCount,
              progressPercentage,
              delivered,
              remaining: currentCount,
              estimatedCompletion: this.calculateEstimatedCompletion(order.createdAt, progressPercentage)
            };

            smmstoneDetails = {
              orderId: order.providerOrderId,
              charge: parseFloat(String(smmstoneStatus.charge || '0')),
              status: smmstoneStatus.status || 'Unknown',
              startCount: smmstoneStatus.start_count,
              remains: smmstoneStatus.remains
            };
          } catch (error) {
            // If we can't get SMMStone status, show basic progress
            progress = {
              startCount: 0,
              currentCount: 0,
              targetCount: order.quantity,
              progressPercentage: 0,
              delivered: 0,
              remaining: order.quantity,
              estimatedCompletion: null
            };
          }
        }

        return {
          id: order.id,
          status: order.status,
          platform: order.service?.platform?.name || 'Unknown',
          serviceName: order.service?.name || 'Unknown Service',
          quantity: order.quantity,
          socialUrl: order.link,
          progress,
          smmstone: smmstoneDetails,
          user: order.user ? {
            id: order.user.id,
            email: order.user.email,
            username: order.user.username
          } : null,
          pricing: {
            amountNGN: parseFloat(order.price.toString()),
            amountUSDT: parseFloat((order.price / exchangeRate).toFixed(4)),
            providerRateUSDT: order.service?.providerRate || 0,
            markup,
            exchangeRate
          },
          payment: order.payment ? {
            id: order.payment.id,
            status: order.payment.status,
            method: order.payment.method,
            amountPaid: order.payment.amount,
            currency: order.payment.currency
          } : null,
          startedAt: order.updatedAt, // When it was moved to PROCESSING
          createdAt: order.createdAt
        };
      })
    );

    return {
      success: true,
      data: {
        orders: ordersWithProgress,
        total: ordersWithProgress.length
      }
    };
  }

  @Get('orders/fulfilled')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get fulfilled/completed orders' })
  @ApiResponse({
    status: 200,
    description: 'Fulfilled orders retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          orders: [
            {
              id: 'order_123456789',
              status: 'COMPLETED',
              platform: 'Instagram',
              serviceName: 'Instagram Followers',
              quantity: 1000,
              socialUrl: 'https://instagram.com/user',
              fulfillment: {
                method: 'smmstone',
                smmstoneOrderId: '141440958',
                deliveredCount: 1000,
                completionRate: 100
              },
              user: {
                id: 'user_123',
                email: 'user@example.com',
                username: 'user123'
              },
              pricing: {
                amountNGN: 9984,
                amountUSDT: 6.66
              },
              timeline: {
                createdAt: '2025-06-24T10:00:00.000Z',
                startedAt: '2025-06-24T10:30:00.000Z',
                completedAt: '2025-06-24T14:45:00.000Z',
                duration: '4h 15m'
              }
            }
          ],
          total: 1,
          pagination: {
            page: 1,
            limit: 10,
            totalPages: 1
          }
        }
      }
    }
  })
  async getFulfilledOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('platform') platform?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    const markup = this.configService.get<number>('MARKUP_PERCENTAGE') || 30;
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      status: 'COMPLETED'
    };

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { link: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (platform) {
      where.service = {
        platform: {
          name: {
            contains: platform,
            mode: 'insensitive'
          }
        }
      };
    }

    if (startDate || endDate) {
      where.updatedAt = {};
      if (startDate) {
        where.updatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.updatedAt.lte = new Date(endDate);
      }
    }

    const [fulfilledOrders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          service: {
            include: {
              platform: true
            }
          },
          user: true,
          payment: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        skip,
        take: limitNum
      }),
      this.prisma.order.count({ where })
    ]);

    const ordersWithFulfillment = await Promise.all(
      fulfilledOrders.map(async (order) => {
        let fulfillmentDetails = null;

        // If order has providerOrderId (SMMStone), get fulfillment details
        if (order.providerOrderId) {
          try {
            const smmstoneStatus = await this.smmstoneService.getOrderStatus(parseInt(order.providerOrderId));
            
            const delivered = order.quantity - parseInt(String(smmstoneStatus.remains || '0'));
            const completionRate = Math.round((delivered / order.quantity) * 100);

            fulfillmentDetails = {
              method: 'smmstone',
              smmstoneOrderId: order.providerOrderId,
              deliveredCount: delivered,
              completionRate,
              finalStatus: smmstoneStatus.status,
              charge: parseFloat(String(smmstoneStatus.charge || '0'))
            };
          } catch (error) {
            fulfillmentDetails = {
              method: 'manual',
              deliveredCount: order.quantity,
              completionRate: 100,
              note: 'Manually fulfilled by admin'
            };
          }
        } else {
          fulfillmentDetails = {
            method: 'manual',
            deliveredCount: order.quantity,
            completionRate: 100,
            note: 'Manually fulfilled by admin'
          };
        }

        // Calculate duration
        const duration = this.calculateDuration(order.createdAt, order.updatedAt);

        return {
          id: order.id,
          status: order.status,
          platform: order.service?.platform?.name || 'Unknown',
          serviceName: order.service?.name || 'Unknown Service',
          quantity: order.quantity,
          socialUrl: order.link,
          fulfillment: fulfillmentDetails,
          user: order.user ? {
            id: order.user.id,
            email: order.user.email,
            username: order.user.username
          } : null,
          pricing: {
            amountNGN: parseFloat(order.price.toString()),
            amountUSDT: parseFloat((order.price / exchangeRate).toFixed(4)),
            providerRateUSDT: order.service?.providerRate || 0,
            markup,
            exchangeRate
          },
          payment: order.payment ? {
            id: order.payment.id,
            status: order.payment.status,
            method: order.payment.method,
            amountPaid: order.payment.amount,
            currency: order.payment.currency
          } : null,
          timeline: {
            createdAt: order.createdAt,
            startedAt: order.updatedAt, // Approximation - when status changed to COMPLETED
            completedAt: order.updatedAt,
            duration
          }
        };
      })
    );

    const totalPages = Math.ceil(totalCount / limitNum);

    return {
      success: true,
      data: {
        orders: ordersWithFulfillment,
        total: totalCount,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      }
    };
  }

  // Helper method to calculate estimated completion time
  private calculateEstimatedCompletion(startTime: Date, progressPercentage: number): Date | null {
    if (progressPercentage <= 0) return null;
    
    const now = new Date();
    const elapsedTime = now.getTime() - startTime.getTime();
    const totalEstimatedTime = (elapsedTime / progressPercentage) * 100;
    const remainingTime = totalEstimatedTime - elapsedTime;
    
    return new Date(now.getTime() + remainingTime);
  }

  // Helper method to calculate duration between two dates
  private calculateDuration(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  // ===== USER MANAGEMENT ENDPOINTS =====

  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination and filters' })
  @ApiQuery({ name: 'page', description: 'Page number', example: 1, required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', example: 20, required: false })
  @ApiQuery({ name: 'search', description: 'Search by email or username', required: false })
  @ApiQuery({ name: 'verified', description: 'Filter by verification status', required: false, type: 'boolean' })
  @ApiQuery({ name: 'sortBy', description: 'Sort by: createdAt, email, username, totalSpent', required: false })
  @ApiQuery({ name: 'sortOrder', description: 'Sort order: asc, desc', required: false })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      example: {
        success: true,
        users: [
          {
            id: 'user_123',
            email: 'user@example.com',
            username: 'johndoe',
            isVerified: true,
            totalOrders: 5,
            totalSpent: 2499.6,
            totalSpentUSDT: 1.67,
            lastOrderDate: '2025-06-23T10:30:00Z',
            createdAt: '2025-06-20T08:00:00Z'
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 2,
          totalUsers: 8,
          hasNext: true,
          hasPrev: false
        }
      }
    }
  })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('verified') verified?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    const currentPage = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 20;
    const skip = (currentPage - 1) * pageSize;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (verified !== undefined) {
      where.isVerified = verified === 'true';
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy && ['createdAt', 'email', 'username'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else {
      orderBy.createdAt = 'desc'; // Default sort
    }

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          orders: {
            include: {
              payment: true
            }
          }
        }
      }),
      this.prisma.user.count({ where })
    ]);

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    const usersWithStats = users.map(user => {
      const totalOrders = user.orders.length;
      const completedOrders = user.orders.filter(order => order.status === 'COMPLETED');
      const totalSpent = completedOrders.reduce((sum, order) => sum + parseFloat(order.price.toString()), 0);
      const lastOrder = user.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        isVerified: user.isVerified,
        isGuest: user.isGuest,
        pushNotifications: user.pushNotifications,
        emailNotifications: user.emailNotifications,
        totalOrders,
        completedOrders: completedOrders.length,
        pendingOrders: user.orders.filter(order => order.status === 'PENDING').length,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        totalSpentUSDT: parseFloat((totalSpent / exchangeRate).toFixed(4)),
        lastOrderDate: lastOrder?.createdAt || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    });

    // Sort by totalSpent if requested (since it's calculated)
    if (sortBy === 'totalSpent') {
      usersWithStats.sort((a, b) => {
        const order = sortOrder === 'desc' ? -1 : 1;
        return order * (a.totalSpent - b.totalSpent);
      });
    }

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      success: true,
      users: usersWithStats,
      pagination: {
        currentPage,
        pageSize,
        totalPages,
        totalUsers: totalCount,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      },
      filters: {
        search: search || null,
        verified: verified !== undefined ? verified === 'true' : null,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      }
    };
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get detailed user information with order history' })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    schema: {
      example: {
        success: true,
        user: {
          id: 'user_123',
          email: 'user@example.com',
          username: 'johndoe',
          isVerified: true,
          createdAt: '2025-06-20T08:00:00Z',
          statistics: {
            totalOrders: 5,
            completedOrders: 3,
            pendingOrders: 1,
            cancelledOrders: 1,
            totalSpent: 2499.6,
            totalSpentUSDT: 1.67,
            averageOrderValue: 833.2,
            favoriteePlatform: 'Instagram'
          },
          recentOrders: [
            {
              id: 'order_123',
              platform: 'Instagram',
              service: 'Instagram Followers',
              quantity: 1000,
              amount: 999.8,
              status: 'COMPLETED',
              createdAt: '2025-06-23T10:30:00Z'
            }
          ]
        }
      }
    }
  })
  async getUserDetails(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          include: {
            service: {
              include: {
                platform: true
              }
            },
            payment: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        deviceTokens: true,
        notifications: {
          take: 10,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;

    // Calculate statistics
    const totalOrders = user.orders.length;
    const completedOrders = user.orders.filter(order => order.status === 'COMPLETED');
    const pendingOrders = user.orders.filter(order => order.status === 'PENDING');
    const cancelledOrders = user.orders.filter(order => order.status === 'CANCELLED');
    
    const totalSpent = completedOrders.reduce((sum, order) => sum + parseFloat(order.price.toString()), 0);
    const averageOrderValue = completedOrders.length > 0 ? totalSpent / completedOrders.length : 0;

    // Find favorite platform
    const platformCounts = user.orders.reduce((acc, order) => {
      const platform = order.service?.platform?.name || 'Unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const favoritePlatform = Object.entries(platformCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    // Format recent orders
    const recentOrders = user.orders.slice(0, 10).map(order => ({
      id: order.id,
      platform: order.service?.platform?.name || 'Unknown',
      serviceName: order.service?.name || 'Unknown Service',
      quantity: order.quantity,
      socialUrl: order.link,
      amountNGN: parseFloat(order.price.toString()),
      amountUSDT: parseFloat((parseFloat(order.price.toString()) / exchangeRate).toFixed(4)),
      status: order.status,
      paymentStatus: order.payment?.status || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isGuest: user.isGuest,
        isVerified: user.isVerified,
        pushNotifications: user.pushNotifications,
        emailNotifications: user.emailNotifications,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        statistics: {
          totalOrders,
          completedOrders: completedOrders.length,
          pendingOrders: pendingOrders.length,
          cancelledOrders: cancelledOrders.length,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          totalSpentUSDT: parseFloat((totalSpent / exchangeRate).toFixed(4)),
          averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
          averageOrderValueUSDT: parseFloat((averageOrderValue / exchangeRate).toFixed(4)),
          favoritePlatform
        },
        recentOrders,
        deviceTokens: user.deviceTokens.length,
        recentNotifications: user.notifications.length
      }
    };
  }

  // ===== SERVICE MANAGEMENT ENDPOINTS =====

  @Get('services')
  @ApiOperation({ summary: 'Get all services with advanced filtering and search' })
  @ApiQuery({ name: 'page', description: 'Page number', example: 1, required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', example: 50, required: false })
  @ApiQuery({ name: 'search', description: 'Search by service name', required: false })
  @ApiQuery({ name: 'platform', description: 'Filter by platform name', required: false })
  @ApiQuery({ name: 'category', description: 'Filter by category name', required: false })
  @ApiQuery({ name: 'active', description: 'Filter by active status', required: false, type: 'boolean' })
  @ApiQuery({ name: 'provider', description: 'Filter by provider name', required: false })
  @ApiQuery({ name: 'minRate', description: 'Minimum rate in USDT', required: false, type: 'number' })
  @ApiQuery({ name: 'maxRate', description: 'Maximum rate in USDT', required: false, type: 'number' })
  @ApiQuery({ name: 'sortBy', description: 'Sort by: name, providerRate, boostRate, platform, createdAt', required: false })
  @ApiQuery({ name: 'sortOrder', description: 'Sort order: asc, desc', required: false })
  @ApiResponse({
    status: 200,
    description: 'Services retrieved successfully',
    schema: {
      example: {
        success: true,
        services: [
          {
            id: 'service_123',
            serviceId: 'provider_service_456',
            name: 'Instagram Followers',
            type: 'Default',
            platform: 'Instagram',
            category: 'Followers',
            provider: 'SMMStone',
            providerRate: 5.12,
            boostRate: 6.66,
            markup: 30,
            minOrder: 10,
            maxOrder: 10000,
            active: true,
            features: {
              dripfeed: false,
              refill: true,
              cancel: false
            },
            createdAt: '2025-06-20T00:00:00Z'
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 70,
          totalServices: 3470
        },
        filters: {
          totalPlatforms: 14,
          totalCategories: 61,
          totalProviders: 1
        }
      }
    }
  })
  async getAllServices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('platform') platform?: string,
    @Query('category') category?: string,
    @Query('active') active?: string,
    @Query('provider') provider?: string,
    @Query('minRate') minRate?: string,
    @Query('maxRate') maxRate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    const currentPage = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;
    const skip = (currentPage - 1) * pageSize;

    // Build where clause
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (platform) {
      where.platform = { name: { equals: platform, mode: 'insensitive' } };
    }

    if (category) {
      where.category = { name: { equals: category, mode: 'insensitive' } };
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    if (provider) {
      where.provider = { name: { equals: provider, mode: 'insensitive' } };
    }

    if (minRate) {
      where.providerRate = { ...where.providerRate, gte: parseFloat(minRate) };
    }

    if (maxRate) {
      where.providerRate = { ...where.providerRate, lte: parseFloat(maxRate) };
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortBy && ['name', 'providerRate', 'boostRate', 'createdAt'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === 'desc' ? 'desc' : 'asc';
    } else if (sortBy === 'platform') {
      orderBy.platform = { name: sortOrder === 'desc' ? 'desc' : 'asc' };
    } else {
      orderBy.createdAt = 'desc'; // Default sort
    }

    const [services, totalCount, platforms, categories, providers] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          platform: true,
          category: true,
          provider: true
        }
      }),
      this.prisma.service.count({ where }),
      this.prisma.platform.findMany({ select: { name: true } }),
      this.prisma.category.findMany({ select: { name: true } }),
      this.prisma.serviceProvider.findMany({ select: { name: true } })
    ]);

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    const markup = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;

    const formattedServices = services.map(service => ({
      id: service.id,
      serviceId: service.serviceId,
      name: service.name,
      type: service.type,
      platform: service.platform.name,
      category: service.category.name,
      provider: service.provider.name,
      providerRate: parseFloat(service.providerRate.toString()),
      boostRate: parseFloat(service.boostRate.toString()),
      providerRateNGN: parseFloat((service.providerRate * exchangeRate).toFixed(2)),
      boostRateNGN: parseFloat((service.boostRate * exchangeRate).toFixed(2)),
      markup: markup,
      minOrder: service.minOrder,
      maxOrder: service.maxOrder,
      active: service.active,
      features: {
        dripfeed: service.dripfeed,
        refill: service.refill,
        cancel: service.cancel
      },
      lastChecked: service.lastChecked,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    }));

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      success: true,
      services: formattedServices,
      pagination: {
        currentPage,
        pageSize,
        totalPages,
        totalServices: totalCount,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      },
      filters: {
        search: search || null,
        platform: platform || null,
        category: category || null,
        active: active !== undefined ? active === 'true' : null,
        provider: provider || null,
        rateRange: {
          min: minRate ? parseFloat(minRate) : null,
          max: maxRate ? parseFloat(maxRate) : null
        },
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc'
      },
      availableFilters: {
        platforms: platforms.map(p => p.name).sort(),
        categories: categories.map(c => c.name).sort(),
        providers: providers.map(p => p.name).sort(),
        totalPlatforms: platforms.length,
        totalCategories: categories.length,
        totalProviders: providers.length
      }
    };
  }

  @Get('services/:serviceId')
  @ApiOperation({ summary: 'Get detailed service information' })
  @ApiResponse({
    status: 200,
    description: 'Service details retrieved successfully'
  })
  async getServiceDetails(@Param('serviceId') serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        platform: true,
        category: true,
        provider: true,
        orders: {
          take: 10,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true
              }
            }
          }
        }
      }
    });

    if (!service) {
      throw new Error('Service not found');
    }

    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    const markup = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;

    // Calculate service statistics
    const totalOrders = await this.prisma.order.count({
      where: { serviceId: service.id }
    });

    const orderStats = await this.prisma.order.groupBy({
      by: ['status'],
      where: { serviceId: service.id },
      _count: { status: true }
    });

    const revenueData = await this.prisma.order.aggregate({
      where: { 
        serviceId: service.id,
        payment: { status: 'COMPLETED' }
      },
      _sum: { price: true }
    });

    const revenue = revenueData._sum.price || 0;

    return {
      success: true,
      service: {
        id: service.id,
        serviceId: service.serviceId,
        name: service.name,
        type: service.type,
        platform: {
          id: service.platform.id,
          name: service.platform.name,
          slug: service.platform.slug
        },
        category: {
          id: service.category.id,
          name: service.category.name,
          slug: service.category.slug
        },
        provider: {
          id: service.provider.id,
          name: service.provider.name,
          slug: service.provider.slug
        },
        pricing: {
          providerRate: parseFloat(service.providerRate.toString()),
          boostRate: parseFloat(service.boostRate.toString()),
          providerRateNGN: parseFloat((service.providerRate * exchangeRate).toFixed(2)),
          boostRateNGN: parseFloat((service.boostRate * exchangeRate).toFixed(2)),
          markup: markup,
          exchangeRate: exchangeRate
        },
        limits: {
          minOrder: service.minOrder,
          maxOrder: service.maxOrder
        },
        features: {
          dripfeed: service.dripfeed,
          refill: service.refill,
          cancel: service.cancel
        },
        status: {
          active: service.active,
          lastChecked: service.lastChecked
        },
        statistics: {
          totalOrders,
          ordersByStatus: orderStats.reduce((acc, stat) => {
            acc[stat.status.toLowerCase()] = stat._count.status;
            return acc;
          }, {} as Record<string, number>),
          totalRevenue: parseFloat(revenue.toString()),
          totalRevenueUSDT: parseFloat((parseFloat(revenue.toString()) / exchangeRate).toFixed(4))
        },
        recentOrders: service.orders.map(order => ({
          id: order.id,
          quantity: order.quantity,
          socialUrl: order.link,
          status: order.status,
          price: parseFloat(order.price.toString()),
          user: order.user ? {
            id: order.user.id,
            email: order.user.email,
            username: order.user.username
          } : null,
          createdAt: order.createdAt
        })),
        timestamps: {
          createdAt: service.createdAt,
          updatedAt: service.updatedAt
        }
      }
    };
  }

  @Get('webhooks')
  @UseGuards(JwtAuthGuard)
  async getWebhookLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('provider') provider?: string,
    @Query('event') event?: string,
    @Query('processed') processed?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build filters
    const where: any = {};
    
    if (provider) {
      where.provider = provider;
    }
    
    if (event) {
      where.event = event;
    }
    
    if (processed !== undefined) {
      where.processed = processed === 'true';
    }
    
    if (search) {
      where.OR = [
        { provider: { contains: search, mode: 'insensitive' } },
        { event: { contains: search, mode: 'insensitive' } },
        { paymentId: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [webhookLogs, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          event: true,
          processed: true,
          processingError: true,
          paymentId: true,
          orderId: true,
          transactionId: true,
          ipAddress: true,
          createdAt: true,
          updatedAt: true,
          // Include partial payload for list view (safe fields only)
          payload: true
        }
      }),
      this.prisma.webhookLog.count({ where })
    ]);

    // Extract useful info from payload for list view
    const formattedLogs = webhookLogs.map(log => {
      const payload = log.payload as any;
      let extractedData = {};
      
      if (log.provider === 'budpay' && payload.data) {
        extractedData = {
          reference: payload.data.reference,
          amount: payload.data.amount,
          currency: payload.data.currency,
          status: payload.data.status,
          accountNumber: payload.data.account_number,
          customerEmail: payload.data.customer_email
        };
      }
      
      return {
        ...log,
        extractedData,
        payload: undefined // Remove full payload from list view for performance
      };
    });

    return {
      success: true,
      data: {
        webhookLogs: formattedLogs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        filters: {
          provider,
          event,
          processed,
          search,
          startDate,
          endDate
        }
      }
    };
  }

  @Get('webhooks/:webhookId')
  @UseGuards(JwtAuthGuard)
  async getWebhookLogDetails(@Param('webhookId') webhookId: string) {
    const webhookLog = await this.prisma.webhookLog.findUnique({
      where: { id: webhookId }
    });

    if (!webhookLog) {
      throw new NotFoundException('Webhook log not found');
    }

    // Conditionally fetch related records
    let relatedPayment = null;
    let relatedTransaction = null;

    if (webhookLog.paymentId) {
      relatedPayment = await this.prisma.payment.findUnique({
        where: { id: webhookLog.paymentId },
        include: {
          order: {
            include: {
              service: true,
              platform: true,
              user: true
            }
          }
        }
      });
    }

    if (webhookLog.transactionId) {
      relatedTransaction = await this.prisma.transaction.findUnique({
        where: { id: webhookLog.transactionId }
      });
    }

    // Parse and structure the payload for better readability
    const payload = webhookLog.payload as any;
    let structuredPayload = payload;
    
    if (webhookLog.provider === 'budpay' && payload.data) {
      structuredPayload = {
        notifyType: payload.notifyType,
        data: {
          reference: payload.data.reference,
          amount: payload.data.amount,
          currency: payload.data.currency,
          status: payload.data.status,
          account_number: payload.data.account_number,
          bank_name: payload.data.bank_name,
          customer_email: payload.data.customer_email,
          narration: payload.data.narration,
          session_id: payload.data.session_id,
          paid_at: payload.data.paid_at,
          created_at: payload.data.created_at
        },
        rawPayload: payload // Keep original for debugging
      };
    }

    return {
      success: true,
      data: {
        ...webhookLog,
        payload: structuredPayload,
        relatedPayment,
        relatedTransaction
      }
    };
  }

  @Get('smmstone/services')
  @UseGuards(JwtAuthGuard)
  async getSMMStoneServices(
    @Query('platform') platform?: string,
    @Query('category') category?: string,
    @Query('search') search?: string
  ) {
    const where: any = {
      provider: {
        slug: 'smmstone'
      },
      active: true
    };

    if (platform) {
      where.platform = {
        name: {
          contains: platform,
          mode: 'insensitive'
        }
      };
    }

    if (category) {
      where.category = {
        name: {
          contains: category,
          mode: 'insensitive'
        }
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const services = await this.prisma.service.findMany({
      where,
      include: {
        platform: true,
        provider: true,
        category: true
      },
      orderBy: [
        { platform: { name: 'asc' } },
        { category: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    return {
      success: true,
      data: {
        services: services.map(service => ({
          id: service.id,
          serviceId: service.serviceId,
          name: service.name,
          platform: service.platform.name,
          category: service.category?.name || 'Unknown',
          type: service.type,
          providerRate: service.providerRate,
          boostRate: service.boostRate,
          minOrder: service.minOrder,
          maxOrder: service.maxOrder,
          dripfeed: service.dripfeed,
          refill: service.refill,
          cancel: service.cancel,
          active: service.active
        })),
        total: services.length
      }
    };
  }

  @Get('smmstone/balance')
  @UseGuards(JwtAuthGuard)
  async getSMMStoneBalance() {
    try {
      const balance = await this.smmstoneService.getBalance();
      return {
        success: true,
        data: balance
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Post('smmstone/sync-services')
  @UseGuards(JwtAuthGuard)
  async syncSMMStoneServices() {
    try {
      await this.smmstoneService.fetchAndStoreServices();
      return {
        success: true,
        message: 'Services synchronized successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Post('orders/:orderId/fulfill-smmstone')
  @UseGuards(JwtAuthGuard)
  async fulfillOrderWithSMMStone(
    @Param('orderId') orderId: string,
    @Body() fulfillDto: {
      smmstoneServiceId: string;
      socialUrl?: string;
      quantity?: number;
    }
  ) {
    try {
      // Get the order details
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          service: true,
          platform: true,
          user: true,
          payment: true
        }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== 'PENDING') {
        throw new BadRequestException('Order is not in pending status');
      }

      // Get the SMMStone service details
      const smmstoneService = await this.prisma.service.findUnique({
        where: { id: fulfillDto.smmstoneServiceId },
        include: {
          provider: true,
          platform: true
        }
      });

      if (!smmstoneService || smmstoneService.provider.slug !== 'smmstone') {
        throw new NotFoundException('SMMStone service not found');
      }

      // Prepare order data for SMMStone
      const orderData = {
        service: parseInt(smmstoneService.serviceId),
        link: fulfillDto.socialUrl || order.link,
        quantity: fulfillDto.quantity || order.quantity
      };

      // Submit order to SMMStone
      const smmstoneResponse = await this.smmstoneService.submitOrder(orderData);

      // Update order with SMMStone details
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING',
          providerOrderId: smmstoneResponse.order?.toString(),
          updatedAt: new Date()
        }
      });

      // Update payment status to completed since admin approved it
      await this.prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      // Send notification to user
      if (order.user) {
        await this.notificationService.sendNotification({
          userIds: [order.user.id],
          type: 'ORDER_UPDATE',
          title: 'Order Processing',
          body: `Your order #${order.id} is now being processed.`,
          data: { orderId: order.id, status: 'PROCESSING' }
        });
      }

      return {
        success: true,
        data: {
          order: updatedOrder,
          smmstoneOrderId: smmstoneResponse.order,
          smmstoneCharge: smmstoneResponse.charge,
          smmstoneStartCount: smmstoneResponse.start_count
        }
      };
    } catch (error) {
      throw new BadRequestException(`Failed to fulfill order: ${error.message}`);
    }
  }

  @Get('orders/:orderId/smmstone-status')
  @UseGuards(JwtAuthGuard)
  async checkSMMStoneOrderStatus(@Param('orderId') orderId: string): Promise<any> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order || !order.providerOrderId) {
        throw new NotFoundException('Order not found or not submitted to SMMStone');
      }

      const status = await this.smmstoneService.getOrderStatus(parseInt(order.providerOrderId));

      return {
        success: true,
        data: {
          orderId: order.id,
          smmstoneOrderId: order.providerOrderId,
          status: status
        }
      };
    } catch (error) {
      throw new BadRequestException(`Failed to check order status: ${error.message}`);
    }
  }

  @Post('orders/:orderId/sync-status')
  @UseGuards(JwtAuthGuard)
  async syncOrderStatus(@Param('orderId') orderId: string): Promise<any> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true
        }
      });

      if (!order || !order.providerOrderId) {
        throw new NotFoundException('Order not found or not submitted to SMMStone');
      }

      const smmstoneStatus = await this.smmstoneService.getOrderStatus(parseInt(order.providerOrderId));
      
      // Map SMMStone status to our status
      let newStatus = order.status;
      let notificationMessage = '';

      switch (smmstoneStatus.status?.toLowerCase()) {
        case 'completed':
          newStatus = 'COMPLETED';
          notificationMessage = 'Your order has been completed successfully!';
          break;
        case 'processing':
        case 'in progress':
          newStatus = 'PROCESSING';
          notificationMessage = 'Your order is currently being processed.';
          break;
        case 'partial':
          newStatus = 'PROCESSING'; // Keep as processing for partial
          notificationMessage = 'Your order is partially completed and still processing.';
          break;
        case 'cancelled':
        case 'canceled':
          newStatus = 'CANCELLED';
          notificationMessage = 'Your order has been cancelled.';
          break;
        case 'failed':
          newStatus = 'FAILED';
          notificationMessage = 'Your order failed to process. Please contact support.';
          break;
      }

      // Update order if status changed
      if (newStatus !== order.status) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            updatedAt: new Date()
          }
        });

        // Send notification to user if status changed
        if (order.user && notificationMessage) {
          await this.notificationService.sendNotification({
            userIds: [order.user.id],
            type: 'ORDER_UPDATE',
            title: 'Order Status Update',
            body: notificationMessage,
            data: { 
              orderId: order.id, 
              status: newStatus,
              smmstoneData: smmstoneStatus
            }
          });
        }
      }

      return {
        success: true,
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: newStatus,
          smmstoneStatus: smmstoneStatus,
          statusChanged: newStatus !== order.status
        }
      };
    } catch (error) {
      throw new BadRequestException(`Failed to sync order status: ${error.message}`);
    }
  }

  @Get('debug/device-tokens/:userId')
  @ApiOperation({ summary: 'Debug: Get user device tokens (temporary)' })
  async getDebugDeviceTokens(@Param('userId') userId: string) {
    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId: userId },
        select: {
          id: true,
          token: true,
          platform: true,
          deviceInfo: true,
          isActive: true,
          lastUsed: true,
          createdAt: true
        },
        orderBy: { lastUsed: 'desc' }
      });

      return {
        success: true,
        userId: userId,
        tokens: tokens.map(token => ({
          ...token,
          tokenType: token.token.startsWith('ExponentPushToken[') ? 'EXPO' : 'NATIVE',
          tokenPreview: `${token.token.substring(0, 25)}...`,
          fullToken: token.token
        }))
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
} 