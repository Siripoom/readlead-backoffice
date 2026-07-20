export const dynamic = 'force-dynamic'

import { Box, Heading, Text } from '@chakra-ui/react'
import { CreatorModerationPanel } from '@/components/content/CreatorModerationPanel'
import { requireAdmin } from '@/lib/auth'

export default async function ContentPage() {
  await requireAdmin('cms')
  return <Box><Box mb={6}><Heading size="lg" color="gray.800">ตรวจผลงาน Creator Studio</Heading><Text color="gray.500" fontSize="sm" mt={1}>ตรวจเรื่องใหม่ ผลงานแปล และคำขอลบจาก Creator Studio</Text></Box><CreatorModerationPanel /></Box>
}
