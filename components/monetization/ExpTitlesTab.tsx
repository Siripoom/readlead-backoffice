'use client'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  IconButton,
  Input,
  NativeSelect,
  NumberInput,
  Table,
  Text,
} from '@chakra-ui/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { ExpTitle } from '@/lib/mock-data/monetization'

interface ExpForm { minExp: number; title: string; badge: string; color: string }
const emptyForm: ExpForm = { minExp: 0, title: '', badge: '', color: 'gray' }
const colors = ['gray', 'green', 'blue', 'purple', 'orange', 'yellow', 'teal', 'red']

export function ExpTitlesTab() {
  const [data, setData] = useState<ExpTitle[]>([])

  useEffect(() => {
    fetch('/api/monetization').then(r => r.json()).then(d => setData(d.expTitles))
  }, [])
  const [editItem, setEditItem] = useState<ExpTitle | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExpTitle | null>(null)
  const [form, setForm] = useState<ExpForm>(emptyForm)

  function openAdd() { setForm(emptyForm); setIsAdding(true) }
  function openEdit(item: ExpTitle) {
    setForm({ minExp: item.minExp, title: item.title, badge: item.badge, color: item.color })
    setEditItem(item)
  }

  function handleSave() {
    if (isAdding) {
      setData([...data, { id: `e${Date.now()}`, ...form }])
      toaster.success({ title: 'เพิ่มฉายาแล้ว', description: `"${form.title}" ถูกเพิ่มเรียบร้อย` })
      setIsAdding(false)
    } else if (editItem) {
      setData(data.map(d => d.id === editItem.id ? { ...d, ...form } : d))
      toaster.success({ title: 'บันทึกสำเร็จ', description: `อัพเดทฉายา "${form.title}" แล้ว` })
      setEditItem(null)
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    setData(data.filter(d => d.id !== deleteTarget.id))
    toaster.error({ title: 'ลบแล้ว', description: `ลบฉายา "${deleteTarget.title}" แล้ว` })
    setDeleteTarget(null)
  }

  const isOpen = isAdding || !!editItem

  return (
    <>
      <Box display="flex" justifyContent="flex-end" mb={4}>
        <Button colorPalette="teal" size="sm" onClick={openAdd}><Plus size={16} />เพิ่มฉายา</Button>
      </Box>
      <Box overflowX="auto">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>EXP ขั้นต่ำ</Table.ColumnHeader>
              <Table.ColumnHeader>ฉายา / ตำแหน่ง</Table.ColumnHeader>
              <Table.ColumnHeader>ป้ายสถานะ</Table.ColumnHeader>
              <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.map((e) => (
              <Table.Row key={e.id}>
                <Table.Cell fontWeight="medium" color="purple.600">{e.minExp.toLocaleString()} EXP</Table.Cell>
                <Table.Cell fontWeight="medium">{e.title}</Table.Cell>
                <Table.Cell><Badge colorPalette={e.color} variant="subtle">{e.badge}</Badge></Table.Cell>
                <Table.Cell>
                  <Box display="flex" gap={1}>
                    <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={() => openEdit(e)}><Pencil size={16} /></IconButton>
                    <IconButton aria-label="ลบ" variant="ghost" size="sm" colorPalette="red" onClick={() => setDeleteTarget(e)}><Trash2 size={16} /></IconButton>
                  </Box>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      <Dialog.Root open={isOpen} onOpenChange={(e) => { if (!e.open) { setIsAdding(false); setEditItem(null) } }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{isAdding ? 'เพิ่มฉายา' : 'แก้ไขฉายา'}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>EXP ขั้นต่ำ</Field.Label>
                  <NumberInput.Root min={0} value={String(form.minExp)} onValueChange={(e) => setForm({ ...form, minExp: Number(e.value) })}>
                    <NumberInput.Input />
                    <NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control>
                  </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>ฉายา / ตำแหน่ง</Field.Label>
                  <Input placeholder="เช่น นักอ่านผู้ยิ่งใหญ่" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>ป้ายสถานะ</Field.Label>
                  <Input placeholder="เช่น Master" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>สี</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
                      {colors.map(c => <option key={c} value={c}>{c}</option>)}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
              </Flex>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={() => { setIsAdding(false); setEditItem(null) }}>ยกเลิก</Button>
              <Button colorPalette="teal" onClick={handleSave} disabled={!form.title.trim()}>บันทึก</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={!!deleteTarget} onOpenChange={(e) => { if (!e.open) setDeleteTarget(null) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>ยืนยันการลบ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
            <Dialog.Body><Text>ต้องการลบฉายา <strong>&quot;{deleteTarget?.title}&quot;</strong> ใช่หรือไม่?</Text></Dialog.Body>
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
