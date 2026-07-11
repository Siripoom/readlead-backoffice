export const dynamic = 'force-dynamic'

import { PunishmentOverview } from '@/components/punishment/PunishmentOverview'
import { requireAdmin } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export default async function PunishmentPage() {
  await requireAdmin('punishment')
  const prisma = getPrisma()
  const [records, levels, users] = await Promise.all([
    prisma.punishmentRecord.findMany({ orderBy: { date: 'desc' }, include: { user: { select: { name: true, email: true } } } }),
    prisma.punishmentLevel.findMany({ orderBy: { level: 'asc' } }),
    prisma.user.findMany({ where: { userType: { not: 'admin' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
  ])

  return <PunishmentOverview
    initialRecords={records.map((record) => ({
      id: record.id,
      userId: record.userId,
      user: record.user,
      levelName: record.levelName,
      date: record.date.toISOString(),
      note: record.note,
      status: record.status,
      expiresAt: record.expiresAt?.toISOString() ?? null,
    }))}
    levels={levels}
    users={users}
  />
}
