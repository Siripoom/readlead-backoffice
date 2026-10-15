import 'server-only'

import { createHmac, hkdfSync } from 'node:crypto'

export class CreatorMediaTokenConfigError extends Error {
  constructor() {
    super('WRITER_APPLICATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
    this.name = 'CreatorMediaTokenConfigError'
  }
}

export function creatorMediaObjectToken(workId: string) {
  const encoded = process.env.WRITER_APPLICATION_ENCRYPTION_KEY?.trim()
  const master = encoded ? Buffer.from(encoded, 'base64') : null
  if (!master || master.length !== 32) throw new CreatorMediaTokenConfigError()
  const key = Buffer.from(hkdfSync('sha256', master, Buffer.from('readlead-creator-media-token-v1'), Buffer.from('object-prefix'), 32))
  return createHmac('sha256', key).update(workId).digest('hex').slice(0, 24)
}
