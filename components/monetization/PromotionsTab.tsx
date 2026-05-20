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
  NumberInput,
  Switch,
  Table,
  Text,
} from '@chakra-ui/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { Promotion } from '@/lib/mock-data/monetization'

interface PromoForm {
  name: string
  discount: number
  validFrom: string
  validTo: string
}

const emptyForm: PromoForm = { name: '', discount: 10, validFrom: '', validTo: '' }

function formFromItem(item: Promotion): PromoForm {
  return { name: item.name, discount: item.discount, validFrom: item.validFrom, validTo: item.validTo }
}

export function PromotionsTab() {
  const [data, setData] = useState<Promotion[]>([])

  useEffect(() => {
    fetch('/api/monetization').then(r => r.json()).then(d =>
      setData(d.promotions.map((p: Promotion & { validFrom: string; validTo: string }) => ({
        ...p,
        validFrom: p.validFrom.split('T')[0],
        validTo: p.validTo.split('T')[0],
      })))
    )
  }, [])
  const [editItem, setEditItem] = useState<Promotion | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)
  const [form, setForm] = useState<PromoForm>(emptyForm)

  function openAdd() {
    setForm(emptyForm)
    setIsAdding(true)
  }

  function openEdit(item: Promotion) {
    setForm(formFromItem(item))
    setEditItem(item)
  }

  function handleSave() {
    if (isAdding) {
      const newItem: Promotion = {
        id: `p${Date.now()}`,
        ...form,
        active: true,
      }
      setData([...data, newItem])
      toaster.success({ title: 'เพิ่มโปรโมชั่นแล้ว', description: `"${form.name}" ถูกเพิ่มเรียบร้อย` })
      setIsAdding(false)
    } else if (editItem) {
      setData(data.map(d => d.id === editItem.id ? { ...d, ...form } : d))
      toaster.success({ title: 'บันทึกสำเร็จ', description: `อัพเดท "${form.name}" แล้ว` })
      setEditItem(null)
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    setData(data.filter(d => d.id !== deleteTarget.id))
    toaster.error({ title: 'ลบแล้ว', description: `ลบโปรโมชั่น "${deleteTarget.name}" แล้ว` })
    setDeleteTarget(null)
  }

  function toggleActive(id: string) {
    setData(data.map(d => d.id === id ? { ...d, active: !d.active } : d))
  }

  const isOpen = isAdding || !!editItem

  return (
    <>
      <Box display="flex" justifyContent="flex-end" mb={4}>
        <Button colorPalette="teal" size="sm" onClick={openAdd}>
          <Plus size={16} />
          เพิ่มโปรโมชั่น
        </Button>
      </Box>
      <Box overflowX="auto">
        <Table.Root>
          <Table.Header>
            <Table.Row bg="gray.50">
              <Table.ColumnHeader>ชื่อโปรโมชั่น</Table.ColumnHeader>
              <Table.ColumnHeader>ส่วนลด (%)</Table.ColumnHeader>
              <Table.ColumnHeader>เริ่มต้น</Table.ColumnHeader>
              <Table.ColumnHeader>สิ้นสุด</Table.ColumnHeader>
              <Table.ColumnHeader>เปิดใช้งาน</Table.ColumnHeader>
              <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.map((p) => (
              <Table.Row key={p.id}>
                <Table.Cell fontWeight="medium">{p.name}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette="teal" variant="subtle">{p.discount}%</Badge>
                </Table.Cell>
                <Table.Cell color="gray.600">{p.validFrom}</Table.Cell>
                <Table.Cell color="gray.600">{p.validTo}</Table.Cell>
                <Table.Cell>
                  <Switch.Root
                    checked={p.active}
                    onCheckedChange={() => toggleActive(p.id)}
                    colorPalette="teal"
                    size="sm"
                  >
                    <Switch.HiddenInput />
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                  </Switch.Root>
                </Table.Cell>
                <Table.Cell>
                  <Box display="flex" gap={1}>
                    <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton aria-label="ลบ" variant="ghost" size="sm" colorPalette="red" onClick={() => setDeleteTarget(p)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </Box>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* Add / Edit Dialog */}
      <Dialog.Root open={isOpen} onOpenChange={(e) => { if (!e.open) { setIsAdding(false); setEditItem(null) } }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{isAdding ? 'เพิ่มโปรโมชั่น' : 'แก้ไขโปรโมชั่น'}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>ชื่อโปรโมชั่น</Field.Label>
                  <Input
                    placeholder="เช่น Summer Sale"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>ส่วนลด (%)</Field.Label>
                  <NumberInput.Root
                    min={1} max={100}
                    value={String(form.discount)}
                    onValueChange={(e) => setForm({ ...form, discount: Number(e.value) })}
                  >
                    <NumberInput.Input />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>วันเริ่มต้น</Field.Label>
                  <Input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>วันสิ้นสุด</Field.Label>
                  <Input
                    type="date"
                    value={form.validTo}
                    onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                  />
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
            <Dialog.Header>
              <Dialog.Title>ยืนยันการลบ</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Text>ต้องการลบโปรโมชั่น <strong>&quot;{deleteTarget?.name}&quot;</strong> ใช่หรือไม่?</Text>
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
