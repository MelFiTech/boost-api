import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

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

    return platform.id;
  }

  async createCategoryIfNotExists(name: string, platformId: string): Promise<string> {
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

    return category.id;
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