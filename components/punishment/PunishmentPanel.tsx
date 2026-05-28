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
  NumberInput,
  Table,
  Text,
} from '@chakra-ui/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { PunishmentLevel } from '@/lib/mock-data/punishment'

interface PunishmentForm {
  level: number
  name: string
  threshold: number
  duration: number
}

const emptyForm: PunishmentForm = { level: 1, name: '', threshold: 1, duration: 0 }

function durationLabel(days: number) {
  return days === 0 ? 'ถาวร' : `${days} วัน`
}

function levelColor(level: number) {
  if (level === 1) return 'yellow'
  if (level === 2) return 'orange'
  if (level === 3) return 'red'
  if (level >= 4) return 'red'
  return 'gray'
}

export function PunishmentPanel() {
  const [data, setData] = useState<PunishmentLevel[]>([])

  useEffect(() => {
    fetch('/api/punishment/levels').then(r => r.json()).then(setData)
  }, [])
  const [editItem, setEditItem] = useState<PunishmentLevel | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PunishmentLevel | null>(null)
  const [form, setForm] = useState<PunishmentForm>(emptyForm)

  function openAdd() { setForm(emptyForm); setIsAdding(true) }

  function openEdit(item: PunishmentLevel) {
    setForm({ level: item.level, name: item.name, threshold: item.threshold, duration: item.duration })
    setEditItem(item)
  }

  async function handleSave() {
    if (isAdding) {
      const res = await fetch('/api/punishment/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const newLevel = await res.json() as PunishmentLevel
      setData([...data, newLevel])
      toaster.success({ title: 'เพิ่มระดับลงโทษแล้ว', description: `"${form.name}" ถูกเพิ่มเรียบร้อย` })
      setIsAdding(false)
    } else if (editItem) {
      await fetch('/api/punishment/levels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, ...form }),
      })
      setData(data.map(d => d.id === editItem.id ? { ...d, ...form } : d))
      toaster.success({ title: 'บันทึกสำเร็จ', description: `อัพเดทระดับ "${form.name}" แล้ว` })
      setEditItem(null)
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    setData(data.filter(d => d.id !== deleteTarget.id))
    toaster.error({ title: 'ลบแล้ว', description: `ลบระดับ "${deleteTarget.name}" แล้ว` })
    setDeleteTarget(null)
  }

  const isOpen = isAdding || !!editItem

  return (
    <>
      <Card.Root bg="white" shadow="sm">
        <Card.Body p={4}>
          <Flex justify="flex-end" mb={4}>
            <Button colorPalette="teal" size="sm" onClick={openAdd}>
              <Plus size={16} />เพิ่มระดับลงโทษ
            </Button>
          </Flex>
          <Box overflowX="auto">
            <Table.Root>
              <Table.Header>
                <Table.Row bg="gray.50">
                  <Table.ColumnHeader>ระดับ</Table.ColumnHeader>
                  <Table.ColumnHeader>ชื่อระดับ</Table.ColumnHeader>
                  <Table.ColumnHeader>จำนวนครั้งขั้นต่ำ</Table.ColumnHeader>
                  <Table.ColumnHeader>ระยะเวลาลงโทษ</Table.ColumnHeader>
                  <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <Badge colorPalette={levelColor(item.level)} variant="subtle">
                        ระดับ {item.level}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell fontWeight="medium">{item.name}</Table.Cell>
                    <Table.Cell color="gray.700">{item.threshold} ครั้ง</Table.Cell>
                    <Table.Cell>
                      <Badge
                        colorPalette={item.duration === 0 ? 'red' : 'orange'}
                        variant="subtle"
                      >
                        {durationLabel(item.duration)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Box display="flex" gap={1}>
                        <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton aria-label="ลบ" variant="ghost" size="sm" colorPalette="red" onClick={() => setDeleteTarget(item)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card.Body>
      </Card.Root>

      {/* Add / Edit Dialog */}
      <Dialog.Root open={isOpen} onOpenChange={(e) => { if (!e.open) { setIsAdding(false); setEditItem(null) } }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{isAdding ? 'เพิ่มระดับลงโทษ' : 'แก้ไขระดับลงโทษ'}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>ระดับ</Field.Label>
                  <NumberInput.Root min={1} value={String(form.level)} onValueChange={(e) => setForm({ ...form, level: Number(e.value) })}>
                    <NumberInput.Input />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>ชื่อระดับ</Field.Label>
                  <Input
                    placeholder="เช่น คำเตือน, ระงับชั่วคราว"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>จำนวนครั้งที่ผิดขั้นต่ำ</Field.Label>
                  <NumberInput.Root min={1} value={String(form.threshold)} onValueChange={(e) => setForm({ ...form, threshold: Number(e.value) })}>
                    <NumberInput.Input />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>ระยะเวลาลงโทษ (วัน)</Field.Label>
                  <NumberInput.Root min={0} value={String(form.duration)} onValueChange={(e) => setForm({ ...form, duration: Number(e.value) })}>
                    <NumberInput.Input />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                  <Text fontSize="xs" color="gray.400" mt={1}>0 = ถาวร</Text>
                </Field.Root>
              </Flex>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={() => { setIsAdding(false); setEditItem(null) }}>ยกเลิก</Button>
              <Button colorPalette="teal" onClick={handleSave} disabled={!form.name.trim()}>บันทึก</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Delete Confirm Dialog */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(e) => { if (!e.open) setDeleteTarget(null) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>ยืนยันการลบ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
            <Dialog.Body>
              <Text>ต้องการลบระดับ <strong>&quot;{deleteTarget?.name}&quot;</strong> ใช่หรือไม่?</Text>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
              <Button colorPalette="red" onClick={handleDelete}>ลบ</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
