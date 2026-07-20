import { Box } from '@chakra-ui/react'
import { WriterApplicationsManager } from '@/components/writer-applications/WriterApplicationsManager'
import { requireAdmin } from '@/lib/auth'

export default async function WriterApplicationsPage() {
  await requireAdmin('users')
  return (
    <Box>
      <Box mb={6}>
        <div className="rl-page-title">ใบสมัครนักเขียน</div>
        <div className="rl-page-sub">ตรวจสอบข้อมูลและเอกสารก่อนอนุมัติสิทธิ์นักเขียน</div>
      </Box>
      <WriterApplicationsManager />
    </Box>
  )
}
