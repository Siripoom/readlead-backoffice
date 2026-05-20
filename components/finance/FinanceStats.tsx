import { Card, SimpleGrid, Text } from '@chakra-ui/react'
import type { FinanceStat } from '@/lib/mock-data/finance'

export function FinanceStats({ stats }: { stats: FinanceStat[] }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 3 }} gap={4}>
      {stats.map((stat) => (
        <Card.Root
          key={stat.label}
          bg="white"
          shadow="sm"
          borderLeftWidth="4px"
          borderLeftColor={`${stat.colorPalette}.400`}
        >
          <Card.Body>
            <Text fontSize="sm" color="gray.500" mb={1}>{stat.label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">{stat.value}</Text>
            <Text fontSize="xs" color="gray.400" mt={1}>{stat.sublabel}</Text>
          </Card.Body>
        </Card.Root>
      ))}
    </SimpleGrid>
  )
}
