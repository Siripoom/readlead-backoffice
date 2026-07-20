import 'server-only'

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { decryptWriterDocument, encryptWriterDocument, writerDocumentObjectToken } from '@/lib/writer-application-crypto'

export class WriterDocumentStorageConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing writer document storage configuration: ${missing.join(', ')}`)
    this.name = 'WriterDocumentStorageConfigError'
  }
}

function getConfig() {
  const privateBucket = process.env.B2_PRIVATE_BUCKET?.trim()
  const region = (privateBucket && process.env.B2_PRIVATE_REGION?.trim()) || process.env.B2_REGION?.trim()
  const keyId = (privateBucket && process.env.B2_PRIVATE_KEY_ID?.trim()) || process.env.B2_KEY_ID?.trim()
  const applicationKey = (privateBucket && process.env.B2_PRIVATE_APP_KEY?.trim()) || process.env.B2_APP_KEY?.trim()
  const bucket = privateBucket || process.env.B2_BUCKET?.trim()
  const missing = [
    !region && 'B2_REGION',
    !bucket && 'B2_BUCKET',
    !keyId && 'B2_KEY_ID',
    !applicationKey && 'B2_APP_KEY',
  ].filter((key): key is string => Boolean(key))
  if (missing.length) throw new WriterDocumentStorageConfigError(missing)

  return {
    region: region!,
    bucket: bucket!,
    endpoint: process.env.B2_ENDPOINT?.trim().replace(/\/+$/, '') || `https://s3.${region}.backblazeb2.com`,
    keyId: keyId!,
    applicationKey: applicationKey!,
    prefix: (
      process.env.B2_WRITER_UPLOAD_PREFIX?.trim()
      || process.env.B2_PRIVATE_UPLOAD_PREFIX?.trim()
      || 'writer-applications-encrypted'
    ).replace(/^\/+|\/+$/g, ''),
  }
}

let client: S3Client | undefined
let clientSignature = ''

function getClient(config: ReturnType<typeof getConfig>) {
  const signature = `${config.endpoint}|${config.region}|${config.keyId}|${config.applicationKey}`
  if (!client || signature !== clientSignature) {
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

export async function uploadWriterDocument(input: {
  userId: string
  kind: 'identity' | 'bank'
  body: Uint8Array
  contentType: 'image/jpeg' | 'image/png'
}) {
  const config = getConfig()
  const encryptedBody = encryptWriterDocument(input.body, input.kind)
  const token = writerDocumentObjectToken(input.userId, input.kind)
  const key = [config.prefix, `${token}.rlwd`].filter(Boolean).join('/')

  await getClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: encryptedBody,
    ContentLength: encryptedBody.byteLength,
    ContentType: 'application/octet-stream',
    CacheControl: 'private, no-store',
  }))

  return { key }
}

export async function downloadWriterDocument(input: {
  key: string
  kind: 'identity' | 'bank'
}) {
  const config = getConfig()
  if (!input.key.startsWith(`${config.prefix}/`)) throw new Error('Writer document key is outside the configured prefix')

  const object = await getClient(config).send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
  }))
  if (!object.Body) throw new Error('Writer document body is missing')

  return decryptWriterDocument(await object.Body.transformToByteArray(), input.kind)
}
