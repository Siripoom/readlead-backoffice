import assert from 'node:assert/strict'
import { createCipheriv, hkdfSync } from 'node:crypto'
import test, { mock } from 'node:test'

type CommandInput = { Body?: Uint8Array; ContentType?: string; Range?: string }

let storedBody = new Uint8Array()
let storedContentType = 'application/octet-stream'
const getRanges: Array<string | undefined> = []
const returnedByteCounts: number[] = []

class PutObjectCommand {
  constructor(readonly input: CommandInput) {}
}
class GetObjectCommand {
  constructor(readonly input: CommandInput) {}
}
class DeleteObjectCommand {
  constructor(readonly input: CommandInput) {}
}
class S3Client {
  async send(command: PutObjectCommand | GetObjectCommand) {
    if (command instanceof PutObjectCommand) {
      storedBody = Uint8Array.from(command.input.Body ?? [])
      storedContentType = command.input.ContentType ?? 'application/octet-stream'
      return {}
    }
    const range = command.input.Range
    getRanges.push(range)
    const match = range && /^bytes=(\d+)-(\d+)$/.exec(range)
    const body = match
      ? storedBody.subarray(Number(match[1]), Math.min(Number(match[2]) + 1, storedBody.byteLength))
      : storedBody
    returnedByteCounts.push(body.byteLength)
    return {
      Body: { transformToByteArray: async () => body },
      ContentType: storedContentType,
    }
  }
}

mock.module('@aws-sdk/client-s3', {
  exports: { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client },
})
mock.module('server-only', { exports: {} })

const previousEnv = { ...process.env }
Object.assign(process.env, {
  B2_REGION: 'test-region',
  B2_BUCKET: 'test-bucket',
  B2_KEY_ID: 'test-key-id',
  B2_APP_KEY: 'test-app-key',
  B2_CREATOR_STAGING_PREFIX: 'creator-content-encrypted',
  WRITER_APPLICATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
})

const { CreatorMediaRangeError, downloadCreatorMedia, uploadCreatorMedia } = await import('../lib/storage/backblaze')

test.after(() => {
  process.env = previousEnv
})

const plaintext = Uint8Array.from({ length: 3 * 1024 * 1024 }, (_, index) => index % 251)

async function storeChunkedFixture() {
  return uploadCreatorMedia({
    body: plaintext,
    contentType: 'audio/mpeg',
    extension: 'mp3',
    size: plaintext.byteLength,
    id: 'range-test',
    workToken: 'work-token',
  })
}

test('encrypted media range reads only bounded encrypted chunks', async () => {
  const uploaded = await storeChunkedFixture()

  getRanges.length = 0
  returnedByteCounts.length = 0
  const result = await downloadCreatorMedia(uploaded.key, 'bytes=1500000-1500099')

  assert.deepEqual(Buffer.from(result.body), Buffer.from(plaintext.subarray(1_500_000, 1_500_100)))
  assert.equal(result.contentRange, `bytes 1500000-1500099/${plaintext.byteLength}`)
  assert.equal(result.contentLength, 100)
  assert.equal(getRanges.length, 2)
  assert.ok(getRanges.every(Boolean), 'every encrypted range read must use an object-storage Range')
  assert.ok(returnedByteCounts.reduce((sum, count) => sum + count, 0) < plaintext.byteLength / 2)

  getRanges.length = 0
  const full = await downloadCreatorMedia(uploaded.key)
  assert.deepEqual(Buffer.from(full.body), Buffer.from(plaintext))
  assert.deepEqual(getRanges, [undefined])
})

test('invalid chunked media ranges fail after reading only the fixed header', async () => {
  const uploaded = await storeChunkedFixture()
  getRanges.length = 0
  returnedByteCounts.length = 0

  await assert.rejects(
    () => downloadCreatorMedia(uploaded.key, 'bytes=999999999-1000000000'),
    (error: unknown) => error instanceof CreatorMediaRangeError && error.size === plaintext.byteLength,
  )
  assert.deepEqual(getRanges, ['bytes=0-16'])
  assert.deepEqual(returnedByteCounts, [17])
})

test('legacy RLCM1 media remains readable during migration', async () => {
  const objectKey = 'creator-content-encrypted/work-token/legacy.rlcm'
  const baseKey = Buffer.alloc(32, 7)
  const key = Buffer.from(hkdfSync('sha256', baseKey, Buffer.from('readlead-creator-media-v1'), Buffer.from(objectKey), 32))
  const iv = Buffer.alloc(12, 3)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  storedBody = Buffer.concat([Buffer.from('RLCM1'), iv, cipher.getAuthTag(), encrypted])
  storedContentType = 'application/octet-stream'
  getRanges.length = 0

  const result = await downloadCreatorMedia(objectKey, 'bytes=100-199')

  assert.deepEqual(Buffer.from(result.body), Buffer.from(plaintext.subarray(100, 200)))
  assert.equal(result.contentRange, `bytes 100-199/${plaintext.byteLength}`)
  assert.deepEqual(getRanges, ['bytes=0-16', undefined])
})
