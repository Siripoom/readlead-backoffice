import { Card, Flex, Text } from '@chakra-ui/react'
import { BarChart2 } from 'lucide-react'

export function ChartPlaceholder() {
  return (
    <Card.Root bg="white" shadow="sm">
      <Card.Header>
        <Text fontWeight="semibold" color="gray.700">รายได้ตามช่วงเวลา</Text>
      </Card.Header>
      <Card.Body>
        <Flex
          h="280px"
          border="2px dashed"
          borderColor="gray.200"
          borderRadius="md"
          align="center"
          justify="center"
          direction="column"
          gap={2}
          color="gray.400"
        >
          <BarChart2 size={40} />
          <Text fontSize="sm">Chart Placeholder — Revenue over time</Text>
          <Text fontSize="xs">เชื่อมต่อ chart library เพื่อแสดงข้อมูลจริง</Text>
        </Flex>
      </Card.Body>
    </Card.Root>
  )
}
