import { prisma } from '@/lib/prisma'
import type { ReportStatus } from '@/lib/generated/prisma/enums'

export function getReports() {
  return prisma.report.findMany({ orderBy: { date: 'desc' } })
}

export function getReportById(id: string) {
  return prisma.report.findUnique({ where: { id } })
}

export function updateReportStatus(id: string, status: ReportStatus) {
  return prisma.report.update({ where: { id }, data: { status } })
}
