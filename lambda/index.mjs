import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import crypto from 'crypto';

const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION;
const s3 = new S3Client({ region: S3_REGION });
const cf = new CloudFrontClient({});

const BUCKET = process.env.S3_BUCKET;
const CF_DIST_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const AUTH_PIN = process.env.AUTH_PIN;
const JWT_SECRET = process.env.JWT_SECRET;
const VEHICLES_KEY = 'data/vehicles.json';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
};

export async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return respond(200, '');
  }

  const method = event.requestContext?.http?.method;
  const path = event.rawPath;

  try {
    if (path === '/api/auth' && method === 'POST') return await handleAuth(event);

    const auth = verifyToken(event);
    if (!auth.valid) return respond(401, { error: 'Unauthorized' });

    if (path === '/api/vehicles' && method === 'GET') return await handleGetVehicles();
    if (path === '/api/vehicles' && method === 'PUT') return await handlePutVehicles(event);
    if (path === '/api/upload-urls' && method === 'POST') return await handleUploadUrls(event);

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('Handler error:', err);
    return respond(500, { error: 'Internal server error' });
  }
}

// --- Auth ---

async function handleAuth(event) {
  const { pin } = JSON.parse(event.body || '{}');
  if (!pin || pin !== AUTH_PIN) {
    return respond(401, { error: 'Invalid PIN' });
  }
  const token = createToken();
  return respond(200, { token, expiresIn: 86400 });
}

function createToken() {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ sub: 'charsos', iat: now, exp: now + 86400 }));
  const signature = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

function verifyToken(event) {
  const auth = event.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  try {
    const [header, payload, signature] = token.split('.');
    const expected = base64url(
      crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest()
    );
    if (signature !== expected) return { valid: false };
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return { valid: false };
    return { valid: true, data };
  } catch {
    return { valid: false };
  }
}

function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

// --- Vehicles ---

async function handleGetVehicles() {
  const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: VEHICLES_KEY }));
  const body = await result.Body.transformToString();
  return respond(200, JSON.parse(body));
}

async function handlePutVehicles(event) {
  const body = event.body;

  // Validate it's valid JSON
  JSON.parse(body);

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: VEHICLES_KEY,
    Body: body,
    ContentType: 'application/json',
    CacheControl: 'no-cache',
  }));

  let invalidationId = null;
  if (CF_DIST_ID) {
    const inv = await cf.send(new CreateInvalidationCommand({
      DistributionId: CF_DIST_ID,
      InvalidationBatch: {
        CallerReference: `vehicles-${Date.now()}`,
        Paths: { Quantity: 1, Items: ['/data/vehicles.json'] },
      },
    }));
    invalidationId = inv.Invalidation?.Id;
  }

  return respond(200, { ok: true, invalidationId });
}

// --- Upload URLs ---

async function handleUploadUrls(event) {
  const { vehicleSlug, date, count, extensions } = JSON.parse(event.body || '{}');

  if (!vehicleSlug || !date || !count || !extensions) {
    return respond(400, { error: 'Missing required fields: vehicleSlug, date, count, extensions' });
  }

  // Check existing files for this date to avoid collisions
  const prefix = `assets/images/${vehicleSlug}/${date}-`;
  const listResult = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  }));
  const existingCount = listResult.Contents?.length || 0;

  const uploads = [];
  for (let i = 0; i < count; i++) {
    const ext = (extensions[i] || 'jpg').toLowerCase();
    const idx = existingCount + i + 1;
    const key = `assets/images/${vehicleSlug}/${date}-${idx}.${ext}`;
    const cdnUrl = `assets/images/${vehicleSlug}/${date}-${idx}.${ext}`;

    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'heic' ? 'image/heic'
      : ext === 'mov' ? 'video/quicktime'
      : `image/${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    uploads.push({ uploadUrl, cdnUrl, s3Key: key });
  }

  return respond(200, { uploads });
}

// --- Helpers ---

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
