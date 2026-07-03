import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  // Avoid a DB round-trip per service during catalog syncs; the set of
  // platforms/categories is tiny and append-only.
  private platformIdCache = new Map<string, string>();
  private categoryIdCache = new Map<string, string>();

  constructor(private prisma: PrismaService) {}

  private extractPlatformFromService(serviceName: string): string {
    // Common platforms to look for in service names
    const platforms = [
      'Instagram',
      'Facebook',
      'Twitter',
      'YouTube',
      'TikTok',
      'Telegram',
      'LinkedIn',
      'Pinterest',
      'Snapchat',
      'Twitch',
      'Discord',
      'Reddit',
      'Website',
      'SoundCloud'
    ];

    // Find the platform in the service name
    const platform = platforms.find(p => 
      serviceName.toLowerCase().includes(p.toLowerCase())
    );

    return platform || 'Other';
  }

  private extractCategoryFromService(serviceName: string): string {
    // Common service types
    const categories = [
      { name: 'Followers', keywords: ['follower', 'subscriber', 'member'] },
      { name: 'Likes', keywords: ['like', 'heart', 'thumbs up'] },
      { name: 'Views', keywords: ['view', 'play', 'watch'] },
      { name: 'Comments', keywords: ['comment', 'reply'] },
      { name: 'Shares', keywords: ['share', 'repost', 'retweet'] },
      { name: 'Traffic', keywords: ['traffic', 'visit'] },
      { name: 'Engagement', keywords: ['engagement', 'interaction'] }
    ];

    // Find the category based on keywords
    const category = categories.find(cat => 
      cat.keywords.some(keyword => 
        serviceName.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    return category ? category.name : 'Other';
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  async createPlatformIfNotExists(name: string): Promise<string> {
    const cached = this.platformIdCache.get(name);
    if (cached) return cached;

    const slug = this.slugify(name);

    const platform = await this.prisma.platform.upsert({
      where: { name },
      update: {},
      create: {
        name,
        slug,
        active: true
      }
    });

    this.platformIdCache.set(name, platform.id);
    return platform.id;
  }

  async createCategoryIfNotExists(name: string, platformId: string): Promise<string> {
    const cacheKey = `${platformId}|${name}`;
    const cached = this.categoryIdCache.get(cacheKey);
    if (cached) return cached;

    const slug = this.slugify(name);

    const category = await this.prisma.category.upsert({
      where: {
        platformId_slug: {
          platformId,
          slug
        }
      },
      update: {},
      create: {
        name,
        slug,
        platformId,
        active: true
      }
    });

    this.categoryIdCache.set(cacheKey, category.id);
    return category.id;
  }

  // Classify a provider service name without touching the DB — used by the
  // sync to filter the catalog down to platforms/categories we actually sell.
  classifyServiceName(serviceName: string): { platform: string; category: string } {
    return {
      platform: this.extractPlatformFromService(serviceName),
      category: this.extractCategoryFromService(serviceName),
    };
  }

  async categorizeService(serviceName: string): Promise<{
    platformId: string;
    categoryId: string;
  }> {
    const platformName = this.extractPlatformFromService(serviceName);
    const categoryName = this.extractCategoryFromService(serviceName);

    const platformId = await this.createPlatformIfNotExists(platformName);
    const categoryId = await this.createCategoryIfNotExists(categoryName, platformId);

    return { platformId, categoryId };
  }
} 