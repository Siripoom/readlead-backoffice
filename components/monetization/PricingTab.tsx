'use client'
import { Box, Button, Flex, NumberInput, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { PricingItem } from '@/lib/mock-data/monetization'

export function PricingTab() {
  const [items, setItems] = useState<PricingItem[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/monetization').then(r => r.json()).then(d => {
      setItems(d.pricing)
      setPrices(Object.fromEntries(d.pricing.map((p: PricingItem) => [p.id, p.pricePerEpisode])))
    })
  }, [])

  function handleSave() {
    toaster.success({ title: 'บันทึกการตั้งค่าราคาแล้ว', description: 'ราคาต่อตอนถูกอัพเดทเรียบร้อย' })
  }

  return (
    <Box>
      <Box mb={5}>
        <Text fontWeight="semibold" color="gray.700" fontSize="md">ตั้งค่าราคาต่อตอน</Text>
        <Text color="gray.500" fontSize="sm" mt={0.5}>กำหนดราคาสำหรับแต่ละหมวดหมู่เนื้อหา</Text>
      </Box>

      <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" mb={5} overflow="hidden">
        {items.map((item, index) => (
          <Flex
            key={item.id}
            align="center"
            justify="space-between"
            px={4}
            py={4}
            bg="white"
            borderBottomWidth={index < items.length - 1 ? '1px' : '0'}
            borderColor="gray.100"
          >
            <Box>
              <Text fontWeight="medium" color="gray.800">{item.category}</Text>
              <Text fontSize="xs" color="gray.400" mt={0.5}>ราคาต่อตอน</Text>
            </Box>
            <Flex align="center" gap={2}>
              <NumberInput.Root
                min={1}
                max={999}
                value={String(prices[item.id])}
                onValueChange={(e) => setPrices({ ...prices, [item.id]: Number(e.value) })}
                width="110px"
              >
                <NumberInput.Input textAlign="center" />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>
              <Text fontSize="sm" color="gray.500" whiteSpace="nowrap">{item.currency} / ตอน</Text>
            </Flex>
          </Flex>
        ))}
      </Box>

      <Flex justify="flex-end">
        <Button colorPalette="teal" onClick={handleSave}>บันทึกการตั้งค่า</Button>
      </Flex>
    </Box>
  )
}
