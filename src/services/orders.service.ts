import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, PaymentMethod, OrderPlatform, ServiceType } from '../dto/create-order.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ResendService } from './resend.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly resendService: ResendService,
  ) {}

  async calculateServicePricing(platform: string, service: string, quantity: number, currency: string = 'NGN') {
    this.logger.debug(`Calculating pricing for ${platform} ${service} quantity: ${quantity}`);

    // Find the service from SMMService table that matches platform and service type
    // Map service types to search terms - use exact terms found in the database
    const serviceSearchMap: { [key: string]: string } = {
      'followers': 'Followers',
      'likes': 'Like',
      'views': 'View',
      'comments': 'Comment',
      'shares': 'Share',
      'subscribers': 'Subscrib'
    };

    const searchTerm = serviceSearchMap[service.toLowerCase()] || service;

    // Platform name mapping to handle variations
    const platformMap: { [key: string]: string } = {
      'instagram': 'Instagram',
      'facebook': 'Facebook',
      'twitter': 'Twitter',
      'youtube': 'YouTube',
      'tiktok': 'TikTok',
      'snapchat': 'Snapchat',
      'telegram': 'Telegram',
      'linkedin': 'LinkedIn',
      'pinterest': 'Pinterest',
      'twitch': 'Twitch',
      'discord': 'Discord',
      'reddit': 'Reddit'
    };

    const platformName = platformMap[platform.toLowerCase()] || platform;

    // First try to find services for the specific platform with Nigerian priority
    let serviceRecord = await this.prisma.service.findFirst({
      where: {
        AND: [
          {
            name: {
              contains: platformName, // Use the actual platform requested
              mode: 'insensitive'
            }
          },
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            name: {
              contains: 'Nigeria', // Prioritize Nigerian services
              mode: 'insensitive'
            }
          },
          {
            active: true
          },
          {
            minOrder: { lte: quantity }
          },
          {
            maxOrder: { gte: quantity }
          }
        ]
      },
      orderBy: {
        boostRate: 'asc' // Get cheapest Nigerian option first
      }
    });

    // If no Nigerian service found for the platform, fall back to general services for the platform
    if (!serviceRecord) {
      serviceRecord = await this.prisma.service.findFirst({
        where: {
          AND: [
            {
              name: {
                contains: platformName, // Use the actual platform requested
                mode: 'insensitive'
              }
            },
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              active: true
            },
            {
              minOrder: { lte: quantity }
            },
            {
              maxOrder: { gte: quantity }
            }
          ]
        },
        orderBy: {
          boostRate: 'asc' // Get cheapest option first
        }
      });
    }

    if (!serviceRecord) {
      throw new NotFoundException(
        `No '${service}' service found for platform '${platform}' with quantity ${quantity}. ` +
        `Please check if we support this platform or try a different quantity.`
      );
    }

    // Validate quantity is within limits (double-check)
    if (quantity < serviceRecord.minOrder || quantity > serviceRecord.maxOrder) {
      throw new BadRequestException(
        `Quantity must be between ${serviceRecord.minOrder} and ${serviceRecord.maxOrder} for this service`
      );
    }

    // Calculate price using our boost rate (which includes markup)
    // boostRate is per 1000 units, so we calculate: (boostRate / 1000) * quantity
    const pricePerUnit = serviceRecord.boostRate / 1000;
    const basePriceUSDT = pricePerUnit * quantity;
    
    // Convert to requested currency
    let finalPrice = basePriceUSDT;
    const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
    if (currency === 'NGN') {
      finalPrice = basePriceUSDT * exchangeRate; // USDT to NGN conversion at current exchange rate
    }

    return {
      platform: platform,
      service: service,
      quantity: quantity,
      currency: currency,
      price: Math.round(finalPrice * 100) / 100, // Round to 2 decimal places
      serviceName: serviceRecord.name,
      providerRate: serviceRecord.providerRate,
      ourRate: serviceRecord.boostRate,
      minOrder: serviceRecord.minOrder,
      maxOrder: serviceRecord.maxOrder,
      calculation: {
        pricePerUnit: Math.round(pricePerUnit * 1000000) / 1000000, // 6 decimal places
        basePriceUSDT: Math.round(basePriceUSDT * 100) / 100,
        exchangeRate: currency === 'NGN' ? exchangeRate : 1
      }
    };
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    this.logger.debug(`Creating order for ${createOrderDto.platform} ${createOrderDto.service}`);

    try {
      // Find the service from SMMService table that matches platform and service type
      // Map service types to search terms - use exact terms found in the database
      const serviceSearchMap: { [key: string]: string } = {
        'followers': 'Followers',
        'likes': 'Like',
        'views': 'View',
        'comments': 'Comment',
        'shares': 'Share',
        'subscribers': 'Subscrib'
      };

      const searchTerm = serviceSearchMap[createOrderDto.service.toLowerCase()] || createOrderDto.service;

      // Platform name mapping to handle variations
      const platformMap: { [key: string]: string } = {
        'instagram': 'Instagram',
        'facebook': 'Facebook',
        'twitter': 'Twitter',
        'youtube': 'YouTube',
        'tiktok': 'TikTok',
        'snapchat': 'Snapchat',
        'telegram': 'Telegram',
        'linkedin': 'LinkedIn',
        'pinterest': 'Pinterest',
        'twitch': 'Twitch',
        'discord': 'Discord',
        'reddit': 'Reddit'
      };

      const platformName = platformMap[createOrderDto.platform.toLowerCase()] || createOrderDto.platform;

      // First try to find services for the specific platform with Nigerian priority
      let smmService = await this.prisma.service.findFirst({
        where: {
          AND: [
            {
              name: {
                contains: platformName, // Use the actual platform requested
                mode: 'insensitive'
              }
            },
            {
              name: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              name: {
                contains: 'Nigeria', // Prioritize Nigerian services
                mode: 'insensitive'
              }
            },
            {
              active: true
            },
            {
              minOrder: { lte: createOrderDto.quantity }
            },
            {
              maxOrder: { gte: createOrderDto.quantity }
            }
          ]
        },
        include: {
          category: true,
          platform: true
        },
        orderBy: {
          boostRate: 'asc' // Get cheapest Nigerian option first
        }
      });

      // If no Nigerian service found for the platform, fall back to general services for the platform
      if (!smmService) {
        smmService = await this.prisma.service.findFirst({
          where: {
            AND: [
              {
                name: {
                  contains: platformName, // Use the actual platform requested
                  mode: 'insensitive'
                }
              },
              {
                name: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              },
              {
                active: true
              },
              {
                minOrder: { lte: createOrderDto.quantity }
              },
              {
                maxOrder: { gte: createOrderDto.quantity }
              }
            ]
          },
          include: {
            category: true,
            platform: true
          },
          orderBy: {
            boostRate: 'asc' // Get cheapest option first
          }
        });
      }

      if (!smmService) {
        throw new NotFoundException(
          `No '${createOrderDto.service}' service found for platform '${createOrderDto.platform}' with quantity ${createOrderDto.quantity}. ` +
          `Please check if we support this platform or try a different quantity.`
        );
      }

      // Validate quantity is within limits (double-check)
      if (createOrderDto.quantity < smmService.minOrder || createOrderDto.quantity > smmService.maxOrder) {
        throw new BadRequestException(
          `Quantity must be between ${smmService.minOrder} and ${smmService.maxOrder} for this service`
        );
      }

      // Calculate pricing using boost rate (which includes our markup)
      // boostRate is per 1000 units, so we calculate: (boostRate / 1000) * quantity
      const pricePerUnit = smmService.boostRate / 1000;
      const basePriceUSDT = pricePerUnit * createOrderDto.quantity;
      
      // Convert to requested currency
      let calculatedPrice = basePriceUSDT;
      const exchangeRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 1500;
      if (createOrderDto.currency === 'NGN') {
        calculatedPrice = basePriceUSDT * exchangeRate; // USDT to NGN conversion at current exchange rate
      }

      const providedPrice = parseFloat(createOrderDto.amount);
      
      // Validate price (allow 5% tolerance for rounding differences)
      const priceDifference = Math.abs(calculatedPrice - providedPrice) / calculatedPrice;
      if (priceDifference > 0.05) {
        throw new BadRequestException(
          `Price mismatch. Expected: ${calculatedPrice.toFixed(2)} ${createOrderDto.currency}, but got: ${createOrderDto.amount} ${createOrderDto.currency}. Provider rate: $${smmService.providerRate}, Our rate: $${smmService.boostRate} per 1000`
        );
      }

      // Find or create platform for the order (using the main Platform table)
      let platform = await this.prisma.platform.findFirst({
        where: {
          name: {
            equals: createOrderDto.platform,
            mode: 'insensitive'
          }
        }
      });

      if (!platform) {
        // Create platform if it doesn't exist
        platform = await this.prisma.platform.create({
          data: {
            name: createOrderDto.platform,
            slug: createOrderDto.platform.toLowerCase()
          }
        });
      }

      // Use the found service directly (already includes category and platform)
      const service = smmService;

      // Create order and payment in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create the order - MANUAL APPROVAL REQUIRED
        // Order will remain PENDING until admin manually approves and sends to provider
        const order = await tx.order.create({
          data: {
            platformId: platform.id,
            serviceId: service.id,
            quantity: createOrderDto.quantity,
            link: createOrderDto.socialUrl,
            price: calculatedPrice,
            status: 'PENDING', // Requires admin approval before provider fulfillment
            // Store additional metadata as JSON if needed
          },
          include: {
            platform: true,
            service: true
          }
        });

        // Create payment record - MANUAL APPROVAL WORKFLOW
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount: calculatedPrice,
            currency: createOrderDto.currency,
            method: createOrderDto.paymentMethod === 'ngn' ? 'NGN' : 'CRYPTO',
            status: 'PENDING', // Payment pending admin approval to process order
            exchangeRate: createOrderDto.currency === 'NGN' ? exchangeRate : 1, // USDT rate
          }
        });

        return { order, payment };
      });

      // Send order confirmation email (non-blocking)
      this.sendOrderStatusEmail(result.order.id, 'pending').catch(error => {
        this.logger.warn(`Failed to send order confirmation email for order ${result.order.id}:`, error);
      });

      // Return formatted response
      return {
        id: result.order.id,
        status: 'pending_payment',
        amount: createOrderDto.amount,
        currency: createOrderDto.currency,
        paymentMethod: createOrderDto.paymentMethod,
        platform: createOrderDto.platform,
        service: createOrderDto.service,
        quantity: createOrderDto.quantity,
        socialUrl: createOrderDto.socialUrl,
        createdAt: result.order.createdAt.toISOString(),
        payment: {
          id: result.payment.id,
          status: 'pending',
          amount: createOrderDto.amount,
          currency: createOrderDto.currency,
          method: createOrderDto.paymentMethod
        },
        ...(createOrderDto.comments && { comments: createOrderDto.comments }),
        ...(createOrderDto.userAgent && { userAgent: createOrderDto.userAgent }),
        ...(createOrderDto.deviceInfo && { deviceInfo: createOrderDto.deviceInfo })
      };

    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to create order');
    }
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        platform: true,
        service: true,
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return {
      id: order.id,
      status: order.status.toLowerCase(),
      platform: order.platform.name,
      service: order.service.name,
      quantity: order.quantity,
      socialUrl: order.link,
      price: order.price,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      payment: order.payment ? {
        id: order.payment.id,
        status: order.payment.status.toLowerCase(),
        amount: order.payment.amount.toString(),
        currency: order.payment.currency,
        method: order.payment.method.toLowerCase()
      } : null
    };
  }

  async getOrderStatus(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // TODO: Get actual progress from provider API
    return {
      id: order.id,
      status: order.status.toLowerCase(),
      progress: order.status === 'COMPLETED' ? 100 : 0,
      startCount: 0, // Would come from provider
      remains: order.status === 'COMPLETED' ? 0 : order.quantity
    };
  }

  private async findMatchingService(platformId: string, serviceType: ServiceType, quantity: number) {
    // Find services that match the criteria
    const services = await this.prisma.service.findMany({
      where: {
        platformId,
        active: true,
        minOrder: { lte: quantity },
        maxOrder: { gte: quantity },
        name: {
          contains: serviceType,
          mode: 'insensitive'
        }
      },
      orderBy: {
        boostRate: 'asc' // Get cheapest first
      }
    });

    return services[0] || null;
  }

  private calculatePricing(service: any, orderDto: CreateOrderDto) {
    // Calculate base price using our boost rate (which includes markup)
    // boostRate is per 1000 units, so divide by 1000 and multiply by quantity
    const pricePerUnit = service.boostRate / 1000;
    const basePriceUSDT = pricePerUnit * orderDto.quantity;
    
    // Convert to requested currency
    if (orderDto.currency === 'NGN') {
      return basePriceUSDT * 1500; // USDT to NGN conversion
    }
    
    return basePriceUSDT; // USDT
  }

  // AUTO-CLEANUP: Delete unpaid orders after 3 days
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredOrders() {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // Find orders that are still PENDING and older than 3 days
      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: threeDaysAgo
          }
        },
        include: {
          payment: true
        }
      });

      if (expiredOrders.length === 0) {
        this.logger.log('No expired orders found for cleanup');
        return;
      }

      // Delete orders and their payments
      let deletedCount = 0;
      for (const order of expiredOrders) {
        await this.prisma.$transaction(async (tx) => {
          // Delete payment record first (if exists)
          if (order.payment) {
            await tx.payment.delete({
              where: { orderId: order.id }
            });
          }

          // Delete the order
          await tx.order.delete({
            where: { id: order.id }
          });
        });
        deletedCount++;
      }

      this.logger.log(`Cleaned up ${deletedCount} expired orders older than 3 days`);

    } catch (error) {
      this.logger.error(`Failed to cleanup expired orders: ${error.message}`, error.stack);
    }
  }

  // Manual cleanup method for admin use
  async manualCleanupExpiredOrders(daysOld: number = 3) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: cutoffDate
        }
      },
      include: {
        payment: true
      }
    });

    let deletedCount = 0;
    for (const order of expiredOrders) {
      await this.prisma.$transaction(async (tx) => {
        if (order.payment) {
          await tx.payment.delete({
            where: { orderId: order.id }
          });
        }
        await tx.order.delete({
          where: { id: order.id }
        });
      });
      deletedCount++;
    }

    return {
      success: true,
      message: `Cleaned up ${deletedCount} expired orders older than ${daysOld} days`,
      deletedCount
    };
  }

  /**
   * Send order status email to user
   */
  private async sendOrderStatusEmail(orderId: string, status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'partial') {
    try {
      // Get order details with user information
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          platform: true,
          service: true,
          payment: true,
          // Note: We don't have user relationship in Order model yet
          // For now, we'll skip email sending until user relationship is established
        }
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found for email notification`);
        return;
      }

      // TODO: Add user relationship to Order model to get user email
      // For now, we'll log that we would send an email
      this.logger.debug(`Would send ${status} email for order ${orderId} (${order.service.name})`);

      // Uncomment when user relationship is added:
      /*
      if (order.user?.email) {
        const emailResult = await this.resendService.sendOrderStatusEmail({
          email: order.user.email,
          orderData: {
            orderId: order.id,
            serviceName: order.service.name,
            platform: order.platform.name,
            quantity: order.quantity,
            status: status,
            userName: order.user.name,
            targetUrl: order.link,
          }
        });

        if (emailResult.success) {
          this.logger.log(`Order status email sent for order ${orderId}. Message ID: ${emailResult.messageId}`);
        } else {
          this.logger.error(`Failed to send order status email for order ${orderId}: ${emailResult.error}`);
        }
      }
      */
    } catch (error) {
      this.logger.error(`Error sending order status email for order ${orderId}:`, error);
    }
  }

  /**
   * Update order status and send notification email
   */
  async updateOrderStatus(orderId: string, status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'partial', adminNotes?: string) {
    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: status.toUpperCase() as any,
          updatedAt: new Date(),
          // Add admin notes if provided
          ...(adminNotes && { adminNotes })
        },
        include: {
          platform: true,
          service: true,
          payment: true,
        }
      });

      // Send status update email
      await this.sendOrderStatusEmail(orderId, status);

      this.logger.log(`Order ${orderId} status updated to ${status}`);

      return {
        id: updatedOrder.id,
        status: updatedOrder.status.toLowerCase(),
        platform: updatedOrder.platform.name,
        service: updatedOrder.service.name,
        quantity: updatedOrder.quantity,
        price: updatedOrder.price,
        updatedAt: updatedOrder.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to update order status for ${orderId}:`, error);
      throw new BadRequestException('Failed to update order status');
    }
  }
} 