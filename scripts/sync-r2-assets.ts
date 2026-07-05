/**
 * Upload email assets to Cloudflare R2.
 *
 * Usage: npm run r2:sync-assets
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { EMAIL_ASSET_SOURCES } from '../src/emails/email-assets.util';

function loadEnvFile() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const bucket = process.env.R2_BUCKET_NAME || 'boostlab';
const endpoint = process.env.R2_ENDPOINT;
const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

async function main() {
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ENDPOINT, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY in .env');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`Bucket "${bucket}" is reachable.`);

  for (const asset of EMAIL_ASSET_SOURCES) {
    const filePath = asset.paths
      .map((relative) => join(process.cwd(), relative))
      .find((p) => existsSync(p));

    if (!filePath) {
      console.warn(`Skipped ${asset.key}: file not found`);
      continue;
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: asset.key,
        Body: readFileSync(filePath),
        ContentType: asset.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    console.log(`Uploaded ${asset.key}`);
    if (publicBase) {
      console.log(`  → ${publicBase}/${asset.key}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
