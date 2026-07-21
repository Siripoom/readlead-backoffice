export const dynamic = 'force-dynamic'

import { ReportTable } from '@/components/report/ReportTable'
import { getReports } from '@/lib/db/reports'
import type { ReportStatus as DbReportStatus, ReportType as DbReportType } from '@/lib/generated/prisma/enums'
import type { ReportItem, ReportStatus, ReportType } from '@/lib/mock-data/report'
import { requireAdmin } from '@/lib/auth'

const typeLabels: Record<DbReportType, ReportType> = {
  inappropriate_content: 'เนื้อหาไม่เหมาะสม',
  spam: 'สแปม',
  copyright: 'ละเมิดลิขสิทธิ์',
  harassment: 'ล่วงละเมิด',
  account_security: 'บัญชีและความปลอดภัย',
  payment: 'การเติมเงิน / ชำระเงิน',
  content: 'เนื้อหา / นิยาย',
  feedback: 'ข้อเสนอแนะ',
  other: 'อื่นๆ',
}

const statusLabels: Record<DbReportStatus, ReportStatus> = {
  open: 'open',
  in_progress: 'in-progress',
  resolved: 'resolved',
}

export default async function ReportPage() {
  await requireAdmin('reports')
  const raw = await getReports()
  const reports: ReportItem[] = raw.map((r) => ({
    id: r.id,
    sender: r.senderName,
    subject: r.subject,
    type: typeLabels[r.type],
    date: r.date.toISOString().split('T')[0],
    status: statusLabels[r.status],
    message: r.message,
    support: r.isSupport,
  }))

  return <ReportTable data={reports} />
}
