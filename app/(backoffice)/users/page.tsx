import { Box } from '@chakra-ui/react'
import { Suspense } from 'react'
import { UsersPanel } from '@/components/users/UsersPanel'
import { requireAdmin } from '@/lib/auth'

export default async function UsersPage() {
  await requireAdmin('users')
  return (
    <Box>
      <Box mb={6}>
        <div className="rl-page-title">จัดการผู้ใช้</div>
        <div className="rl-page-sub">บัญชีนักอ่าน นักเขียน และผู้ดูแลระบบ</div>
      </Box>
      <Suspense>
        <UsersPanel />
      </Suspense>
    </Box>
  )
}
