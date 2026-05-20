import { Suspense } from 'react'
import { Box, Heading } from '@chakra-ui/react'
import { PunishmentPanel } from '@/components/punishment/PunishmentPanel'

export default function PunishmentPage() {
  return (
    <Box p={6}>
      <Heading size="lg" mb={6}>บทระดับลงโทษ</Heading>
      <Suspense>
        <PunishmentPanel />
      </Suspense>
    </Box>
  )
}
