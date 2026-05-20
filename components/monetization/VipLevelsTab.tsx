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
import type { VipLevel } from '@/lib/mock-data/monetization'

interface VipForm { level: number; name: string; minSpend: number; badge: string; color: string }
const emptyForm: VipForm = { level: 1, name: '', minSpend: 0, badge: '', color: 'gray' }
const colors = ['gray', 'yellow', 'cyan', 'blue', 'purple', 'green', 'orange', 'teal']

export function VipLevelsTab() {
  const [data, setData] = useState<VipLevel[]>([])

  useEffect(() => {
    fetch('/api/monetization').then(r => r.json()).then(d => setData(d.vipLevels))
  }, [])
  const [editItem, setEditItem] = useState<VipLevel | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VipLevel | null>(null)
  const [form, setForm] = useState<VipForm>(emptyForm)

  function openAdd() { setForm(emptyForm); setIsAdding(true) }
  function openEdit(item: VipLevel) {
    setForm({ level: item.level, name: item.name, minSpend: item.minSpend, badge: item.badge, color: item.color })
    setEditItem(item)
  }

  function handleSave() {
    if (isAdding) {
      setData([...data, { id: `v${Date.now()}`, ...form }])
      toaster.success({ title: 'เพิ่มระดับ VIP แล้ว', description: `"${form.name}" ถูกเพิ่มเรียบร้อย` })
      setIsAdding(false)
    } else if (editItem) {
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
      <Box display="flex" justifyContent="flex-end" mb={4}>
        <Button colorPalette="teal" size="sm" onClick={openAdd}><Plus size={16} />เพิ่มระดับ VIP</Button>
      </Box>
      <Box overflowX="auto">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>ระดับ</Table.ColumnHeader>
              <Table.ColumnHeader>ชื่อระดับ</Table.ColumnHeader>
              <Table.ColumnHeader>ยอดซื้อขั้นต่ำ (บาท)</Table.ColumnHeader>
              <Table.ColumnHeader>ป้ายสถานะ</Table.ColumnHeader>
              <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.map((v) => (
              <Table.Row key={v.id}>
                <Table.Cell fontWeight="bold" color="teal.600">VIP {v.level}</Table.Cell>
                <Table.Cell fontWeight="medium">{v.name}</Table.Cell>
                <Table.Cell color="gray.700">฿{v.minSpend.toLocaleString()}</Table.Cell>
                <Table.Cell><Badge colorPalette={v.color} variant="subtle">{v.badge}</Badge></Table.Cell>
                <Table.Cell>
                  <Box display="flex" gap={1}>
                    <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={() => openEdit(v)}><Pencil size={16} /></IconButton>
                    <IconButton aria-label="ลบ" variant="ghost" size="sm" colorPalette="red" onClick={() => setDeleteTarget(v)}><Trash2 size={16} /></IconButton>
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
              <Dialog.Title>{isAdding ? 'เพิ่มระดับ VIP' : 'แก้ไขระดับ VIP'}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>ระดับ</Field.Label>
                  <NumberInput.Root min={1} value={String(form.level)} onValueChange={(e) => setForm({ ...form, level: Number(e.value) })}>
                    <NumberInput.Input /><NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control>
                  </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>ชื่อระดับ</Field.Label>
                  <Input placeholder="เช่น Gold" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>ยอดซื้อขั้นต่ำ (บาท)</Field.Label>
                  <NumberInput.Root min={0} value={String(form.minSpend)} onValueChange={(e) => setForm({ ...form, minSpend: Number(e.value) })}>
                    <NumberInput.Input /><NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control>
                  </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>ป้ายสถานะ</Field.Label>
                  <Input placeholder="เช่น ทอง" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
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
              <Button colorPalette="teal" onClick={handleSave} disabled={!form.name.trim()}>บันทึก</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={!!deleteTarget} onOpenChange={(e) => { if (!e.open) setDeleteTarget(null) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>ยืนยันการลบ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
            <Dialog.Body><Text>ต้องการลบระดับ <strong>&quot;{deleteTarget?.name}&quot;</strong> ใช่หรือไม่?</Text></Dialog.Body>
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
