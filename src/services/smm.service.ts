import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformService } from './platform.service';
import axios from 'axios';
import { SMMServiceRequest, ServiceResponse, SMMService as SMMServiceType } from '../types/smm.types';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ServiceRequestDto, Currency } from '../dto/service-request.dto';

@Injectable()
export class SMMService {
  private readonly logger = new Logger(SMMService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly markupPercentage: number;
  private readonly usdtRate: number;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private platformService: PlatformService,
  ) {
    this.apiUrl = this.configService.get<string>('SMMSTONE_API_URL');
    this.apiKey = this.configService.get<string>('SMMSTONE_API_KEY');
    this.markupPercentage = this.configService.get<number>('SMM_MARKUP_PERCENTAGE') || 30;
    this.usdtRate = this.configService.get<number>('USDT_EXCHANGE_RATE') || 0;
  }

  // Only sync services we actually sell — keeps the shared DB lean
  private static readonly ALLOWED_PLATFORMS = new Set([
    'Instagram',
    'TikTok',
    'YouTube',
    'Twitter',
    'Facebook',
    'Telegram',
  ]);
  private static readonly ALLOWED_CATEGORIES = new Set([
    'Followers',
    'Likes',
    'Views',
    'Comments',
  ]);

  private calculateBoostRate(providerRate: number): number {
    return providerRate * (1 + this.markupPercentage / 100);
  }

