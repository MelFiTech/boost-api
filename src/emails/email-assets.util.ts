/** R2 object keys for email images (upload via npm run r2:sync-assets). */
export const EMAIL_ASSET_KEYS = {
  /** Lime wordmark — for dark backgrounds (matches boost-app lime-logo.png). */
  logo: 'email/boostlab-logo.png',
  /** Dark wordmark — fallback when a client forces a light canvas (matches boost-app dark-logo.png). */
  logoDark: 'email/boostlab-logo-dark.png',
  welcomeBanner: 'email/welcome-banner.png',
} as const;

export type EmailAssetKey = (typeof EMAIL_ASSET_KEYS)[keyof typeof EMAIL_ASSET_KEYS];

/** Local source files synced to R2 by scripts/sync-r2-assets.ts */
export const EMAIL_ASSET_SOURCES: Array<{
  key: EmailAssetKey;
  paths: string[];
  contentType: string;
}> = [
  {
    key: EMAIL_ASSET_KEYS.logo,
    paths: [
      'src/emails/assets/boostlab-logo.png',
      '../boost-app/assets/images/logo/lime-logo.png',
      'src/admin-ui/assets/lime-logo.png',
    ],
    contentType: 'image/png',
  },
  {
    key: EMAIL_ASSET_KEYS.logoDark,
    paths: [
      'src/emails/assets/boostlab-logo-dark.png',
      '../boost-app/assets/images/logo/dark-logo.png',
    ],
    contentType: 'image/png',
  },
  {
    key: EMAIL_ASSET_KEYS.welcomeBanner,
    paths: ['src/emails/assets/welcome-banner.png', 'src/public/welcome.png'],
    contentType: 'image/png',
  },
];

function publicBaseUrl(): string {
  return (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
}

export function getEmailAssetUrl(key: EmailAssetKey | string): string | null {
  const base = publicBaseUrl();
  if (!base) return null;
  return `${base}/${key.replace(/^\//, '')}`;
}

export function getEmailLogoSrc(): string | null {
  return getEmailAssetUrl(EMAIL_ASSET_KEYS.logo);
}

export function getEmailLogoDarkSrc(): string | null {
  return getEmailAssetUrl(EMAIL_ASSET_KEYS.logoDark);
}

export function getWelcomeBannerSrc(): string | null {
  return getEmailAssetUrl(EMAIL_ASSET_KEYS.welcomeBanner);
}

export function isEmailAssetsConfigured(): boolean {
  return publicBaseUrl().length > 0;
}
