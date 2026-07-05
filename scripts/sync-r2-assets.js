"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_s3_1 = require("@aws-sdk/client-s3");
const email_assets_util_1 = require("../src/emails/email-assets.util");
function loadEnvFile() {
    const envPath = (0, path_1.join)(process.cwd(), '.env');
    if (!(0, fs_1.existsSync)(envPath))
        return;
    for (const line of (0, fs_1.readFileSync)(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const idx = trimmed.indexOf('=');
        if (idx <= 0)
            continue;
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
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
    const client = new client_s3_1.S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(new client_s3_1.HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" is reachable.`);
    for (const asset of email_assets_util_1.EMAIL_ASSET_SOURCES) {
        const filePath = asset.paths
            .map((relative) => (0, path_1.join)(process.cwd(), relative))
            .find((p) => (0, fs_1.existsSync)(p));
        if (!filePath) {
            console.warn(`Skipped ${asset.key}: file not found`);
            continue;
        }
        await client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: asset.key,
            Body: (0, fs_1.readFileSync)(filePath),
            ContentType: asset.contentType,
            CacheControl: 'public, max-age=31536000, immutable',
        }));
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
//# sourceMappingURL=sync-r2-assets.js.map