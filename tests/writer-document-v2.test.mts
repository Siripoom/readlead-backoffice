import assert from 'node:assert/strict'
import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto'
import test, { mock } from 'node:test'

mock.module('server-only', { exports: {} })
const masterKey = Buffer.alloc(32, 7)
process.env.WRITER_APPLICATION_ENCRYPTION_KEY = masterKey.toString('base64')

const { encryptWriterDocument, decryptWriterDocument } = await import('../lib/writer-application-crypto')

test('version 2 binds a document to its owner, application, and kind', () => {
  const body = Uint8Array.of(1, 2, 3, 4)
  const envelope = encryptWriterDocument(body, 'identity', 'user-a', 'application-a')
  assert.equal(Buffer.from(envelope).subarray(0, 5).toString('ascii'), 'RLWD\u0002')
  assert.deepEqual(decryptWriterDocument(envelope, 'identity', 'user-a', 'application-a'), body)
  assert.throws(() => decryptWriterDocument(envelope, 'identity', 'user-b', 'application-a'))
  assert.throws(() => decryptWriterDocument(envelope, 'identity', 'user-a', 'application-b'))
  assert.throws(() => decryptWriterDocument(envelope, 'bank', 'user-a', 'application-a'))
})

test('version 1 documents remain readable with their original kind', () => {
  const body = Buffer.from([5, 6, 7])
  const key = Buffer.from(hkdfSync('sha256', masterKey, Buffer.from('readlead-writer-application-v1'), Buffer.from('document-content'), 32))
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from('readlead:writer-document:v1:bank'))
  const ciphertext = Buffer.concat([cipher.update(body), cipher.final()])
  const envelope = Buffer.concat([Buffer.from('RLWD\u0001'), iv, cipher.getAuthTag(), ciphertext])
  assert.deepEqual(decryptWriterDocument(envelope, 'bank', 'user-a', 'application-a'), new Uint8Array(body))
  assert.throws(() => decryptWriterDocument(envelope, 'identity', 'user-a', 'application-a'))
})
