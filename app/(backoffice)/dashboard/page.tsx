import { Box, Heading, SimpleGrid, Text } from '@chakra-ui/react'
import { ChartPlaceholder } from '@/components/dashboard/ChartPlaceholder'
import { StatsCard } from '@/components/dashboard/StatsCard'
import type { StatItem } from '@/lib/mock-data/dashboard'

const stats: StatItem[] = [
  { label: 'ผู้ใช้ทั้งหมด', value: '12,480', change: '+8.2%', positive: true, description: 'เทียบกับเดือนที่แล้ว' },
  { label: 'เนื้อหาทั้งหมด', value: '3,241', change: '+12.4%', positive: true, description: 'เทียบกับเดือนที่แล้ว' },
  { label: 'รายได้ (บาท)', value: '฿842,000', change: '-2.1%', positive: false, description: 'เทียบกับเดือนที่แล้ว' },
  { label: 'นักเขียนที่ใช้งาน', value: '618', change: '+5.0%', positive: true, description: 'เทียบกับเดือนที่แล้ว' },
]

export default function DashboardPage() {
  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" color="gray.800">Dashboard</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>ภาพรวมระบบ ReadLead</Text>
      </Box>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4} mb={6}>
        {stats.map((stat) => (
          <StatsCard key={stat.label} stat={stat} />
        ))}
      </SimpleGrid>

      <ChartPlaceholder />
    </Box>
  )
}
