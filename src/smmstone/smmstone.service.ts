import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

interface SMMStoneOrderData {
  service: number;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
  comments?: string;
  usernames?: string;
  hashtags?: string;
  hashtag?: string;
  username?: string;
  min?: number;
  max?: number;
  posts?: number;
  old_posts?: number;
  delay?: number;
  expiry?: string;
  answer_number?: string;
}

interface SMMStoneResponse {
  order?: number;
  error?: string;
  charge?: number;
  remains?: number;
  start_count?: number;
  status?: string;
  currency?: string;
}

@Injectable()
export class SmmstoneService {
  private readonly logger = new Logger(SmmstoneService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>('SMMSTONE_API_URL') || 'https://smmstone.com/api/v2';
    this.apiKey = this.configService.get<string>('SMMSTONE_API_KEY');
    
    if (!this.apiKey) {
      this.logger.warn('SMMStone API key not configured');
    }
  }

  /**
   * Make API call to SMMStone
   */
  private async makeApiCall(data: Record<string, any>): Promise<any> {
    try {
      const postData = {
        key: this.apiKey,
        ...data
      };

      this.logger.debug('SMMStone API Request:', postData);

      const response = await axios.post(this.apiUrl, postData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/4.0 (compatible; MSIE 5.01; Windows NT 5.0)'
        },
        transformRequest: [(data) => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(data)) {
            params.append(key, String(value));
          }
          return params.toString();
        }]
      });

      this.logger.debug('SMMStone API Response:', response.data);
      return response.data;
    } catch (error) {
      this.logger.error('SMMStone API Error:', error.response?.data || error.message);
      throw new HttpException(
        `SMMStone API Error: ${error.response?.data?.error || error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Get all services from SMMStone
   */
  async getServices(): Promise<any[]> {
    try {
      const response = await this.makeApiCall({ action: 'services' });
      return Array.isArray(response) ? response : [];
    } catch (error) {
      this.logger.error('Failed to fetch services:', error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<any> {
    try {
      return await this.makeApiCall({ action: 'balance' });
    } catch (error) {
      this.logger.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Submit order to SMMStone
   */
  async submitOrder(orderData: SMMStoneOrderData): Promise<SMMStoneResponse> {
    try {
      this.logger.log(`Submitting order to SMMStone - Service: ${orderData.service}, Link: ${orderData.link}, Quantity: ${orderData.quantity}`);
      
      const response = await this.makeApiCall({
        action: 'add',
        ...orderData
      });

      if (response.error) {
        throw new HttpException(`SMMStone Order Error: ${response.error}`, HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`SMMStone order created successfully - Order ID: ${response.order}`);
      return response;
    } catch (error) {
      this.logger.error('Failed to submit order:', error);
      throw error;
    }
  }

  /**
   * Check single order status
   */
  async getOrderStatus(orderId: number): Promise<SMMStoneResponse> {
    try {
      this.logger.debug(`Checking order status for SMMStone Order ID: ${orderId}`);
      
      const response = await this.makeApiCall({
        action: 'status',
        order: orderId
      });

      this.logger.debug(`Order ${orderId} status:`, response);
      return response;
    } catch (error) {
      this.logger.error(`Failed to check order status for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Check multiple orders status
   */
  async getMultipleOrderStatus(orderIds: number[]): Promise<any> {
    try {
      this.logger.debug(`Checking status for multiple orders: ${orderIds.join(', ')}`);
      
      const response = await this.makeApiCall({
        action: 'status',
        orders: orderIds.join(',')
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to check multiple order status:', error);
      throw error;
    }
  }

  /**
   * Request refill for order
   */
  async requestRefill(orderId: number): Promise<any> {
    try {
      this.logger.log(`Requesting refill for order: ${orderId}`);
      
      const response = await this.makeApiCall({
        action: 'refill',
        order: orderId
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to request refill for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Request refill for multiple orders
   */
  async requestMultipleRefill(orderIds: number[]): Promise<any> {
    try {
      this.logger.log(`Requesting refill for orders: ${orderIds.join(', ')}`);
      
      const response = await this.makeApiCall({
        action: 'refill',
        orders: orderIds.join(',')
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to request multiple refill:', error);
      throw error;
    }
  }

  /**
   * Get refill status
   */
  async getRefillStatus(refillId: number): Promise<any> {
    try {
      const response = await this.makeApiCall({
        action: 'refill_status',
        refill: refillId
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to get refill status for ${refillId}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple refill statuses
   */
  async getMultipleRefillStatus(refillIds: number[]): Promise<any> {
    try {
      const response = await this.makeApiCall({
        action: 'refill_status',
        refills: refillIds.join(',')
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to get multiple refill status:', error);
      throw error;
    }
  }

  /**
   * Cancel orders
   */
  async cancelOrders(orderIds: number[]): Promise<any> {
    try {
      this.logger.log(`Cancelling orders: ${orderIds.join(', ')}`);
      
      const response = await this.makeApiCall({
        action: 'cancel',
        orders: orderIds.join(',')
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to cancel orders:', error);
      throw error;
    }
  }

  /**
   * Fetch and store services in database
   */
  async fetchAndStoreServices(): Promise<void> {
    try {
      this.logger.log('Fetching and storing services from SMMStone API...');
      
      const services = await this.getServices();
      
      if (!services || services.length === 0) {
        this.logger.warn('No services returned from SMMStone API');
        return;
      }

      this.logger.log(`Fetched ${services.length} services from SMMStone`);
      
      // Process and store services
      await this.processServices(services);
      
      this.logger.log('Services successfully synchronized');
    } catch (error) {
      this.logger.error('Error syncing services:', error);
      throw error;
    }
  }

  /**
   * Process and store services in database
   */
  private async processServices(services: any[]): Promise<void> {
    try {
          // Ensure SMMStone provider exists
    const provider = await this.prisma.serviceProvider.upsert({
        where: { slug: 'smmstone' },
        update: {},
        create: {
          name: 'SMMStone',
          slug: 'smmstone',
          apiUrl: this.apiUrl,
          apiKey: this.apiKey,
          active: true
        }
      });

      let processedCount = 0;

      for (const service of services) {
        try {
          // Map platform name
          const platformName = this.mapPlatformName(service.category);
          
          // Ensure platform exists
          const platform = await this.prisma.platform.upsert({
            where: { name: platformName },
            update: {},
            create: {
              name: platformName,
              slug: platformName.toLowerCase().replace(/\s+/g, '-'),
              active: true
            }
          });

          // Determine service category
          const categoryName = this.extractCategory(service.name);

          // Ensure category exists
          let category;
          try {
            category = await this.prisma.category.findFirst({
              where: { 
                name: categoryName,
                platformId: platform.id
              }
            });
            
            if (!category) {
              category = await this.prisma.category.create({
                data: {
                  name: categoryName,
                  slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
                  platformId: platform.id
                }
              });
            }
          } catch (error) {
            this.logger.error(`Error creating category ${categoryName}:`, error);
            // Use a default category if creation fails
            category = await this.prisma.category.findFirst({
              where: { platformId: platform.id }
            });
            if (!category) {
              category = await this.prisma.category.create({
                data: {
                  name: 'General',
                  slug: 'general',
                  platformId: platform.id
                }
              });
            }
          }

          // Store service
          await this.prisma.service.upsert({
            where: { 
              serviceId_providerId: {
                serviceId: service.service,
                providerId: provider.id
              }
            },
            update: {
              name: service.name,
              type: service.type,
              providerRate: parseFloat(service.rate),
              boostRate: parseFloat(service.rate) * 1.3, // Apply 30% markup
              minOrder: parseInt(service.min),
              maxOrder: parseInt(service.max),
              dripfeed: service.dripfeed === '1' || service.dripfeed === true,
              refill: service.refill === '1' || service.refill === true,
              cancel: service.cancel === '1' || service.cancel === true,
              active: true
            },
            create: {
              serviceId: service.service,
              providerId: provider.id,
              platformId: platform.id,
              categoryId: category.id,
              name: service.name,
              type: service.type,
              providerRate: parseFloat(service.rate),
              boostRate: parseFloat(service.rate) * 1.3, // Apply 30% markup
              minOrder: parseInt(service.min),
              maxOrder: parseInt(service.max),
              dripfeed: service.dripfeed === '1' || service.dripfeed === true,
              refill: service.refill === '1' || service.refill === true,
              cancel: service.cancel === '1' || service.cancel === true,
              active: true
            }
          });

          processedCount++;
        } catch (error) {
          this.logger.error(`Failed to process service ${service.service}: ${error.message}`);
        }
      }

      this.logger.log(`Successfully processed ${processedCount}/${services.length} services`);
    } catch (error) {
      this.logger.error('Error processing services:', error);
      throw error;
    }
  }

  /**
   * Map platform name from service category
   */
  private mapPlatformName(category: string): string {
    const categoryLower = category.toLowerCase();
    
    if (categoryLower.includes('instagram')) return 'Instagram';
    if (categoryLower.includes('youtube')) return 'YouTube';
    if (categoryLower.includes('tiktok')) return 'TikTok';
    if (categoryLower.includes('facebook')) return 'Facebook';
    if (categoryLower.includes('twitter') || categoryLower.includes('x.com')) return 'Twitter';
    if (categoryLower.includes('linkedin')) return 'LinkedIn';
    if (categoryLower.includes('telegram')) return 'Telegram';
    if (categoryLower.includes('discord')) return 'Discord';
    if (categoryLower.includes('spotify')) return 'Spotify';
    if (categoryLower.includes('soundcloud')) return 'SoundCloud';
    if (categoryLower.includes('twitch')) return 'Twitch';
    if (categoryLower.includes('snapchat')) return 'Snapchat';
    if (categoryLower.includes('pinterest')) return 'Pinterest';
    if (categoryLower.includes('reddit')) return 'Reddit';
    
    return 'Other';
  }

  /**
   * Extract service category from name
   */
  private extractCategory(serviceName: string): string {
    const nameLower = serviceName.toLowerCase();
    
    if (nameLower.includes('follower')) return 'Followers';
    if (nameLower.includes('like')) return 'Likes';
    if (nameLower.includes('view')) return 'Views';
    if (nameLower.includes('comment')) return 'Comments';
    if (nameLower.includes('share')) return 'Shares';
    if (nameLower.includes('subscriber')) return 'Subscribers';
    if (nameLower.includes('member')) return 'Members';
    if (nameLower.includes('reaction')) return 'Reactions';
    if (nameLower.includes('story')) return 'Story Views';
    if (nameLower.includes('reel')) return 'Reels';
    if (nameLower.includes('live')) return 'Live Stream';
    if (nameLower.includes('playlist')) return 'Playlist';
    
    return 'Other';
  }

  /**
   * Scheduled job to check order statuses every 15 minutes
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async checkAllOrderStatuses(): Promise<void> {
    try {
      this.logger.log('Running scheduled order status check...');

      // Get all processing orders that have provider order IDs
      const processingOrders = await this.prisma.order.findMany({
        where: {
          status: {
            in: ['PROCESSING']
          },
          providerOrderId: {
            not: null
          }
        },
        include: {
          user: true
        }
      });

      if (processingOrders.length === 0) {
        this.logger.log('No processing orders found to check');
        return;
      }

      this.logger.log(`Checking status for ${processingOrders.length} processing orders`);

      // Group orders by chunks of 100 (SMMStone limit)
      const chunks = this.chunkArray(processingOrders, 100);

      for (const chunk of chunks) {
        try {
          const orderIds = chunk.map(order => parseInt(order.providerOrderId!));
          const statuses = await this.getMultipleOrderStatus(orderIds);

          // Process each status update
          for (const order of chunk) {
            try {
              const providerOrderId = parseInt(order.providerOrderId!);
              const statusData = Array.isArray(statuses) 
                ? statuses.find(s => s.order === providerOrderId)
                : statuses[providerOrderId];

              if (statusData) {
                await this.updateOrderStatus(order, statusData);
              }
            } catch (error) {
              this.logger.error(`Failed to update status for order ${order.id}:`, error);
            }
          }

          // Small delay between chunks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          this.logger.error('Failed to check chunk of orders:', error);
        }
      }

      this.logger.log('Completed scheduled order status check');
    } catch (error) {
      this.logger.error('Error in scheduled order status check:', error);
    }
  }

  /**
   * Update single order status based on SMMStone response
   */
  private async updateOrderStatus(order: any, statusData: any): Promise<void> {
    try {
      let newStatus = order.status;
      let notificationMessage = '';
      let shouldNotify = false;

      switch (statusData.status?.toLowerCase()) {
        case 'completed':
          if (order.status !== 'COMPLETED') {
            newStatus = 'COMPLETED';
            notificationMessage = 'Your order has been completed successfully! 🎉';
            shouldNotify = true;
          }
          break;
        case 'processing':
        case 'in progress':
          // Keep as processing, no notification needed
          break;
        case 'partial':
          if (order.status !== 'PROCESSING') {
            newStatus = 'PROCESSING';
            notificationMessage = 'Your order is partially completed and still processing. ⏳';
            shouldNotify = true;
          }
          break;
        case 'cancelled':
        case 'canceled':
          if (order.status !== 'CANCELLED') {
            newStatus = 'CANCELLED';
            notificationMessage = 'Your order has been cancelled. If you have questions, please contact support. ❌';
            shouldNotify = true;
          }
          break;
        case 'failed':
          if (order.status !== 'FAILED') {
            newStatus = 'FAILED';
            notificationMessage = 'Your order failed to process. Please contact our support team for assistance. ⚠️';
            shouldNotify = true;
          }
          break;
      }

      // Update order if status changed
      if (newStatus !== order.status) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: newStatus,
            updatedAt: new Date()
          }
        });

        this.logger.log(`Updated order ${order.id} status: ${order.status} → ${newStatus}`);

        // Send notification to user if status changed significantly
        if (order.user && shouldNotify && notificationMessage) {
          try {
            // Create a simple notification record in the database
            await this.prisma.userNotification.create({
              data: {
                userId: order.user.id,
                type: 'ORDER_UPDATE',
                title: 'Order Status Update',
                body: notificationMessage,
                data: { 
                  orderId: order.id, 
                  status: newStatus,
                  smmstoneData: statusData
                }
              }
            });

            this.logger.log(`Created notification for user ${order.user.id} for order ${order.id}`);
          } catch (notificationError) {
            this.logger.error(`Failed to create notification for order ${order.id}:`, notificationError);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to update order ${order.id} status:`, error);
      throw error;
    }
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 