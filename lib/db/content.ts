import { getPrisma } from '@/lib/prisma'
import type { ContentStatus } from '@/lib/generated/prisma/enums'

export function getContent() {
  const prisma = getPrisma()
  return prisma.content.findMany({ orderBy: { submittedAt: 'desc' } })
}

export function getContentById(id: string) {
  const prisma = getPrisma()
  return prisma.content.findUnique({ where: { id } })
}

export function updateContentStatus(id: string, status: ContentStatus) {
  const prisma = getPrisma()
  return prisma.content.update({ where: { id }, data: { status } })
}
