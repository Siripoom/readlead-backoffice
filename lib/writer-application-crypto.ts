import 'server-only'

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'

const DOCUMENT_MAGIC = Buffer.from('RLWD', 'ascii')
const DOCUMENT_VERSION = 1
const DOCUMENT_IV_BYTES = 12
const DOCUMENT_TAG_BYTES = 16
const DOCUMENT_HEADER_BYTES = DOCUMENT_MAGIC.length + 1 + DOCUMENT_IV_BYTES + DOCUMENT_TAG_BYTES
type WriterDocumentKind = 'identity' | 'bank'

export class WriterApplicationEncryptionConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WriterApplicationEncryptionConfigError'
  }
}

function getEncryptionKey() {
  const encoded = process.env.WRITER_APPLICATION_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new WriterApplicationEncryptionConfigError('WRITER_APPLICATION_ENCRYPTION_KEY is not configured')

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new WriterApplicationEncryptionConfigError('WRITER_APPLICATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }
  return key
}

function deriveKey(purpose: string) {
  return Buffer.from(hkdfSync(
    'sha256',
    getEncryptionKey(),
    Buffer.from('readlead-writer-application-v1', 'utf8'),
    Buffer.from(purpose, 'utf8'),
    32,
  ))
}

function documentAad(kind: WriterDocumentKind) {
  return Buffer.from(`readlead:writer-document:v${DOCUMENT_VERSION}:${kind}`, 'utf8')
}

export function encryptWriterApplicationPayload(payload: Record<string, string>) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptWriterApplicationPayload(envelope: string): Record<string, string> {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = envelope.split('.')
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedCiphertext || extra.length) {
    throw new Error('Invalid writer application payload envelope')
  }

  const iv = Buffer.from(encodedIv, 'base64url')
  const tag = Buffer.from(encodedTag, 'base64url')
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid writer application payload metadata')

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
  const parsed: unknown = JSON.parse(plaintext)

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid writer application payload')
  const entries = Object.entries(parsed)
  if (entries.some(([, value]) => typeof value !== 'string')) throw new Error('Invalid writer application payload fields')
  return Object.fromEntries(entries) as Record<string, string>
}

export function encryptWriterDocument(body: Uint8Array, kind: WriterDocumentKind) {
  const iv = randomBytes(DOCUMENT_IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', deriveKey('document-content'), iv)
  cipher.setAAD(documentAad(kind))
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()])
  const tag = cipher.getAuthTag()

  return new Uint8Array(Buffer.concat([
    DOCUMENT_MAGIC,
    Buffer.from([DOCUMENT_VERSION]),
    iv,
    tag,
    encrypted,
  ]))
}

export function decryptWriterDocument(envelope: Uint8Array, kind: WriterDocumentKind) {
  const input = Buffer.from(envelope)
  if (input.length <= DOCUMENT_HEADER_BYTES || !input.subarray(0, DOCUMENT_MAGIC.length).equals(DOCUMENT_MAGIC)) {
    throw new Error('Invalid writer document envelope')
  }

  const version = input[DOCUMENT_MAGIC.length]
  if (version !== DOCUMENT_VERSION) throw new Error(`Unsupported writer document version: ${version}`)

  const ivStart = DOCUMENT_MAGIC.length + 1
  const tagStart = ivStart + DOCUMENT_IV_BYTES
  const ciphertextStart = tagStart + DOCUMENT_TAG_BYTES
  const decipher = createDecipheriv('aes-256-gcm', deriveKey('document-content'), input.subarray(ivStart, tagStart))
  decipher.setAAD(documentAad(kind))
  decipher.setAuthTag(input.subarray(tagStart, ciphertextStart))

  return new Uint8Array(Buffer.concat([
    decipher.update(input.subarray(ciphertextStart)),
    decipher.final(),
  ]))
}

export function writerDocumentObjectToken(userId: string, kind: WriterDocumentKind) {
  return createHmac('sha256', deriveKey('document-object-key'))
    .update(userId, 'utf8')
    .update('\0')
    .update(kind, 'utf8')
    .digest('base64url')
}
