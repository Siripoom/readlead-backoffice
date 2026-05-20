import { Box, Heading, Text } from '@chakra-ui/react'
import { ReportTable } from '@/components/report/ReportTable'
import { getReports } from '@/lib/db/reports'
import type { ReportItem, ReportStatus, ReportType } from '@/lib/mock-data/report'

const typeLabels: Record<string, ReportType> = {
  inappropriate_content: 'เนื้อหาไม่เหมาะสม',
  spam: 'สแปม',
  copyright: 'ละเมิดลิขสิทธิ์',
  harassment: 'ล่วงละเมิด',
  other: 'อื่นๆ',
}

const statusLabels: Record<string, ReportStatus> = {
  open: 'open',
  in_progress: 'in-progress',
  resolved: 'resolved',
}

export default async function ReportPage() {
  const raw = await getReports()
  const reports: ReportItem[] = raw.map(r => ({
    id: r.id,
    sender: r.senderName,
    subject: r.subject,
    type: typeLabels[r.type] ?? 'อื่นๆ',
    date: r.date.toISOString().split('T')[0],
    status: statusLabels[r.status] ?? 'open',
    message: r.message,
  }))

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" color="gray.800">Report</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>รายการข้อความที่ผู้ใช้ส่งมาให้แอดมินตรวจสอบ</Text>
      </Box>
      <ReportTable data={reports} />
    </Box>
  )
}
