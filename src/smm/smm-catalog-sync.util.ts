import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

function extractCategory(serviceName: string): string {
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

export async function syncProviderCatalog(
  prisma: PrismaService,
  logger: Logger,
  provider: { id: string; name: string; slug: string; apiUrl: string; apiKey: string },
  services: Array<Record<string, unknown>>,
  markupMultiplier = 1.3,
): Promise<number> {
  let processedCount = 0;

  for (const service of services) {
    try {
      const serviceId = String(service.service);
      const categoryLabel = String(service.category || '');
      const platformName = mapPlatformName(categoryLabel);

      const platform = await prisma.platform.upsert({
        where: { name: platformName },
        update: {},
        create: {
          name: platformName,
          slug: platformName.toLowerCase().replace(/\s+/g, '-'),
          active: true,
        },
      });

      const categoryName = extractCategory(String(service.name || ''));

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

      await prisma.service.upsert({
        where: {
          serviceId_providerId: {
            serviceId,
            providerId: provider.id,
          },
        },
        update: {
          name: String(service.name),
          type: String(service.type || 'Default'),
          providerCategory: categoryLabel || null,
          providerRate,
          boostRate: providerRate * markupMultiplier,
          minOrder,
          maxOrder,
          dripfeed: service.dripfeed === '1' || service.dripfeed === true,
          refill: service.refill === '1' || service.refill === true,
          cancel: service.cancel === '1' || service.cancel === true,
          active: true,
        },
        create: {
          serviceId,
          providerId: provider.id,
          platformId: platform.id,
          categoryId: category.id,
          name: String(service.name),
          type: String(service.type || 'Default'),
          providerCategory: categoryLabel || null,
          providerRate,
          boostRate: providerRate * markupMultiplier,
          minOrder,
          maxOrder,
          dripfeed: service.dripfeed === '1' || service.dripfeed === true,
          refill: service.refill === '1' || service.refill === true,
          cancel: service.cancel === '1' || service.cancel === true,
          active: true,
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
