import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PLATFORMS_FROM_NAME = [
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
  'SoundCloud',
  'Spotify',
] as const;

/** Platforms we sell — used to skip irrelevant provider catalog rows during sync. */
export const SELLABLE_PLATFORMS = new Set([
  'Instagram',
  'TikTok',
  'YouTube',
  'Twitter',
  'Facebook',
  'Telegram',
]);

export const SELLABLE_CATEGORIES = new Set([
  'Followers',
  'Likes',
  'Views',
  'Comments',
]);

export function extractPlatformFromServiceName(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  for (const platform of PLATFORMS_FROM_NAME) {
    if (lower.includes(platform.toLowerCase())) {
      return platform;
    }
  }
  if (/\bx\b/.test(lower) || lower.includes('twitter')) return 'Twitter';
  return 'Other';
}

function mapPlatformName(category: string): string {
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

export function extractCategory(serviceName: string): string {
  const nameLower = serviceName.toLowerCase();

  if (nameLower.includes('follower')) return 'Followers';
  if (nameLower.includes('subscriber')) return 'Followers';
  if (nameLower.includes('member')) return 'Followers';
  if (nameLower.includes('like')) return 'Likes';
  if (nameLower.includes('view') || nameLower.includes('watch') || nameLower.includes('play')) return 'Views';
  if (nameLower.includes('comment')) return 'Comments';
  if (nameLower.includes('share') || nameLower.includes('retweet') || nameLower.includes('repost')) return 'Shares';
  if (nameLower.includes('reaction')) return 'Reactions';
  if (nameLower.includes('story')) return 'Story Views';
  if (nameLower.includes('reel')) return 'Reels';
  if (nameLower.includes('live')) return 'Live Stream';
  if (nameLower.includes('playlist')) return 'Playlist';

  return 'Other';
}

/** Panel APIs often use opaque category labels — classify from the service name first. */
export function classifySmmService(
  serviceName: string,
  providerCategory = '',
): { platform: string; category: string } {
  const platformFromName = extractPlatformFromServiceName(serviceName);
  const platformFromCategory = mapPlatformName(providerCategory);
  const platform = platformFromName !== 'Other' ? platformFromName : platformFromCategory;

  const categoryFromName = extractCategory(serviceName);
  const categoryFromProviderCategory = extractCategory(providerCategory);
  const category =
    categoryFromName !== 'Other'
      ? categoryFromName
      : categoryFromProviderCategory !== 'Other'
        ? categoryFromProviderCategory
        : 'Other';

  return { platform, category };
}

export async function syncProviderCatalog(
  prisma: PrismaService,
  logger: Logger,
  provider: { id: string; name: string; slug: string; apiUrl: string; apiKey: string },
  services: Array<Record<string, unknown>>,
  markupMultiplier = 1.3,
  options?: { filterSellable?: boolean },
): Promise<number> {
  let processedCount = 0;
  const filterSellable = options?.filterSellable ?? true;

  for (const service of services) {
    try {
      const serviceName = String(service.name || '');
      const categoryLabel = String(service.category || '');
      const { platform: platformName, category: categoryName } = classifySmmService(
        serviceName,
        categoryLabel,
      );

      if (filterSellable) {
        if (!SELLABLE_PLATFORMS.has(platformName) || !SELLABLE_CATEGORIES.has(categoryName)) {
          continue;
        }
      }

      const serviceId = String(service.service);

      const platform = await prisma.platform.upsert({
        where: { name: platformName },
        update: {},
        create: {
          name: platformName,
          slug: platformName.toLowerCase().replace(/\s+/g, '-'),
          active: true,
        },
      });

      let category = await prisma.category.findFirst({
        where: { name: categoryName, platformId: platform.id },
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            name: categoryName,
            slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
            platformId: platform.id,
          },
        });
      }

      const providerRate = parseFloat(String(service.rate));
      const minOrder = parseInt(String(service.min), 10);
      const maxOrder = parseInt(String(service.max), 10);

      const rowData = {
        name: serviceName,
        type: String(service.type || 'Default'),
        providerCategory: categoryLabel || null,
        providerRate,
        boostRate: providerRate * markupMultiplier,
        minOrder,
        maxOrder,
        platformId: platform.id,
        categoryId: category.id,
        dripfeed: service.dripfeed === '1' || service.dripfeed === true,
        refill: service.refill === '1' || service.refill === true,
        cancel: service.cancel === '1' || service.cancel === true,
        active: true,
      };

      await prisma.service.upsert({
        where: {
          serviceId_providerId: {
            serviceId,
            providerId: provider.id,
          },
        },
        update: rowData,
        create: {
          serviceId,
          providerId: provider.id,
          ...rowData,
        },
      });

      processedCount++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process service ${service.service}: ${message}`);
    }
  }

  logger.log(
    `[${provider.slug}] Processed ${processedCount}/${services.length} services`,
  );
  return processedCount;
}

export async function ensureServiceProvider(
  prisma: PrismaService,
  name: string,
  slug: string,
  apiUrl: string,
  apiKey: string,
) {
  return prisma.serviceProvider.upsert({
    where: { slug },
    update: { apiUrl, apiKey, active: true },
    create: { name, slug, apiUrl, apiKey, active: true },
  });
}
