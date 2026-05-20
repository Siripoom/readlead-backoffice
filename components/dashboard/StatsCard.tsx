import { Badge, Box, Card, Flex, Text } from '@chakra-ui/react'
import type { StatItem } from '@/lib/mock-data/dashboard'

export function StatsCard({ stat }: { stat: StatItem }) {
  return (
    <Card.Root bg="white" shadow="sm">
      <Card.Body>
        <Flex justify="space-between" align="flex-start">
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1}>{stat.label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">{stat.value}</Text>
          </Box>
          <Badge
            colorPalette={stat.positive ? 'green' : 'red'}
            variant="subtle"
            borderRadius="full"
            px={2}
            py={0.5}
          >
            {stat.change}
          </Badge>
        </Flex>
        <Text fontSize="xs" color="gray.400" mt={2}>{stat.description}</Text>
      </Card.Body>
    </Card.Root>
  )
}
