import { Box, Heading, Text } from '@chakra-ui/react'
import { Suspense } from 'react'
import { UsersPanel } from '@/components/users/UsersPanel'

export default function UsersPage() {
  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" color="gray.800">User</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>จัดการผู้ใช้ นักเขียน และผู้ดูแลระบบ</Text>
      </Box>
      <Suspense>
        <UsersPanel />
      </Suspense>
    </Box>
  )
}
