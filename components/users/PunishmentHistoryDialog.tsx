'use client'
import { Badge, Box, Button, Dialog, Flex, Table, Text } from '@chakra-ui/react'
import type { PunishmentRecord } from '@/lib/mock-data/punishment'

interface Props {
  open: boolean
  userName: string
  records: PunishmentRecord[]
  onClose: () => void
}

export function PunishmentHistoryDialog({ open, userName, records, onClose }: Props) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose() }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="560px">
          <Dialog.Header>
            <Dialog.Title>ประวัติการลงโทษ — {userName}</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>
          <Dialog.Body>
            <Flex align="center" gap={2} mb={4}>
              <Text fontSize="sm" color="gray.600">ถูกลงโทษทั้งหมด</Text>
              <Badge colorPalette={records.length > 0 ? 'orange' : 'gray'} variant="subtle" fontSize="sm" px={2}>
                {records.length} ครั้ง
              </Badge>
            </Flex>

            {sorted.length === 0 ? (
              <Box py={8} textAlign="center">
                <Text color="gray.400" fontSize="sm">ไม่มีประวัติการลงโทษ</Text>
              </Box>
            ) : (
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" overflow="hidden">
                <Table.Root>
                  <Table.Header>
                    <Table.Row bg="gray.50">
                      <Table.ColumnHeader>วันที่</Table.ColumnHeader>
                      <Table.ColumnHeader>ระดับโทษ</Table.ColumnHeader>
                      <Table.ColumnHeader>หมายเหตุ</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {sorted.map((r) => (
                      <Table.Row key={r.id}>
                        <Table.Cell color="gray.600" whiteSpace="nowrap">{r.date}</Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette="orange" variant="subtle">{r.levelName}</Badge>
                        </Table.Cell>
                        <Table.Cell color="gray.500" fontSize="sm">{r.note ?? '—'}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={onClose}>ปิด</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