  async fetchProviderServices(): Promise<SMMServiceType[]> {
    try {
      const data: SMMServiceRequest = {
        key: this.apiKey,
        action: 'services'
      };

      this.logger.debug(`Making API request to ${this.apiUrl}`);
      this.logger.debug(`Request data: ${JSON.stringify(data)}`);

      const params = new URLSearchParams();
      params.append('key', this.apiKey);
      params.append('action', 'services');

      const response = await axios.post(this.apiUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      this.logger.error('Error fetching services from provider:', error.message);
      throw error;
    }
  }

  async syncServices(): Promise<{
    updated: number;
    added: number;
    hasChanges: boolean;
  }> {
    try {
      // Ensure SMMStone provider exists
      const provider = await this.prisma.serviceProvider.upsert({
        where: { slug: 'smmstone' },
        update: {
          apiUrl: this.apiUrl,
          apiKey: this.apiKey,
          active: true
        },
        create: {
          name: 'SMMStone',
          slug: 'smmstone',
          apiUrl: this.apiUrl,
          apiKey: this.apiKey,
          active: true
        }
      });

      const providerServices = await this.fetchProviderServices();
      let updated = 0;
      let added = 0;

      // Keep only platforms/categories we sell
      const relevantServices = providerServices.filter((service) => {
        const { platform, category } = this.platformService.classifyServiceName(service.name);
        return (
          SMMService.ALLOWED_PLATFORMS.has(platform) &&
          SMMService.ALLOWED_CATEGORIES.has(category)
        );
      });
      this.logger.log(
        `Syncing ${relevantServices.length} relevant services (of ${providerServices.length} from provider)`,
      );

      // One bulk read instead of a findFirst per service
      const existingServices = await this.prisma.service.findMany({
        where: { providerId: provider.id },
      });
      const existingByServiceId = new Map<string, (typeof existingServices)[number]>(
        existingServices.map((s) => [s.serviceId, s]),
      );

      const toCreate: any[] = [];
      const toUpdate: Array<{ id: string; data: any }> = [];
      const freshServiceIds = new Set<string>();

      for (const service of relevantServices) {
        const providerRate = parseFloat(service.rate);
        const boostRate = this.calculateBoostRate(providerRate);

        // Categorize the service (platform/category ids are cached in-memory)
        const { platformId, categoryId } = await this.platformService.categorizeService(service.name);

        // SMMStone returns numeric ids/min/max; our columns are String/Int
        const serviceId = String(service.service);
        const minOrder = parseInt(String(service.min), 10);
        const maxOrder = parseInt(String(service.max), 10);
        freshServiceIds.add(serviceId);

        const existingService = existingByServiceId.get(serviceId);

        if (existingService) {
          // Check if there are any changes
          if (
            existingService.name !== service.name ||
            existingService.providerRate !== providerRate ||
            existingService.minOrder !== minOrder ||
            existingService.maxOrder !== maxOrder ||
            existingService.platformId !== platformId ||
            existingService.categoryId !== categoryId ||
            existingService.providerCategory !== (service.category || null) ||
            existingService.dripfeed !== service.dripfeed ||
            existingService.refill !== service.refill ||
            existingService.cancel !== service.cancel
          ) {
            toUpdate.push({
              id: existingService.id,
              data: {
                name: service.name,
                type: service.type,
                providerCategory: service.category || null,
                providerRate,
                boostRate,
                minOrder,
                maxOrder,
                platformId,
                categoryId,
                dripfeed: service.dripfeed,
                refill: service.refill,
                cancel: service.cancel,
                lastChecked: new Date(),
              },
            });
          }
        } else {
          toCreate.push({
            serviceId,
            name: service.name,
            type: service.type,
            providerCategory: service.category || null,
            providerRate,
            boostRate,
            minOrder,
            maxOrder,
            platformId,
            categoryId,
            providerId: provider.id,
            dripfeed: service.dripfeed,
            refill: service.refill,
            cancel: service.cancel,
          });
        }
      }

      // Execute updates in batches instead of one-by-one; a full SMMStone
      // backfill can touch thousands of rows.
      for (let i = 0; i < toUpdate.length; i += 100) {
        const chunk = toUpdate.slice(i, i + 100);
        await this.prisma.$transaction(
          chunk.map((item) =>
            this.prisma.service.update({
              where: { id: item.id },
              data: item.data,
            }),
          ),
        );
        updated += chunk.length;
        this.logger.log(`Sync progress: ${updated}/${toUpdate.length} services updated`);
      }

      // Bulk insert new services in chunks
      for (let i = 0; i < toCreate.length; i += 500) {
        const chunk = toCreate.slice(i, i + 500);
        const result = await this.prisma.service.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        added += result.count;
        this.logger.log(`Sync progress: ${added}/${toCreate.length} new services inserted`);
      }

      // Remove stale services: anything the provider no longer offers or
      // outside the filter. Keep (but deactivate) rows referenced by orders.
      const staleIds = existingServices
        .filter((s) => !freshServiceIds.has(s.serviceId))
        .map((s) => s.id);
      if (staleIds.length > 0) {
        const referenced = await this.prisma.order.findMany({
          where: { serviceId: { in: staleIds } },
          select: { serviceId: true },
          distinct: ['serviceId'],
        });
        const referencedIds = new Set(referenced.map((o) => o.serviceId));
        const deletableIds = staleIds.filter((id) => !referencedIds.has(id));
        const deactivateIds = staleIds.filter((id) => referencedIds.has(id));

        if (deletableIds.length > 0) {
          await this.prisma.service.deleteMany({ where: { id: { in: deletableIds } } });
        }
        if (deactivateIds.length > 0) {
          await this.prisma.service.updateMany({
            where: { id: { in: deactivateIds } },
            data: { active: false },
          });
        }
        this.logger.log(
          `Pruned ${deletableIds.length} stale services, deactivated ${deactivateIds.length} with order history`,
        );
      }

      return {
        updated,
        added,
        hasChanges: updated > 0 || added > 0
      };
    } catch (error) {
      this.logger.error('Error syncing services:', error.message);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkForUpdates() {
    try {
      const { updated, added, hasChanges } = await this.syncServices();
      
      if (hasChanges) {
        // TODO: Implement admin notification
        this.logger.log(`Services updated: ${updated} updated, ${added} added`);
      } else {
        this.logger.log('No service changes detected');
      }
    } catch (error) {
      this.logger.error('Error checking for updates:', error.message);
    }
  }

  async getServices(currency: 'NGN' | 'USDT' = 'USDT'): Promise<ServiceResponse[]> {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      include: {
        platform: true,
        category: true
      },
      orderBy: [
        { platform: { name: 'asc' } },
        { category: { name: 'asc' } }
      ],
    });

    if (currency === 'NGN') {
      const usdtRate = await this.getUSDTtoNGNRate();
      return services.map(service => ({
        ...service,
        boostRate: service.boostRate * usdtRate
      }));
    }

    return services as ServiceResponse[];
  }

  // TODO: Implement this method to get current USDT to NGN rate
  private async getUSDTtoNGNRate(): Promise<number> {
    // For now returning a fixed rate
    return 1500; // 1 USDT = 1500 NGN
  }

  async findBestMatchingService(dto: ServiceRequestDto) {
    // Find the platform
    const platform = await this.prisma.platform.findFirst({
      where: {
        OR: [
          { name: { contains: dto.platform, mode: 'insensitive' } },
          { slug: { contains: dto.platform, mode: 'insensitive' } }
        ],
        active: true
      }
    });

    if (!platform) {
      throw new NotFoundException(`Platform ${dto.platform} not found`);
    }

    // Find the category
    const category = await this.prisma.category.findFirst({
      where: {
        platformId: platform.id,
        OR: [
          { name: { contains: dto.category, mode: 'insensitive' } },
          { slug: { contains: dto.category, mode: 'insensitive' } }
        ],
        active: true
      }
    });

    if (!category) {
      throw new NotFoundException(`Category ${dto.category} not found for platform ${dto.platform}`);
    }

    // Find the best matching service
    const service = await this.prisma.service.findFirst({
      where: {
        platformId: platform.id,
        categoryId: category.id,
        minOrder: { lte: dto.quantity },
        maxOrder: { gte: dto.quantity },
        active: true
      },
      orderBy: {
        boostRate: 'asc' // Get the cheapest service that matches the criteria
      }
    });

    if (!service) {
      throw new NotFoundException(`No suitable service found for ${dto.quantity} ${dto.category} on ${dto.platform}`);
    }

    // Calculate total price
    const priceInUSDT = service.boostRate * dto.quantity;
    const price = dto.currency === Currency.NGN ? priceInUSDT * this.usdtRate : priceInUSDT;

    return {
      service,
      platform,
      category,
      priceDetails: {
        quantity: dto.quantity,
        ratePerItem: service.boostRate,
        currency: dto.currency,
        totalPrice: price,
        exchangeRate: dto.currency === Currency.NGN ? this.usdtRate : 1
      }
    };
  }

  async createServiceOrder(dto: ServiceRequestDto, userId?: string) {
    const { service, platform, priceDetails } = await this.findBestMatchingService(dto);

    // Create the order
    const order = await this.prisma.order.create({
      data: {
        userId,
        platformId: platform.id,
        serviceId: service.id,
        quantity: dto.quantity,
        link: dto.link,
        price: priceDetails.totalPrice,
        payment: {
          create: {
            amount: priceDetails.totalPrice,
            currency: dto.currency,
            method: dto.currency === Currency.NGN ? 'NGN' : 'CRYPTO',
            exchangeRate: priceDetails.exchangeRate
          }
        }
      },
      include: {
        service: true,
        platform: true,
        payment: true
      }
    });

    return order;
  }
} 