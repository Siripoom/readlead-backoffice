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

export class CreatorMediaRangeError extends Error {
  constructor(public readonly size: number) { super('Requested creator media range is not satisfiable'); this.name = 'CreatorMediaRangeError' }
}

// RLCM2: fixed header followed by independently authenticated 1 MiB AES-GCM
// records (IV + tag + ciphertext). Fixed record offsets let S3 serve only the
// encrypted chunks needed for a plaintext HTTP Range. RLCM1 stays readable so
// existing objects can be migrated without downtime.
const CREATOR_MEDIA_LEGACY_MAGIC = Buffer.from('RLCM1')
const CREATOR_MEDIA_CHUNKED_MAGIC = Buffer.from('RLCM2')
const CREATOR_MEDIA_CHUNK_SIZE = 1024 * 1024
const CREATOR_MEDIA_HEADER_SIZE = CREATOR_MEDIA_CHUNKED_MAGIC.length + 4 + 8
const CREATOR_MEDIA_IV_SIZE = 12
const CREATOR_MEDIA_TAG_SIZE = 16
const CREATOR_MEDIA_CHUNK_OVERHEAD = CREATOR_MEDIA_IV_SIZE + CREATOR_MEDIA_TAG_SIZE

function creatorMediaKey(objectKey: string, version: 'v1' | 'v2') {
  const encoded = process.env.WRITER_APPLICATION_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new CreatorMediaEncryptionConfigError()
  const base = Buffer.from(encoded, 'base64')
  if (base.length !== 32) throw new CreatorMediaEncryptionConfigError()
  return Buffer.from(hkdfSync('sha256', base, Buffer.from(`readlead-creator-media-${version}`), Buffer.from(objectKey), 32))
}

function creatorMediaChunkAad(objectKey: string, index: number, plaintextLength: number, header: CreatorMediaHeader) {
  return Buffer.from(`RLCM2\0${objectKey}\0${header.chunkSize}\0${header.plaintextSize}\0${index}\0${plaintextLength}`)
}

function encryptCreatorMedia(body: Uint8Array, objectKey: string) {
  const header = Buffer.alloc(CREATOR_MEDIA_HEADER_SIZE)
  CREATOR_MEDIA_CHUNKED_MAGIC.copy(header)
  header.writeUInt32BE(CREATOR_MEDIA_CHUNK_SIZE, CREATOR_MEDIA_CHUNKED_MAGIC.length)
  header.writeBigUInt64BE(BigInt(body.byteLength), CREATOR_MEDIA_CHUNKED_MAGIC.length + 4)
  const chunks: Buffer[] = [header]
  const key = creatorMediaKey(objectKey, 'v2')
  const envelopeHeader = { chunkSize: CREATOR_MEDIA_CHUNK_SIZE, plaintextSize: body.byteLength }
  for (let offset = 0, index = 0; offset < body.byteLength; offset += CREATOR_MEDIA_CHUNK_SIZE, index += 1) {
    const plaintext = body.subarray(offset, Math.min(offset + CREATOR_MEDIA_CHUNK_SIZE, body.byteLength))
    const iv = randomBytes(CREATOR_MEDIA_IV_SIZE)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(creatorMediaChunkAad(objectKey, index, plaintext.byteLength, envelopeHeader))
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    chunks.push(iv, cipher.getAuthTag(), encrypted)
  }
  return Buffer.concat(chunks)
}

function decryptLegacyCreatorMedia(body: Uint8Array, objectKey: string) {
  const bytes = Buffer.from(body)
  if (!bytes.subarray(0, CREATOR_MEDIA_LEGACY_MAGIC.length).equals(CREATOR_MEDIA_LEGACY_MAGIC) || bytes.length < 34) throw new Error('Invalid creator media envelope')
  const ivStart = CREATOR_MEDIA_LEGACY_MAGIC.length
  const decipher = createDecipheriv('aes-256-gcm', creatorMediaKey(objectKey, 'v1'), bytes.subarray(ivStart, ivStart + CREATOR_MEDIA_IV_SIZE))
  decipher.setAuthTag(bytes.subarray(ivStart + CREATOR_MEDIA_IV_SIZE, ivStart + CREATOR_MEDIA_CHUNK_OVERHEAD))
  return Buffer.concat([decipher.update(bytes.subarray(ivStart + CREATOR_MEDIA_CHUNK_OVERHEAD)), decipher.final()])
}

type CreatorMediaHeader = { chunkSize: number; plaintextSize: number }

