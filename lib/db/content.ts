import { prisma } from '@/lib/prisma'
import type { ContentStatus } from '@/lib/generated/prisma/enums'

export function getContent() {
  return prisma.content.findMany({ orderBy: { submittedAt: 'desc' } })
}

export function getContentById(id: string) {
  return prisma.content.findUnique({ where: { id } })
}

export function updateContentStatus(id: string, status: ContentStatus) {
  return prisma.content.update({ where: { id }, data: { status } })
}
