import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

mock.module('server-only', { exports: {} })
process.env.WRITER_APPLICATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

const { writerDocumentObjectToken, encryptWriterDocument, decryptWriterDocument } = await import('../lib/writer-application-crypto')

test('KYC document keys differ by submission attempt', () => {
  const first = writerDocumentObjectToken('user-a', 'identity', 'attempt-a')
  const second = writerDocumentObjectToken('user-a', 'identity', 'attempt-b')
  assert.notEqual(first, second)
  assert.notEqual(first, writerDocumentObjectToken('user-a', 'bank', 'attempt-a'))
})

test('new document envelopes use version 2 and authenticate the owner and application', () => {
  const body = Uint8Array.of(1, 2, 3, 4)
  const envelope = encryptWriterDocument(body, 'identity', 'user-a', 'application-a')
  assert.equal(Buffer.from(envelope).subarray(0, 5).toString('ascii'), 'RLWD\u0002')
  assert.deepEqual(decryptWriterDocument(envelope, 'identity', 'user-a', 'application-a'), body)
  assert.throws(() => decryptWriterDocument(envelope, 'bank', 'user-a', 'application-a'))
})
