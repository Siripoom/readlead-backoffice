import { Box, Heading, Text } from '@chakra-ui/react'
import { Suspense } from 'react'
import { MonetizationPanel } from '@/components/monetization/MonetizationPanel'

export default function MonetizationPage() {
  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" color="gray.800">Monetization</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>จัดการโปรโมชั่น ราคา ระดับ VIP และ EXP</Text>
      </Box>
      <Suspense>
        <MonetizationPanel />
      </Suspense>
    </Box>
  )
}