function parseCreatorMediaHeader(body: Uint8Array): CreatorMediaHeader | null {
  const bytes = Buffer.from(body)
  if (bytes.length < CREATOR_MEDIA_HEADER_SIZE || !bytes.subarray(0, CREATOR_MEDIA_CHUNKED_MAGIC.length).equals(CREATOR_MEDIA_CHUNKED_MAGIC)) return null
  const chunkSize = bytes.readUInt32BE(CREATOR_MEDIA_CHUNKED_MAGIC.length)
  const plaintextSize = Number(bytes.readBigUInt64BE(CREATOR_MEDIA_CHUNKED_MAGIC.length + 4))
  if (!chunkSize || chunkSize > 16 * 1024 * 1024 || !Number.isSafeInteger(plaintextSize) || plaintextSize < 0) throw new Error('Invalid creator media envelope header')
  return { chunkSize, plaintextSize }
}

function creatorMediaChunkPlaintextLength(header: CreatorMediaHeader, index: number) {
  return Math.min(header.chunkSize, header.plaintextSize - index * header.chunkSize)
}

function creatorMediaChunkOffset(header: CreatorMediaHeader, index: number) {
  return CREATOR_MEDIA_HEADER_SIZE + index * (header.chunkSize + CREATOR_MEDIA_CHUNK_OVERHEAD)
}

function decryptCreatorMediaChunks(
  body: Uint8Array,
  objectKey: string,
  header: CreatorMediaHeader,
  firstChunk = 0,
  chunkCount = Math.ceil(header.plaintextSize / header.chunkSize) - firstChunk,
) {
  const bytes = Buffer.from(body)
  const key = creatorMediaKey(objectKey, 'v2')
  const plaintext: Buffer[] = []
  let offset = 0
  for (let index = firstChunk; index < firstChunk + chunkCount; index += 1) {
    const plaintextLength = creatorMediaChunkPlaintextLength(header, index)
    const recordLength = CREATOR_MEDIA_CHUNK_OVERHEAD + plaintextLength
    if (bytes.byteLength - offset < recordLength) throw new Error('Truncated creator media chunk')
    const iv = bytes.subarray(offset, offset + CREATOR_MEDIA_IV_SIZE)
    const tag = bytes.subarray(offset + CREATOR_MEDIA_IV_SIZE, offset + CREATOR_MEDIA_CHUNK_OVERHEAD)
    const encrypted = bytes.subarray(offset + CREATOR_MEDIA_CHUNK_OVERHEAD, offset + recordLength)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(creatorMediaChunkAad(objectKey, index, plaintextLength, header))
    decipher.setAuthTag(tag)
    plaintext.push(Buffer.concat([decipher.update(encrypted), decipher.final()]))
    offset += recordLength
  }
  if (offset !== bytes.byteLength) throw new Error('Invalid creator media chunk data')
  return Buffer.concat(plaintext)
}

function decryptCreatorMedia(body: Uint8Array, objectKey: string) {
  const header = parseCreatorMediaHeader(body)
  if (!header) return decryptLegacyCreatorMedia(body, objectKey)
  return decryptCreatorMediaChunks(body.subarray(CREATOR_MEDIA_HEADER_SIZE), objectKey, header)
}

const MAX_CREATOR_MEDIA_RANGE_BYTES = 8 * 1024 * 1024

function parseCreatorMediaRange(range: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match || (!match[1] && !match[2]) || size <= 0) return null
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null
    return { start: Math.max(0, size - Math.min(suffixLength, MAX_CREATOR_MEDIA_RANGE_BYTES)), end: size - 1 }
  }
  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || requestedEnd < start || start >= size) return null
  return { start, end: Math.min(requestedEnd, size - 1, start + MAX_CREATOR_MEDIA_RANGE_BYTES - 1) }
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
  const signature = `${config.endpoint}|${config.region}|${config.bucket}|${config.keyId}|${config.applicationKey}`
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
  return { key, url: cmsMediaUrlFromKey(key) }
}

function cmsMediaUrlFromKey(key: string) {
  return `/api/public/media/${key.split('/').map(encodeURIComponent).join('/')}`
}

export function cmsMediaUrl(value: string | null | undefined) {
  if (!value) return value
  const config = getConfig()
  const base = `${config.publicUrl}/`
  if (!value.startsWith(base)) return value
  try {
    const key = value.slice(base.length).split('/').map(decodeURIComponent).join('/')
    return key.startsWith(`${config.prefix}/`) ? cmsMediaUrlFromKey(key) : value
  } catch { return value }
}

export async function downloadCmsImage(key: string) {
  const config = getConfig()
  if (!key.startsWith(`${config.prefix}/`) || !/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(key.slice(config.prefix.length + 1))) throw new Error('Invalid CMS image key')
  const object = await getClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
  if (!object.Body) throw new Error('CMS image body is missing')
  return { bytes: await object.Body.transformToByteArray(), contentType: object.ContentType }
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
    CacheControl: 'private, no-store',
  }))
  return { key }
}

