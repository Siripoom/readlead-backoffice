import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'
import {
  decryptWithdrawalDestination,
  decryptWriterApplicationPayload,
  encryptWithdrawalDestination,
  encryptWriterApplicationPayload,
} from '../lib/writer-application-crypto'

const BATCH_SIZE = 100
const apply = process.argv.includes('--apply')
if (process.argv.slice(2).some((arg) => arg !== '--apply')) {
  throw new Error('Only --apply is supported')
}

function databaseConfig() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')
  const url = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL')
  if (['disable', 'allow', 'prefer', 'no-verify'].includes(url.searchParams.get('sslmode') ?? '')) {
    throw new Error('DATABASE_URL must not disable TLS verification')
  }
  url.searchParams.delete('sslmode')
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  if (!local && process.env.DATABASE_SSL !== 'true') throw new Error('Remote DATABASE_URL requires DATABASE_SSL=true')
  return {
    connectionString: url.toString(),
    ssl: local && process.env.DATABASE_SSL !== 'true' ? false : { rejectUnauthorized: true },
  }
}

type Counts = { scanned: number; legacy: number; migrated: number; wouldMigrate: number; alreadyV2: number; empty: number; concurrent: number }
function counts(): Counts {
  return { scanned: 0, legacy: 0, migrated: 0, wouldMigrate: 0, alreadyV2: 0, empty: 0, concurrent: 0 }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseConfig()) })
  const writer = counts()
  const withdrawal = counts()
  try {
    let cursor: string | undefined
    while (true) {
      const rows: Array<{ id: string; encryptedPayload: string }> = await prisma.writerApplication.findMany({
        select: { id: true, encryptedPayload: true }, orderBy: { id: 'asc' }, take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (!rows.length) break
      cursor = rows[rows.length - 1].id
      for (const row of rows) {
        writer.scanned++
        if (row.encryptedPayload.startsWith('v2.')) { writer.alreadyV2++; continue }
        if (!row.encryptedPayload.startsWith('v1.')) throw new Error('Unexpected writer application envelope version')
        writer.legacy++
        const payload = decryptWriterApplicationPayload(row.encryptedPayload, row.id)
        if (!apply) { writer.wouldMigrate++; continue }
        const next = encryptWriterApplicationPayload(payload, row.id)
        const result = await prisma.writerApplication.updateMany({
          where: { id: row.id, encryptedPayload: row.encryptedPayload },
          data: { encryptedPayload: next },
        })
        if (result.count === 1) writer.migrated++
        else writer.concurrent++
      }
    }

    cursor = undefined
    while (true) {
      const rows: Array<{ id: string; encryptedDestination: string | null }> = await prisma.withdrawalRequest.findMany({
        select: { id: true, encryptedDestination: true }, orderBy: { id: 'asc' }, take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (!rows.length) break
      cursor = rows[rows.length - 1].id
      for (const row of rows) {
        withdrawal.scanned++
        const old = row.encryptedDestination
        if (old === null) { withdrawal.empty++; continue }
        if (old.startsWith('v2.')) { withdrawal.alreadyV2++; continue }
        if (!old.startsWith('v1.')) throw new Error('Unexpected withdrawal destination envelope version')
        withdrawal.legacy++
        const payload = decryptWithdrawalDestination(old, row.id)
        if (!apply) { withdrawal.wouldMigrate++; continue }
        const next = encryptWithdrawalDestination(payload, row.id)
        const result = await prisma.withdrawalRequest.updateMany({
          where: { id: row.id, encryptedDestination: old },
          data: { encryptedDestination: next },
        })
        if (result.count === 1) withdrawal.migrated++
        else withdrawal.concurrent++
      }
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', writer, withdrawal }))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Private payload migration failed', { errorName: error instanceof Error ? error.name : 'UnknownError' })
  process.exitCode = 1
})
