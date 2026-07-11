import 'server-only'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const requiredKeys = ['B2_REGION', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY'] as const
type RequiredKey = (typeof requiredKeys)[number]

export class BackblazeConfigError extends Error {
  constructor(public readonly missing: RequiredKey[]) {
    super(`Missing Backblaze configuration: ${missing.join(', ')}`)
    this.name = 'BackblazeConfigError'
  }
}

function getConfig() {
  const missing = requiredKeys.filter((key) => !process.env[key]?.trim())
  if (missing.length) throw new BackblazeConfigError(missing)
  const region = process.env.B2_REGION!.trim()
  const bucket = process.env.B2_BUCKET!.trim()
  const endpoint = process.env.B2_ENDPOINT?.trim().replace(/\/+$/, '') || `https://s3.${region}.backblazeb2.com`
  return {
    endpoint,
    region,
    bucket,
    keyId: process.env.B2_KEY_ID!.trim(),
    applicationKey: process.env.B2_APP_KEY!.trim(),
    publicUrl: process.env.B2_PUBLIC_URL?.trim().replace(/\/+$/, '') || `${endpoint}/${encodeURIComponent(bucket)}`,
    prefix: (process.env.B2_UPLOAD_PREFIX?.trim() || 'cms').replace(/^\/+|\/+$/g, ''),
  }
}

let client: S3Client | undefined
let clientSignature = ''

function getClient(config: ReturnType<typeof getConfig>) {
  const signature = `${config.endpoint}|${config.region}|${config.keyId}`
  if (!client || clientSignature !== signature) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.keyId, secretAccessKey: config.applicationKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    })
    clientSignature = signature
  }
  return client
}

function publicObjectUrl(baseUrl: string, key: string) {
  return `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export async function uploadCmsImage(input: { body: Uint8Array; contentType: string; extension: string; size: number; id: string; now?: Date }) {
  const config = getConfig()
  const now = input.now ?? new Date()
  const directory = [config.prefix, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0')].filter(Boolean).join('/')
  const key = `${directory}/${input.id}.${input.extension}`
  await getClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.body,
    ContentLength: input.size,
    ContentType: input.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { key, url: publicObjectUrl(config.publicUrl, key) }
}
