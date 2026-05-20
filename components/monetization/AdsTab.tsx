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
  Switch,
  Table,
  Text,
} from '@chakra-ui/react'
import { ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toaster } from '@/lib/toaster'
import type { AdItem, AdPlacement, AdType } from '@/lib/mock-data/ads'

const typeLabel: Record<AdType, string> = {
  banner: 'Banner',
  interstitial: 'Interstitial',
  'in-content': 'In-content',
}
const typeColor: Record<AdType, string> = {
  banner: 'blue',
  interstitial: 'purple',
  'in-content': 'teal',
}
const adTypes: AdType[] = ['banner', 'interstitial', 'in-content']

interface AdForm {
  name: string
  advertiser: string
  type: AdType
  validFrom: string
  validTo: string
  imageUrl: string
}
const emptyForm: AdForm = { name: '', advertiser: '', type: 'banner', validFrom: '', validTo: '', imageUrl: '' }

function formFromItem(item: AdItem): AdForm {
  return {
    name: item.name,
    advertiser: item.advertiser,
    type: item.type,
    validFrom: item.validFrom,
    validTo: item.validTo,
    imageUrl: item.imageUrl ?? '',
  }
}

export function AdsTab() {
  const [placements, setPlacements] = useState<AdPlacement[]>([])
  const [ads, setAds] = useState<AdItem[]>([])

  useEffect(() => {
    fetch('/api/ads').then(r => r.json()).then(d => {
      const mapType = (t: string) => t.replace('_', '-') as AdType
      setPlacements(d.placements.map((p: AdPlacement & { type: string }) => ({ ...p, type: mapType(p.type) })))
      setAds(d.ads.map((a: AdItem & { type: string; validFrom: string; validTo: string }) => ({
        ...a,
        type: mapType(a.type),
        validFrom: a.validFrom.split('T')[0],
        validTo: a.validTo.split('T')[0],
      })))
    })
  }, [])
  const [editItem, setEditItem] = useState<AdItem | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdItem | null>(null)
  const [form, setForm] = useState<AdForm>(emptyForm)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function togglePlacement(id: string) {
    setPlacements(placements.map(p => p.id === id ? { ...p, active: !p.active } : p))
  }

  function toggleAd(id: string) {
    setAds(ads.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  function openAdd() {
    setForm(emptyForm)
    setIsAdding(true)
  }

  function openEdit(item: AdItem) {
    setForm(formFromItem(item))
    setEditItem(item)
  }

  function closeDialog() {
    setIsAdding(false)
    setEditItem(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setForm(prev => ({ ...prev, imageUrl: ev.target?.result as string }))
    }
    reader.readAsDataURL(file)
  }

  function clearImage(e: React.MouseEvent) {
    e.stopPropagation()
    setForm(prev => ({ ...prev, imageUrl: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSave() {
    if (isAdding) {
      setAds([...ads, { id: `a${Date.now()}`, ...form, active: true }])
      toaster.success({ title: 'เพิ่มโฆษณาแล้ว', description: `"${form.name}" ถูกเพิ่มเรียบร้อย` })
      closeDialog()
    } else if (editItem) {
      setAds(ads.map(a => a.id === editItem.id ? { ...a, ...form } : a))
      toaster.success({ title: 'บันทึกสำเร็จ', description: `อัพเดทโฆษณา "${form.name}" แล้ว` })
      closeDialog()
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    setAds(ads.filter(a => a.id !== deleteTarget.id))
    toaster.error({ title: 'ลบแล้ว', description: `ลบโฆษณา "${deleteTarget.name}" แล้ว` })
    setDeleteTarget(null)
  }

  const isOpen = isAdding || !!editItem

  return (
    <>
      {/* Ad Placements */}
      <Box mb={8}>
        <Box mb={4}>
          <Text fontWeight="semibold" color="gray.700" fontSize="md">ตำแหน่งโฆษณา</Text>
          <Text color="gray.500" fontSize="sm" mt={0.5}>เปิด/ปิดการแสดงโฆษณาในแต่ละตำแหน่ง</Text>
        </Box>
        <Box overflowX="auto">
          <Table.Root>
            <Table.Header>
              <Table.Row bg="gray.50">
                <Table.ColumnHeader>ชื่อตำแหน่ง</Table.ColumnHeader>
                <Table.ColumnHeader>ตำแหน่งที่แสดง</Table.ColumnHeader>
                <Table.ColumnHeader>ประเภท</Table.ColumnHeader>
                <Table.ColumnHeader>เปิดใช้งาน</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {placements.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell fontWeight="medium">{p.name}</Table.Cell>
                  <Table.Cell color="gray.600" fontSize="sm">{p.location}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={typeColor[p.type]} variant="subtle">{typeLabel[p.type]}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Switch.Root checked={p.active} onCheckedChange={() => togglePlacement(p.id)} colorPalette="teal" size="sm">
                      <Switch.HiddenInput />
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch.Root>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>

      {/* Ad List */}
      <Box>
        <Flex justify="space-between" align="center" mb={4}>
          <Box>
            <Text fontWeight="semibold" color="gray.700" fontSize="md">รายการโฆษณา</Text>
            <Text color="gray.500" fontSize="sm" mt={0.5}>จัดการแคมเปญโฆษณาทั้งหมด</Text>
          </Box>
          <Button colorPalette="teal" size="sm" onClick={openAdd}><Plus size={16} />เพิ่มโฆษณา</Button>
        </Flex>
        <Box overflowX="auto">
          <Table.Root>
            <Table.Header>
              <Table.Row bg="gray.50">
                <Table.ColumnHeader>ภาพ</Table.ColumnHeader>
                <Table.ColumnHeader>ชื่อแคมเปญ</Table.ColumnHeader>
                <Table.ColumnHeader>ผู้ลงโฆษณา</Table.ColumnHeader>
                <Table.ColumnHeader>ประเภท</Table.ColumnHeader>
                <Table.ColumnHeader>เริ่มต้น</Table.ColumnHeader>
                <Table.ColumnHeader>สิ้นสุด</Table.ColumnHeader>
                <Table.ColumnHeader>เปิดใช้งาน</Table.ColumnHeader>
                <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {ads.map((a) => (
                <Table.Row key={a.id}>
                  <Table.Cell>
                    {a.imageUrl ? (
                      <Box
                        as="img"
                        src={a.imageUrl}
                        alt={a.name}
                        w="56px"
                        h="36px"
                        objectFit="cover"
                        borderRadius="sm"
                        border="1px solid"
                        borderColor="gray.200"
                      />
                    ) : (
                      <Flex w="56px" h="36px" bg="gray.100" borderRadius="sm" align="center" justify="center" color="gray.400">
                        <ImageIcon size={16} />
                      </Flex>
                    )}
                  </Table.Cell>
                  <Table.Cell fontWeight="medium">{a.name}</Table.Cell>
                  <Table.Cell color="gray.600">{a.advertiser}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={typeColor[a.type]} variant="subtle">{typeLabel[a.type]}</Badge>
                  </Table.Cell>
                  <Table.Cell color="gray.600">{a.validFrom}</Table.Cell>
                  <Table.Cell color="gray.600">{a.validTo}</Table.Cell>
                  <Table.Cell>
                    <Switch.Root checked={a.active} onCheckedChange={() => toggleAd(a.id)} colorPalette="teal" size="sm">
                      <Switch.HiddenInput />
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Box display="flex" gap={1}>
                      <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil size={16} /></IconButton>
                      <IconButton aria-label="ลบ" variant="ghost" size="sm" colorPalette="red" onClick={() => setDeleteTarget(a)}><Trash2 size={16} /></IconButton>
                    </Box>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>

      {/* Add / Edit Dialog */}
      <Dialog.Root open={isOpen} onOpenChange={(e) => { if (!e.open) closeDialog() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{isAdding ? 'เพิ่มโฆษณา' : 'แก้ไขโฆษณา'}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>ภาพโฆษณา</Field.Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                  />
                  <Box
                    border="2px dashed"
                    borderColor={form.imageUrl ? 'teal.300' : 'gray.200'}
                    borderRadius="md"
                    overflow="hidden"
                    cursor="pointer"
                    onClick={() => fileInputRef.current?.click()}
                    transition="border-color 0.2s"
                    _hover={{ borderColor: 'teal.400' }}
                  >
                    {form.imageUrl ? (
                      <Box position="relative">
                        <Box
                          as="img"
                          src={form.imageUrl}
                          alt="preview"
                          w="100%"
                          h="160px"
                          objectFit="cover"
                          display="block"
                        />
                        <IconButton
                          aria-label="ลบภาพ"
                          size="xs"
                          colorPalette="red"
                          position="absolute"
                          top={2}
                          right={2}
                          onClick={clearImage}
                        >
                          <X size={12} />
                        </IconButton>
                      </Box>
                    ) : (
                      <Flex direction="column" align="center" justify="center" h="120px" gap={1} color="gray.400">
                        <ImageIcon size={28} />
                        <Text fontSize="sm">คลิกเพื่ออัพโหลดภาพโฆษณา</Text>
                        <Text fontSize="xs">PNG, JPG, GIF</Text>
                      </Flex>
                    )}
                  </Box>
                </Field.Root>

                <Field.Root>
                  <Field.Label>ชื่อแคมเปญ</Field.Label>
                  <Input placeholder="เช่น Book Fair 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>ผู้ลงโฆษณา</Field.Label>
                  <Input placeholder="เช่น สำนักพิมพ์ A" value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>ประเภทโฆษณา</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AdType })}>
                      {adTypes.map(t => <option key={t} value={t}>{typeLabel[t]}</option>)}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                <Field.Root>
                  <Field.Label>วันเริ่มต้น</Field.Label>
                  <Input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>วันสิ้นสุด</Field.Label>
                  <Input type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
                </Field.Root>
              </Flex>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
              <Button colorPalette="teal" onClick={handleSave} disabled={!form.name.trim() || !form.advertiser.trim()}>บันทึก</Button>
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
            <Dialog.Body><Text>ต้องการลบโฆษณา <strong>&quot;{deleteTarget?.name}&quot;</strong> ใช่หรือไม่?</Text></Dialog.Body>
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