export async function downloadReportAttachment(key: string) {
  const config = getConfig()
  const prefix = (process.env.B2_REPORT_UPLOAD_PREFIX?.trim() || 'reports').replace(/^\/+|\/+$/g, '')
  if (!key.startsWith(`${prefix}/`)) throw new Error('Invalid report attachment key')
  const object = await getClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
  if (!object.Body) throw new Error('Report attachment body is missing')
  return object.Body.transformToByteArray()
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
  const config = getTopUpPrivateConfig()
  const prefix = topUpPrefix()
  const key = `${prefix}/${input.requestId}/${input.id}.${input.extension}`
  await getClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.body,
    ContentLength: input.size,
    ContentType: input.contentType,
    CacheControl: 'private, no-store',
  }))
  return { key }
}

function topUpPrefix() {
  return (process.env.B2_TOPUP_UPLOAD_PREFIX?.trim() || 'topup-proofs').replace(/^\/+|\/+$/g, '')
}

function getTopUpPrivateConfig() {
  const publicConfig = getConfig()
  const bucket = process.env.B2_PRIVATE_BUCKET?.trim()
  // B2_BUCKET itself may be private. A separate bucket is optional.
  if (!bucket) return publicConfig
  const region = process.env.B2_PRIVATE_REGION?.trim() || publicConfig.region
  return {
    ...publicConfig,
    bucket,
    region,
    endpoint: process.env.B2_ENDPOINT?.trim().replace(/\/+$/, '') || `https://s3.${region}.backblazeb2.com`,
    keyId: process.env.B2_PRIVATE_KEY_ID?.trim() || publicConfig.keyId,
    applicationKey: process.env.B2_PRIVATE_APP_KEY?.trim() || publicConfig.applicationKey,
  }
}

function assertTopUpKey(key: string) {
  if (!key.startsWith(`${topUpPrefix()}/`)) throw new Error('Top-up proof key is outside the configured prefix')
}

export async function deleteTopUpProof(key: string) {
  assertTopUpKey(key)
  const config = getTopUpPrivateConfig()
  await getClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
}

export async function downloadTopUpProof(key: string, legacy: boolean) {
  assertTopUpKey(key)
  const config = legacy ? getConfig() : getTopUpPrivateConfig()
  const object = await getClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
  if (!object.Body) throw new Error('Top-up proof body is missing')
  return object.Body.transformToByteArray()
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
  const storage = getClient(config)
  if (encrypted && range) {
    const headerObject = await storage.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=0-${CREATOR_MEDIA_HEADER_SIZE - 1}` }))
    if (!headerObject.Body) throw new Error('Creator media body is missing')
    const headerBytes = await headerObject.Body.transformToByteArray()
    const header = parseCreatorMediaHeader(headerBytes)
    if (header) {
      const resolved = parseCreatorMediaRange(range, header.plaintextSize)
      if (!resolved) throw new CreatorMediaRangeError(header.plaintextSize)
      const firstChunk = Math.floor(resolved.start / header.chunkSize)
      const lastChunk = Math.floor(resolved.end / header.chunkSize)
      const encryptedStart = creatorMediaChunkOffset(header, firstChunk)
      const encryptedEnd = creatorMediaChunkOffset(header, lastChunk) + CREATOR_MEDIA_CHUNK_OVERHEAD + creatorMediaChunkPlaintextLength(header, lastChunk) - 1
      const chunkObject = await storage.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=${encryptedStart}-${encryptedEnd}` }))
      if (!chunkObject.Body) throw new Error('Creator media body is missing')
      const chunks = decryptCreatorMediaChunks(await chunkObject.Body.transformToByteArray(), key, header, firstChunk, lastChunk - firstChunk + 1)
      const sliceStart = resolved.start - firstChunk * header.chunkSize
      const body = chunks.subarray(sliceStart, sliceStart + resolved.end - resolved.start + 1)
      return {
        body,
        contentType: chunkObject.ContentType || headerObject.ContentType || 'application/octet-stream',
        contentLength: body.byteLength,
        contentRange: `bytes ${resolved.start}-${resolved.end}/${header.plaintextSize}`,
        acceptRanges: 'bytes',
      }
    }
  }
  const object = await storage.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, ...(!encrypted && range ? { Range: range } : {}) }))
  if (!object.Body) throw new Error('Creator media body is missing')
  let body = encrypted ? decryptCreatorMedia(await object.Body.transformToByteArray(), key) : Buffer.from(await object.Body.transformToByteArray())
  let contentRange = object.ContentRange
  if (encrypted && range) {
    const resolved = parseCreatorMediaRange(range, body.byteLength)
    if (!resolved) throw new CreatorMediaRangeError(body.byteLength)
    contentRange = `bytes ${resolved.start}-${resolved.end}/${body.byteLength}`
    body = body.subarray(resolved.start, resolved.end + 1)
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
