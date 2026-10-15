import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

mock.module('server-only', { exports: {} })
const { creatorMediaObjectToken } = await import('../lib/creator-media-token')

test('creator media token uses a required purpose-specific key', () => {
  const original = process.env.WRITER_APPLICATION_ENCRYPTION_KEY
  const originalB2 = process.env.B2_APP_KEY
  try {
    delete process.env.WRITER_APPLICATION_ENCRYPTION_KEY
    process.env.B2_APP_KEY = 'storage-key'
    assert.throws(() => creatorMediaObjectToken('work-a'))

    process.env.WRITER_APPLICATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    const first = creatorMediaObjectToken('work-a')
    assert.equal(first, creatorMediaObjectToken('work-a'))
    assert.notEqual(first, creatorMediaObjectToken('work-b'))
    assert.match(first, /^[0-9a-f]{24}$/)
  } finally {
    if (original === undefined) delete process.env.WRITER_APPLICATION_ENCRYPTION_KEY
    else process.env.WRITER_APPLICATION_ENCRYPTION_KEY = original
    if (originalB2 === undefined) delete process.env.B2_APP_KEY
    else process.env.B2_APP_KEY = originalB2
  }
})
