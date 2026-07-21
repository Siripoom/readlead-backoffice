import 'server-only'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const requiredKeys = ['B2_REGION', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY'] as const
type RequiredKey = (typeof requiredKeys)[number]

export class BackblazeConfigError extends Error {
  constructor(public readonly missing: RequiredKey[]) {
    super(`Missing Backblaze configuration: ${missing.join(', ')}`)
    this.name = 'BackblazeConfigError'
  }
}

export class CreatorMediaEncryptionConfigError extends Error {
  constructor() { super('WRITER_APPLICATION_ENCRYPTION_KEY is not configured for creator media'); this.name = 'CreatorMediaEncryptionConfigError' }
}

const CREATOR_MEDIA_MAGIC = Buffer.from('RLCM1')
function creatorMediaKey(objectKey: string) {
  const encoded = process.env.WRITER_APPLICATION_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new CreatorMediaEncryptionConfigError()
  const base = Buffer.from(encoded, 'base64')
  if (base.length !== 32) throw new CreatorMediaEncryptionConfigError()
  return Buffer.from(hkdfSync('sha256', base, Buffer.from('readlead-creator-media-v1'), Buffer.from(objectKey), 32))
}
function encryptCreatorMedia(body: Uint8Array, objectKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', creatorMediaKey(objectKey), iv)
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()])
  return Buffer.concat([CREATOR_MEDIA_MAGIC, iv, cipher.getAuthTag(), encrypted])
}
function decryptCreatorMedia(body: Uint8Array, objectKey: string) {
  const bytes = Buffer.from(body)
  if (!bytes.subarray(0, CREATOR_MEDIA_MAGIC.length).equals(CREATOR_MEDIA_MAGIC) || bytes.length < 34) throw new Error('Invalid creator media envelope')
  const ivStart = CREATOR_MEDIA_MAGIC.length
  const decipher = createDecipheriv('aes-256-gcm', creatorMediaKey(objectKey), bytes.subarray(ivStart, ivStart + 12))
  decipher.setAuthTag(bytes.subarray(ivStart + 12, ivStart + 28))
  return Buffer.concat([decipher.update(bytes.subarray(ivStart + 28)), decipher.final()])
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

export async function uploadReportAttachment(input: { body: Uint8Array; contentType: 'image/jpeg' | 'image/png'; extension: 'jpg' | 'png'; size: number; id: string; reportId: string }) {
  const config = getConfig()
  const prefix = (process.env.B2_REPORT_UPLOAD_PREFIX?.trim() || 'reports').replace(/^\/+|\/+$/g, '')
  const key = `${prefix}/${input.reportId}/${input.id}.${input.extension}`
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

export async function deleteReportAttachment(key: string) {
  const config = getConfig()
  const prefix = (process.env.B2_REPORT_UPLOAD_PREFIX?.trim() || 'reports').replace(/^\/+|\/+$/g, '')
  if (!key.startsWith(`${prefix}/`)) throw new Error('Report attachment key is outside the configured prefix')
  await getClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}

export async function uploadTopUpProof(input: {
  body: Uint8Array
  contentType: 'image/jpeg' | 'image/png'
  extension: 'jpg' | 'png'
  size: number
  id: string
  requestId: string
}) {
  const config = getConfig()
  const prefix = (process.env.B2_TOPUP_UPLOAD_PREFIX?.trim() || 'topup-proofs').replace(/^\/+|\/+$/g, '')
  const key = `${prefix}/${input.requestId}/${input.id}.${input.extension}`
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

export async function deleteTopUpProof(key: string) {
  const config = getConfig()
  const prefix = (process.env.B2_TOPUP_UPLOAD_PREFIX?.trim() || 'topup-proofs').replace(/^\/+|\/+$/g, '')
  if (!key.startsWith(`${prefix}/`)) throw new Error('Top-up proof key is outside the configured prefix')
  await getClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}

export async function uploadCreatorMedia(input: { body: Uint8Array; contentType: string; extension: string; size: number; id: string; workToken: string }) {
  const config = getConfig()
  const prefix = (process.env.B2_CREATOR_STAGING_PREFIX?.trim() || 'creator-content-encrypted').replace(/^\/+|\/+$/g, '')
  const key = `${prefix}/${input.workToken}/${input.id}.rlcm`
  const encrypted = encryptCreatorMedia(input.body, key)
  await getClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: encrypted,
    ContentLength: encrypted.byteLength,
    ContentType: 'application/octet-stream',
    CacheControl: 'private, no-store',
  }))
  return { key, url: publicObjectUrl(config.publicUrl, key) }
}

export async function downloadCreatorMedia(key: string, range?: string | null) {
  const config = getConfig()
  const encryptedPrefix = (process.env.B2_CREATOR_STAGING_PREFIX?.trim() || 'creator-content-encrypted').replace(/^\/+|\/+$/g, '')
  const allowedPrefixes = [config.prefix, encryptedPrefix, (process.env.B2_CREATOR_UPLOAD_PREFIX?.trim() || 'creator-content').replace(/^\/+|\/+$/g, '')]
  if (!allowedPrefixes.some((prefix) => key.startsWith(`${prefix}/`))) throw new Error('Creator media key is outside configured prefixes')
  const encrypted = key.startsWith(`${encryptedPrefix}/`)
  const object = await getClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key, ...(!encrypted && range ? { Range: range } : {}) }))
  if (!object.Body) throw new Error('Creator media body is missing')
  let body = encrypted ? decryptCreatorMedia(await object.Body.transformToByteArray(), key) : Buffer.from(await object.Body.transformToByteArray())
  let contentRange = object.ContentRange
  if (encrypted && range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (match) {
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1
      if (start <= end && start < body.length) { contentRange = `bytes ${start}-${end}/${body.length}`; body = body.subarray(start, end + 1) }
    }
  }
  return { body, contentType: object.ContentType || 'application/octet-stream', contentLength: body.byteLength, contentRange, acceptRanges: 'bytes' }
}

export async function deleteCreatorMedia(key: string) {
  const config = getConfig()
  const encryptedPrefix = (process.env.B2_CREATOR_STAGING_PREFIX?.trim() || 'creator-content-encrypted').replace(/^\/+|\/+$/g, '')
  const allowedPrefixes = [config.prefix, encryptedPrefix, (process.env.B2_CREATOR_UPLOAD_PREFIX?.trim() || 'creator-content').replace(/^\/+|\/+$/g, '')]
  if (!allowedPrefixes.some((prefix) => key.startsWith(`${prefix}/`))) throw new Error('Creator media key is outside configured prefixes')
  await getClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}
