// Run with B2 and DATABASE_URL configured: npx tsx scripts/migrate-topup-slips.ts
// Safe to repeat. Verifies the private copy before removing the public object.
import 'dotenv/config'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function storage(region: string, bucket: string, keyId: string, appKey: string) {
  return new S3Client({
    region,
    endpoint: process.env.B2_ENDPOINT?.trim() || `https://s3.${region}.backblazeb2.com`,
    forcePathStyle: true,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  })
}

function missing(error: unknown) {
  return error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')
}

async function exists(client: S3Client, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    if (missing(error)) return false
    throw error
  }
}

async function main() {
  const publicRegion = required('B2_REGION')
  const publicBucket = required('B2_BUCKET')
  const privateBucket = required('B2_PRIVATE_BUCKET')
  if (publicBucket === privateBucket) throw new Error('B2_PRIVATE_BUCKET must differ from B2_BUCKET')
  const publicKeyId = required('B2_KEY_ID')
  const publicAppKey = required('B2_APP_KEY')
  const publicClient = storage(publicRegion, publicBucket, publicKeyId, publicAppKey)
  const privateClient = storage(
    process.env.B2_PRIVATE_REGION?.trim() || publicRegion,
    privateBucket,
    process.env.B2_PRIVATE_KEY_ID?.trim() || publicKeyId,
    process.env.B2_PRIVATE_APP_KEY?.trim() || publicAppKey,
  )
  const prefix = (process.env.B2_TOPUP_UPLOAD_PREFIX?.trim() || 'topup-proofs').replace(/^\/+|\/+$/g, '')
  const prisma = new PrismaClient({ adapter: new PrismaPg({
    connectionString: required('DATABASE_URL'),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  }) })
  let cursor: string | undefined
  let moved = 0
  let removed = 0
  try {
    while (true) {
      const rows = await prisma.coinTopUpRequest.findMany({
        where: { paymentMethod: 'proof-upload', slipObjectKey: { not: null } },
        select: { id: true, slipObjectKey: true, slipUrl: true, slipContentType: true },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (!rows.length) break
      for (const row of rows) {
        cursor = row.id
        const key = row.slipObjectKey!
        if (!key.startsWith(`${prefix}/`)) throw new Error(`Unexpected slip key for ${row.id}`)
        const publicExists = await exists(publicClient, publicBucket, key)
        if (publicExists) {
          const source = await publicClient.send(new GetObjectCommand({ Bucket: publicBucket, Key: key }))
          if (!source.Body) throw new Error(`Missing source body for ${row.id}`)
          const body = await source.Body.transformToByteArray()
          await privateClient.send(new PutObjectCommand({
            Bucket: privateBucket, Key: key, Body: body, ContentLength: body.byteLength,
            ContentType: row.slipContentType || source.ContentType || 'application/octet-stream',
            CacheControl: 'private, no-store',
          }))
          moved += 1
        }
        if (row.slipUrl || publicExists) {
          if (!await exists(privateClient, privateBucket, key)) throw new Error(`Private copy missing for ${row.id}`)
          if (row.slipUrl) await prisma.coinTopUpRequest.update({ where: { id: row.id }, data: { slipUrl: null } })
          if (publicExists) {
            await publicClient.send(new DeleteObjectCommand({ Bucket: publicBucket, Key: key }))
            removed += 1
          }
        }
      }
    }
    console.log({ moved, removed })
  } finally {
    await prisma.$disconnect()
    publicClient.destroy()
    privateClient.destroy()
  }
}

main().catch((error) => {
  console.error('Top-up slip migration failed', { errorName: error instanceof Error ? error.name : 'UnknownError' })
  process.exitCode = 1
})
