'use client'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  IconButton,
  Table,
  Text,
} from '@chakra-ui/react'
import { Check, Eye, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { WithdrawalRequest, WithdrawalStatus } from '@/lib/mock-data/finance'

const statusMap: Record<WithdrawalStatus, { label: string; color: string }> = {
  pending: { label: 'รอดำเนินการ', color: 'orange' },
  approved: { label: 'อนุมัติแล้ว', color: 'green' },
  rejected: { label: 'ปฏิเสธ', color: 'red' },
}

export function WithdrawalRequestsTab() {
  const [data, setData] = useState<WithdrawalRequest[]>([])

  useEffect(() => {
    fetch('/api/finance/withdrawals')
      .then(r => r.json())
      .then(rows => setData(rows.map((r: WithdrawalRequest & { amount: string; requestedAt: string }) => ({
        ...r,
        amount: Number(r.amount),
        requestedAt: r.requestedAt.split('T')[0],
      }))))
  }, [])
  const [viewItem, setViewItem] = useState<WithdrawalRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<WithdrawalRequest | null>(null)

  function handleApprove(item: WithdrawalRequest) {
    setData(data.map(d => d.id === item.id ? { ...d, status: 'approved' as const } : d))
    toaster.success({ title: 'อนุมัติแล้ว', description: `อนุมัติการถอนเงินของ ${item.creator} ฿${item.amount.toLocaleString()}` })
  }

  function handleRejectConfirm() {
    if (!rejectTarget) return
    setData(data.map(d => d.id === rejectTarget.id ? { ...d, status: 'rejected' as const } : d))
    toaster.error({ title: 'ปฏิเสธแล้ว', description: `ปฏิเสธคำขอถอนเงินของ ${rejectTarget.creator}` })
    setRejectTarget(null)
  }

  return (
    <>
      <Box overflowX="auto">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>นักเขียน</Table.ColumnHeader>
              <Table.ColumnHeader>ธนาคาร</Table.ColumnHeader>
              <Table.ColumnHeader>เลขบัญชี</Table.ColumnHeader>
              <Table.ColumnHeader>จำนวนเงิน</Table.ColumnHeader>
              <Table.ColumnHeader>วันที่ขอ</Table.ColumnHeader>
              <Table.ColumnHeader>สถานะ</Table.ColumnHeader>
              <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.map((item) => {
              const s = statusMap[item.status]
              return (
                <Table.Row key={item.id}>
                  <Table.Cell fontWeight="medium">{item.creator}</Table.Cell>
                  <Table.Cell color="gray.600">{item.bank}</Table.Cell>
                  <Table.Cell color="gray.500" fontSize="sm">{item.bankAccount}</Table.Cell>
                  <Table.Cell fontWeight="semibold" color="gray.800">
                    ฿{item.amount.toLocaleString()}
                  </Table.Cell>
                  <Table.Cell color="gray.600">{item.requestedAt}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={s.color} variant="subtle">{s.label}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {item.status === 'pending' ? (
                      <Box display="flex" gap={2}>
                        <Button colorPalette="green" size="xs" variant="subtle" onClick={() => handleApprove(item)}>
                          <Check size={13} />
                          อนุมัติ
                        </Button>
                        <Button colorPalette="red" size="xs" variant="subtle" onClick={() => setRejectTarget(item)}>
                          <X size={13} />
                          ปฏิเสธ
                        </Button>
                      </Box>
                    ) : (
                      <IconButton aria-label="ดู" variant="ghost" size="sm" onClick={() => setViewItem(item)}>
                        <Eye size={16} />
                      </IconButton>
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* View Dialog */}
      <Dialog.Root open={!!viewItem} onOpenChange={(e) => { if (!e.open) setViewItem(null) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>รายละเอียดคำขอถอนเงิน</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {viewItem && (
                <Flex direction="column" gap={3}>
                  <Box><Text fontSize="xs" color="gray.500">นักเขียน</Text><Text fontWeight="medium">{viewItem.creator}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">ธนาคาร</Text><Text>{viewItem.bank}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">เลขบัญชี</Text><Text fontFamily="mono">{viewItem.bankAccount}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">จำนวนเงิน</Text><Text fontWeight="bold" fontSize="lg">฿{viewItem.amount.toLocaleString()}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">วันที่ขอ</Text><Text>{viewItem.requestedAt}</Text></Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">สถานะ</Text>
                    <Badge colorPalette={statusMap[viewItem.status].color} variant="subtle" mt={1}>
                      {statusMap[viewItem.status].label}
                    </Badge>
                  </Box>
                </Flex>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setViewItem(null)}>ปิด</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Reject Confirm Dialog */}
      <Dialog.Root open={!!rejectTarget} onOpenChange={(e) => { if (!e.open) setRejectTarget(null) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>ยืนยันการปฏิเสธ</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {rejectTarget && (
                <Text>
                  ต้องการปฏิเสธคำขอถอนเงินของ <strong>{rejectTarget.creator}</strong> จำนวน{' '}
                  <strong>฿{rejectTarget.amount.toLocaleString()}</strong> ใช่หรือไม่?
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={() => setRejectTarget(null)}>ยกเลิก</Button>
              <Button colorPalette="red" onClick={handleRejectConfirm}>ยืนยันการปฏิเสธ</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
