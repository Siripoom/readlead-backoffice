import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { createCipheriv, randomBytes } from 'node:crypto'
mock.module('server-only', { exports: {} })
const { decryptWithdrawalDestination, decryptWriterApplicationPayload, encryptWithdrawalDestination, encryptWriterApplicationPayload } = await import('../lib/writer-application-crypto')

process.env.WRITER_APPLICATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

const bank = { bankName: 'Example Bank', accountNumber: '1234567890', accountName: 'Creator' }

function legacyEnvelope(payload: Record<string, string>) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

test('v2 writer payload is bound to its application row', () => {
  const encrypted = encryptWriterApplicationPayload(bank, 'application-a')
  assert.match(encrypted, /^v2\./)
  assert.deepEqual(decryptWriterApplicationPayload(encrypted, 'application-a'), bank)
  assert.throws(() => decryptWriterApplicationPayload(encrypted, 'application-b'))
  assert.throws(() => decryptWithdrawalDestination(encrypted, 'application-a'))
})

test('v2 withdrawal destination is bound to its withdrawal row', () => {
  const encrypted = encryptWithdrawalDestination(bank, 'withdrawal-a')
  assert.match(encrypted, /^v2\./)
  assert.deepEqual(decryptWithdrawalDestination(encrypted, 'withdrawal-a'), bank)
  assert.throws(() => decryptWithdrawalDestination(encrypted, 'withdrawal-b'))
  assert.throws(() => decryptWriterApplicationPayload(encrypted, 'withdrawal-a'))
})

test('v1 writer payload and withdrawal destination remain readable', () => {
  const encrypted = legacyEnvelope(bank)
  assert.deepEqual(decryptWriterApplicationPayload(encrypted, 'application-a'), bank)
  assert.deepEqual(decryptWithdrawalDestination(encrypted, 'withdrawal-a'), bank)
})
