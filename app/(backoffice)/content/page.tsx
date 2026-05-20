import { Box, Heading, Text } from '@chakra-ui/react'
import { ContentTable } from '@/components/content/ContentTable'
import { getContent } from '@/lib/db/content'

export default async function ContentPage() {
  const raw = await getContent()
  const content = raw.map(c => ({
    ...c,
    submittedAt: c.submittedAt.toISOString().split('T')[0],
  }))

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" color="gray.800">Content</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>จัดการเนื้อหาที่นักเขียนส่งเข้ามา</Text>
      </Box>
      <ContentTable data={content} />
    </Box>
  )
}
