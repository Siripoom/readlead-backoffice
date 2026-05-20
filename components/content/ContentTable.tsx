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
  Input,
  NativeSelect,
  Table,
  Text,
} from '@chakra-ui/react'
import { Eye, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { ContentItem, ContentStatus } from '@/lib/mock-data/content'

const statusMap: Record<ContentStatus, { label: string; color: string }> = {
  pending: { label: 'รอตรวจสอบ', color: 'yellow' },
  approved: { label: 'อนุมัติ', color: 'green' },
  rejected: { label: 'ปฏิเสธ', color: 'red' },
}

interface EditForm {
  category: string
  status: ContentStatus
}

export function ContentTable({ data: initialData }: { data: ContentItem[] }) {
  const [data, setData] = useState(initialData)
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | null>(null)
  const [form, setForm] = useState<EditForm>({ category: '', status: 'pending' })

  function handleView(item: ContentItem) {
    setSelectedItem(item)
    setMode('view')
  }

  function handleEdit(item: ContentItem) {
    setSelectedItem(item)
    setForm({ category: item.category, status: item.status })
    setMode('edit')
  }

  function handleClose() {
    setMode(null)
    setSelectedItem(null)
  }

  function handleSave() {
    if (!selectedItem) return
    setData(data.map(d => d.id === selectedItem.id ? { ...d, ...form } : d))
    toaster.success({ title: 'บันทึกสำเร็จ', description: `อัพเดทข้อมูล "${selectedItem.title}" แล้ว` })
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
                  <Table.ColumnHeader>ชื่อเรื่อง</Table.ColumnHeader>
                  <Table.ColumnHeader>นักเขียน</Table.ColumnHeader>
                  <Table.ColumnHeader>หมวดหมู่</Table.ColumnHeader>
                  <Table.ColumnHeader>ตอน</Table.ColumnHeader>
                  <Table.ColumnHeader>สถานะ</Table.ColumnHeader>
                  <Table.ColumnHeader>วันที่ส่ง</Table.ColumnHeader>
                  <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.map((item) => {
                  const s = statusMap[item.status]
                  return (
                    <Table.Row key={item.id}>
                      <Table.Cell fontWeight="medium">{item.title}</Table.Cell>
                      <Table.Cell color="gray.600">{item.author}</Table.Cell>
                      <Table.Cell color="gray.600">{item.category}</Table.Cell>
                      <Table.Cell color="gray.600">{item.chapters}</Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={s.color} variant="subtle">{s.label}</Badge>
                      </Table.Cell>
                      <Table.Cell color="gray.600">{item.submittedAt}</Table.Cell>
                      <Table.Cell>
                        <Box display="flex" gap={1}>
                          <IconButton aria-label="ดู" variant="ghost" size="sm" onClick={() => handleView(item)}>
                            <Eye size={16} />
                          </IconButton>
                          <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Pencil size={16} />
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
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>รายละเอียดเนื้อหา</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {selectedItem && (
                <Flex direction="column" gap={3}>
                  <Box><Text fontSize="xs" color="gray.500">ชื่อเรื่อง</Text><Text fontWeight="medium">{selectedItem.title}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">นักเขียน</Text><Text>{selectedItem.author}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">หมวดหมู่</Text><Text>{selectedItem.category}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">จำนวนตอน</Text><Text>{selectedItem.chapters} ตอน</Text></Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">สถานะ</Text>
                    <Badge colorPalette={statusMap[selectedItem.status].color} variant="subtle" mt={1}>
                      {statusMap[selectedItem.status].label}
                    </Badge>
                  </Box>
                  <Box><Text fontSize="xs" color="gray.500">วันที่ส่ง</Text><Text>{selectedItem.submittedAt}</Text></Box>
                </Flex>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={handleClose}>ปิด</Button>
              {selectedItem && (
                <Button colorPalette="teal" onClick={() => handleEdit(selectedItem)}>แก้ไข</Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Edit Dialog */}
      <Dialog.Root open={mode === 'edit'} onOpenChange={(e) => { if (!e.open) handleClose() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>แก้ไขเนื้อหา</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>หมวดหมู่</Field.Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>สถานะ</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })}
                    >
                      <option value="pending">รอตรวจสอบ</option>
                      <option value="approved">อนุมัติ</option>
                      <option value="rejected">ปฏิเสธ</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
              </Flex>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={handleClose}>ยกเลิก</Button>
              <Button colorPalette="teal" onClick={handleSave}>บันทึก</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
