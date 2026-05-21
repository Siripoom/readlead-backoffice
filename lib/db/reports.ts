import { getPrisma } from '@/lib/prisma'
import type { ReportStatus } from '@/lib/generated/prisma/enums'

export function getReports() {
  const prisma = getPrisma()
  return prisma.report.findMany({ orderBy: { date: 'desc' } })
}

export function getReportById(id: string) {
  const prisma = getPrisma()
  return prisma.report.findUnique({ where: { id } })
}

export function updateReportStatus(id: string, status: ReportStatus) {
  const prisma = getPrisma()
  return prisma.report.update({ where: { id }, data: { status } })
}
