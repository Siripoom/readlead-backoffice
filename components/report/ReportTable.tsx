'use client'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Field,
  Flex,
  IconButton,
  Table,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { Eye, Gavel, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { ReportItem, ReportStatus } from '@/lib/mock-data/report'
import { PunishmentDialog } from '@/components/punishment/PunishmentDialog'
import type { PunishmentLevel } from '@/lib/mock-data/punishment'

const statusMap: Record<ReportStatus, { label: string; color: string }> = {
  open: { label: 'เปิด', color: 'orange' },
  'in-progress': { label: 'กำลังดำเนินการ', color: 'blue' },
  resolved: { label: 'แก้ไขแล้ว', color: 'green' },
}

export function ReportTable({ data: initialData }: { data: ReportItem[] }) {
  const [data, setData] = useState(initialData)
  const [selectedItem, setSelectedItem] = useState<ReportItem | null>(null)
  const [mode, setMode] = useState<'view' | 'reply' | null>(null)
  const [replyText, setReplyText] = useState('')
  const [punishTarget, setPunishTarget] = useState<ReportItem | null>(null)

  function handleConfirmPunish(level: PunishmentLevel) {
    if (!punishTarget) return
    setData(data.map(d => d.id === punishTarget.id ? { ...d, status: 'resolved' } : d))
    toaster.error({ title: 'ลงโทษแล้ว', description: `"${punishTarget.sender}" ถูกลงโทษ: ${level.name}` })
    setPunishTarget(null)
  }

  function handleClose() {
    setMode(null)
    setSelectedItem(null)
    setReplyText('')
  }

  function handleSendReply() {
    if (!selectedItem || !replyText.trim()) return
    const nextStatus: ReportStatus = selectedItem.status === 'open' ? 'in-progress' : 'resolved'
    setData(data.map(d => d.id === selectedItem.id ? { ...d, status: nextStatus } : d))
    toaster.success({ title: 'ส่งคำตอบสำเร็จ', description: `อัพเดทสถานะเป็น "${statusMap[nextStatus].label}"` })
    handleClose()
  }

  return (
    <>
      <Card.Root bg="white" shadow="sm">
        <Card.Body p={0}>
          <Box overflowX="auto">
            <Table.Root>
              <Table.Header>
                <Table.Row bg="gray.50">
                  <Table.ColumnHeader>ผู้ส่ง</Table.ColumnHeader>
                  <Table.ColumnHeader>หัวเรื่อง</Table.ColumnHeader>
                  <Table.ColumnHeader>ประเภท</Table.ColumnHeader>
                  <Table.ColumnHeader>วันที่</Table.ColumnHeader>
                  <Table.ColumnHeader>สถานะ</Table.ColumnHeader>
                  <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.map((item) => {
                  const s = statusMap[item.status]
                  return (
                    <Table.Row key={item.id}>
                      <Table.Cell fontWeight="medium">{item.sender}</Table.Cell>
                      <Table.Cell color="gray.700">{item.subject}</Table.Cell>
                      <Table.Cell>
                        <Badge variant="outline" colorPalette="gray">{item.type}</Badge>
                      </Table.Cell>
                      <Table.Cell color="gray.600">{item.date}</Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={s.color} variant="subtle">{s.label}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Box display="flex" gap={1}>
                          <IconButton aria-label="ดู" variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setMode('view') }}>
                            <Eye size={16} />
                          </IconButton>
                          <IconButton aria-label="ตอบกลับ" variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setMode('reply') }}>
                            <MessageSquare size={16} />
                          </IconButton>
                          <IconButton aria-label="ลงโทษ" variant="ghost" size="sm" colorPalette="red" onClick={() => setPunishTarget(item)}>
                            <Gavel size={16} />
                          </IconButton>
                        </Box>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card.Body>
      </Card.Root>

      {/* View Dialog */}
      <Dialog.Root open={mode === 'view'} onOpenChange={(e) => { if (!e.open) handleClose() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="560px">
            <Dialog.Header>
              <Dialog.Title>รายละเอียด Report</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {selectedItem && (
                <Flex direction="column" gap={3}>
                  <Box><Text fontSize="xs" color="gray.500">ผู้ส่ง</Text><Text fontWeight="medium">{selectedItem.sender}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">หัวเรื่อง</Text><Text fontWeight="medium">{selectedItem.subject}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">ประเภท</Text><Badge variant="outline" colorPalette="gray" mt={1}>{selectedItem.type}</Badge></Box>
                  <Box><Text fontSize="xs" color="gray.500">วันที่</Text><Text>{selectedItem.date}</Text></Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">สถานะ</Text>
                    <Badge colorPalette={statusMap[selectedItem.status].color} variant="subtle" mt={1}>
                      {statusMap[selectedItem.status].label}
                    </Badge>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>เนื้อหา</Text>
                    <Box bg="gray.50" p={3} borderRadius="md" fontSize="sm" color="gray.700" lineHeight="1.6">
                      {selectedItem.message}
                    </Box>
                  </Box>
                </Flex>
              )}
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={handleClose}>ปิด</Button>
              {selectedItem && selectedItem.status !== 'resolved' && (
                <Button colorPalette="blue" onClick={() => setMode('reply')}>ตอบกลับ</Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <PunishmentDialog
        open={!!punishTarget}
        targetName={punishTarget?.sender ?? ''}
        onClose={() => setPunishTarget(null)}
        onConfirm={handleConfirmPunish}
      />

      {/* Reply Dialog */}
      <Dialog.Root open={mode === 'reply'} onOpenChange={(e) => { if (!e.open) handleClose() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="520px">
            <Dialog.Header>
              <Dialog.Title>ตอบกลับ Report</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {selectedItem && (
                <Flex direction="column" gap={4}>
                  <Box bg="gray.50" p={3} borderRadius="md">
                    <Text fontSize="xs" color="gray.500">หัวเรื่อง</Text>
                    <Text fontSize="sm" fontWeight="medium">{selectedItem.subject}</Text>
                  </Box>
                  <Field.Root>
                    <Field.Label>ข้อความตอบกลับ</Field.Label>
                    <Textarea
                      rows={5}
                      placeholder="พิมพ์ข้อความตอบกลับ..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                  </Field.Root>
                </Flex>
              )}
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
              <Button
                colorPalette="blue"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
              >
                ส่งคำตอบ
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
