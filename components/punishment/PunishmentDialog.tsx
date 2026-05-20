'use client'
import { Box, Button, Dialog, Flex, NativeSelect, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import type { PunishmentLevel } from '@/lib/mock-data/punishment'

interface Props {
  open: boolean
  targetName: string
  onClose: () => void
  onConfirm: (level: PunishmentLevel) => void
}

function durationLabel(days: number) {
  return days === 0 ? 'ถาวร' : `${days} วัน`
}

export function PunishmentDialog({ open, targetName, onClose, onConfirm }: Props) {
  const [levels, setLevels] = useState<PunishmentLevel[]>([])
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    fetch('/api/punishment/levels')
      .then(r => r.json())
      .then((data: PunishmentLevel[]) => {
        setLevels(data)
        setSelectedId(data[0]?.id ?? '')
      })
  }, [])

  const selectedLevel = levels.find(p => p.id === selectedId) ?? levels[0]

  function handleConfirm() {
    if (!selectedLevel) return
    onConfirm(selectedLevel)
    setSelectedId(levels[0]?.id ?? '')
  }

  function handleClose() {
    setSelectedId(levels[0]?.id ?? '')
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) handleClose() }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>ลงโทษผู้ใช้</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" gap={4}>
              <Box bg="orange.50" p={3} borderRadius="md" borderWidth="1px" borderColor="orange.200">
                <Text fontSize="sm" color="orange.700">
                  เป้าหมาย: <strong>{targetName}</strong>
                </Text>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={2}>เลือกระดับลงโทษ</Text>
                <NativeSelect.Root>
                  <NativeSelect.Field value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    {levels.map(p => (
                      <option key={p.id} value={p.id}>
                        ระดับ {p.level} — {p.name} ({durationLabel(p.duration)})
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>
              <Box bg="gray.50" p={3} borderRadius="md" fontSize="sm" color="gray.600">
                <Text>ระยะเวลา: <strong>{durationLabel(selectedLevel.duration)}</strong></Text>
                <Text mt={1}>เงื่อนไข: ผิดกฎครั้งที่ {selectedLevel.threshold} ขึ้นไป</Text>
              </Box>
            </Flex>
          </Dialog.Body>
          <Dialog.Footer gap={2}>
            <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
            <Button colorPalette="red" onClick={handleConfirm}>ยืนยันการลงโทษ</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
