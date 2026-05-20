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
  NumberInput,
  Table,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { Eye, Gavel, History, Pencil, Plus } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useEffect } from 'react'
import { toaster } from '@/lib/toaster'
import type { AdminItem, CreatorItem, UserItem, UserStatus } from '@/lib/mock-data/users'
import { PunishmentDialog } from '@/components/punishment/PunishmentDialog'
import type { PunishmentLevel, PunishmentRecord } from '@/lib/mock-data/punishment'
import { PunishmentHistoryDialog } from '@/components/users/PunishmentHistoryDialog'

const statusMap: Record<UserStatus, { label: string; color: string }> = {
  active: { label: 'ใช้งาน', color: 'green' },
  inactive: { label: 'ไม่ใช้งาน', color: 'gray' },
  banned: { label: 'ถูกระงับ', color: 'red' },
}

type AnyUser = UserItem | CreatorItem | AdminItem
type UserType = 'user' | 'creator' | 'admin'

interface EditForm {
  name: string
  status: UserStatus
  role?: string
}

interface AddForm {
  name: string
  email: string
  status: UserStatus
  role: string
  works: number
  followers: number
}

const emptyAddForm: AddForm = { name: '', email: '', status: 'active', role: '', works: 0, followers: 0 }

const addButtonLabel: Record<string, string> = {
  users: 'เพิ่มผู้ใช้งาน',
  creators: 'เพิ่ม Creator',
  admins: 'เพิ่ม Admin',
}

function ActionButtons({ onView, onEdit, onPunish, onHistory }: { onView: () => void; onEdit: () => void; onPunish: () => void; onHistory: () => void }) {
  return (
    <Box display="flex" gap={1}>
      <IconButton aria-label="ดู" variant="ghost" size="sm" onClick={onView}><Eye size={16} /></IconButton>
      <IconButton aria-label="แก้ไข" variant="ghost" size="sm" onClick={onEdit}><Pencil size={16} /></IconButton>
      <IconButton aria-label="ลงโทษ" variant="ghost" size="sm" colorPalette="red" onClick={onPunish}><Gavel size={16} /></IconButton>
      <IconButton aria-label="ประวัติการลงโทษ" variant="ghost" size="sm" colorPalette="orange" onClick={onHistory}><History size={16} /></IconButton>
    </Box>
  )
}

export function UsersPanel() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'users'

  const [users, setUsers] = useState<UserItem[]>([])
  const [creators, setCreators] = useState<CreatorItem[]>([])
  const [admins, setAdmins] = useState<AdminItem[]>([])

  const [selectedUser, setSelectedUser] = useState<AnyUser | null>(null)
  const [userType, setUserType] = useState<UserType>('user')
  const [mode, setMode] = useState<'view' | 'edit' | null>(null)
  const [form, setForm] = useState<EditForm>({ name: '', status: 'active', role: '' })

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm)

  const [punishTarget, setPunishTarget] = useState<AnyUser | null>(null)
  const [punishType, setPunishType] = useState<UserType>('user')

  const [punishRecords, setPunishRecords] = useState<PunishmentRecord[]>([])
  const [historyTarget, setHistoryTarget] = useState<AnyUser | null>(null)

  useEffect(() => {
    fetch('/api/users?type=user').then(r => r.json()).then(data =>
      setUsers(data.map((u: UserItem & { joinedAt: string }) => ({ ...u, joinedAt: u.joinedAt.split('T')[0] })))
    )
    fetch('/api/users?type=creator').then(r => r.json()).then(data =>
      setCreators(data.map((u: UserItem & { creatorProfile: { works: number; followers: number } | null }) => ({
        ...u,
        joinedAt: u.joinedAt.split('T')[0],
        works: u.creatorProfile?.works ?? 0,
        followers: u.creatorProfile?.followers ?? 0,
      })))
    )
    fetch('/api/users?type=admin').then(r => r.json()).then(data =>
      setAdmins(data.map((u: UserItem & { adminProfile: { role: string; lastLogin: string | null } | null }) => ({
        ...u,
        joinedAt: u.joinedAt.split('T')[0],
        role: u.adminProfile?.role ?? '',
        lastLogin: u.adminProfile?.lastLogin?.split('T')[0] ?? '-',
      })))
    )
    fetch('/api/punishment/records').then(r => r.json()).then(data =>
      setPunishRecords(data.map((r: PunishmentRecord & { date: string }) => ({
        ...r,
        date: r.date.split('T')[0],
      })))
    )
  }, [])

  function handleOpenPunish(item: AnyUser, type: UserType) {
    setPunishTarget(item)
    setPunishType(type)
  }

  function handleConfirmPunish(level: PunishmentLevel) {
    if (!punishTarget) return
    if (level.level >= 2) {
      if (punishType === 'user') {
        setUsers(users.map(u => u.id === punishTarget.id ? { ...u, status: 'banned' } : u))
      } else if (punishType === 'creator') {
        setCreators(creators.map(c => c.id === punishTarget.id ? { ...c, status: 'banned' } : c))
      } else {
        setAdmins(admins.map(a => a.id === punishTarget.id ? { ...a, status: 'banned' } : a))
      }
    }
    setPunishRecords(prev => [...prev, {
      id: `ph${Date.now()}`,
      userId: punishTarget.id,
      levelName: level.name,
      date: new Date().toISOString().split('T')[0],
    }])
    toaster.error({ title: 'ลงโทษแล้ว', description: `"${punishTarget.name}" ถูกลงโทษ: ${level.name}` })
    setPunishTarget(null)
  }

  function handleOpenAdd() {
    setAddForm(emptyAddForm)
    setIsAddOpen(true)
  }

  function handleAdd() {
    const today = new Date().toISOString().split('T')[0]
    if (tab === 'users') {
      setUsers([...users, { id: `u${Date.now()}`, name: addForm.name, email: addForm.email, status: addForm.status, joinedAt: today }])
    } else if (tab === 'creators') {
      setCreators([...creators, { id: `c${Date.now()}`, name: addForm.name, email: addForm.email, status: addForm.status, joinedAt: today, works: addForm.works, followers: addForm.followers }])
    } else {
      setAdmins([...admins, { id: `a${Date.now()}`, name: addForm.name, email: addForm.email, status: addForm.status, joinedAt: today, role: addForm.role, lastLogin: '-' }])
    }
    toaster.success({ title: 'เพิ่มสำเร็จ', description: `"${addForm.name}" ถูกเพิ่มเรียบร้อย` })
    setIsAddOpen(false)
  }

  function handleView(item: AnyUser, type: UserType) {
    setSelectedUser(item)
    setUserType(type)
    setMode('view')
  }

  function handleEdit(item: AnyUser, type: UserType) {
    setSelectedUser(item)
    setUserType(type)
    setForm({
      name: item.name,
      status: item.status,
      role: (item as AdminItem).role ?? '',
    })
    setMode('edit')
  }

  function handleClose() {
    setMode(null)
    setSelectedUser(null)
  }

  function handleSave() {
    if (!selectedUser) return
    if (userType === 'user') {
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, name: form.name, status: form.status } : u))
    } else if (userType === 'creator') {
      setCreators(creators.map(c => c.id === selectedUser.id ? { ...c, name: form.name, status: form.status } : c))
    } else {
      setAdmins(admins.map(a => a.id === selectedUser.id ? { ...a, name: form.name, status: form.status, role: form.role ?? a.role } : a))
    }
    toaster.success({ title: 'บันทึกสำเร็จ', description: `อัพเดทข้อมูล "${form.name}" แล้ว` })
    handleClose()
  }

  return (
    <>
      <Card.Root bg="white" shadow="sm">
        <Card.Body p={0}>
          <Tabs.Root value={tab} variant="line">
            <Flex px={4} pt={2} borderBottomWidth="1px" borderColor="gray.200" align="center" justify="space-between">
              <Tabs.List>
                <Tabs.Trigger value="users" asChild><a href="/users?tab=users">Users</a></Tabs.Trigger>
                <Tabs.Trigger value="creators" asChild><a href="/users?tab=creators">Creators</a></Tabs.Trigger>
                <Tabs.Trigger value="admins" asChild><a href="/users?tab=admins">Admins</a></Tabs.Trigger>
              </Tabs.List>
              <Button colorPalette="teal" size="sm" mb={2} onClick={handleOpenAdd}>
                <Plus size={16} />{addButtonLabel[tab] ?? 'เพิ่ม'}
              </Button>
            </Flex>

            <Tabs.Content value="users" p={0}>
              <Box overflowX="auto">
                <Table.Root>
                  <Table.Header>
                    <Table.Row bg="gray.50">
                      <Table.ColumnHeader>ชื่อ</Table.ColumnHeader>
                      <Table.ColumnHeader>อีเมล</Table.ColumnHeader>
                      <Table.ColumnHeader>วันที่สมัคร</Table.ColumnHeader>
                      <Table.ColumnHeader>โทษ</Table.ColumnHeader>
                      <Table.ColumnHeader>สถานะ</Table.ColumnHeader>
                      <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {users.map((row) => {
                      const count = punishRecords.filter(r => r.userId === row.id).length
                      return (
                      <Table.Row key={row.id}>
                        <Table.Cell fontWeight="medium">{row.name}</Table.Cell>
                        <Table.Cell color="gray.600">{row.email}</Table.Cell>
                        <Table.Cell color="gray.600">{row.joinedAt}</Table.Cell>
                        <Table.Cell>
                          {count > 0
                            ? <Badge colorPalette="orange" variant="subtle" cursor="pointer" onClick={() => setHistoryTarget(row)}>{count} ครั้ง</Badge>
                            : <Text color="gray.400" fontSize="sm">—</Text>}
                        </Table.Cell>
                        <Table.Cell><Badge colorPalette={statusMap[row.status].color} variant="subtle">{statusMap[row.status].label}</Badge></Table.Cell>
                        <Table.Cell>
                          <ActionButtons onView={() => handleView(row, 'user')} onEdit={() => handleEdit(row, 'user')} onPunish={() => handleOpenPunish(row, 'user')} onHistory={() => setHistoryTarget(row)} />
                        </Table.Cell>
                      </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Tabs.Content>

            <Tabs.Content value="creators" p={0}>
              <Box overflowX="auto">
                <Table.Root>
                  <Table.Header>
                    <Table.Row bg="gray.50">
                      <Table.ColumnHeader>ชื่อ</Table.ColumnHeader>
                      <Table.ColumnHeader>อีเมล</Table.ColumnHeader>
                      <Table.ColumnHeader>ผลงาน</Table.ColumnHeader>
                      <Table.ColumnHeader>ผู้ติดตาม</Table.ColumnHeader>
                      <Table.ColumnHeader>โทษ</Table.ColumnHeader>
                      <Table.ColumnHeader>สถานะ</Table.ColumnHeader>
                      <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {creators.map((c) => {
                      const count = punishRecords.filter(r => r.userId === c.id).length
                      return (
                      <Table.Row key={c.id}>
                        <Table.Cell fontWeight="medium">{c.name}</Table.Cell>
                        <Table.Cell color="gray.600">{c.email}</Table.Cell>
                        <Table.Cell color="gray.600">{c.works}</Table.Cell>
                        <Table.Cell color="gray.600">{c.followers.toLocaleString()}</Table.Cell>
                        <Table.Cell>
                          {count > 0
                            ? <Badge colorPalette="orange" variant="subtle" cursor="pointer" onClick={() => setHistoryTarget(c)}>{count} ครั้ง</Badge>
                            : <Text color="gray.400" fontSize="sm">—</Text>}
                        </Table.Cell>
                        <Table.Cell><Badge colorPalette={statusMap[c.status].color} variant="subtle">{statusMap[c.status].label}</Badge></Table.Cell>
                        <Table.Cell>
                          <ActionButtons onView={() => handleView(c, 'creator')} onEdit={() => handleEdit(c, 'creator')} onPunish={() => handleOpenPunish(c, 'creator')} onHistory={() => setHistoryTarget(c)} />
                        </Table.Cell>
                      </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Tabs.Content>

            <Tabs.Content value="admins" p={0}>
              <Box overflowX="auto">
                <Table.Root>
                  <Table.Header>
                    <Table.Row bg="gray.50">
                      <Table.ColumnHeader>ชื่อ</Table.ColumnHeader>
                      <Table.ColumnHeader>อีเมล</Table.ColumnHeader>
                      <Table.ColumnHeader>บทบาท</Table.ColumnHeader>
                      <Table.ColumnHeader>เข้าสู่ระบบล่าสุด</Table.ColumnHeader>
                      <Table.ColumnHeader>โทษ</Table.ColumnHeader>
                      <Table.ColumnHeader>สถานะ</Table.ColumnHeader>
                      <Table.ColumnHeader>จัดการ</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {admins.map((a) => {
                      const count = punishRecords.filter(r => r.userId === a.id).length
                      return (
                      <Table.Row key={a.id}>
                        <Table.Cell fontWeight="medium">{a.name}</Table.Cell>
                        <Table.Cell color="gray.600">{a.email}</Table.Cell>
                        <Table.Cell color="gray.600">{a.role}</Table.Cell>
                        <Table.Cell color="gray.600">{a.lastLogin}</Table.Cell>
                        <Table.Cell>
                          {count > 0
                            ? <Badge colorPalette="orange" variant="subtle" cursor="pointer" onClick={() => setHistoryTarget(a)}>{count} ครั้ง</Badge>
                            : <Text color="gray.400" fontSize="sm">—</Text>}
                        </Table.Cell>
                        <Table.Cell><Badge colorPalette={statusMap[a.status].color} variant="subtle">{statusMap[a.status].label}</Badge></Table.Cell>
                        <Table.Cell>
                          <ActionButtons onView={() => handleView(a, 'admin')} onEdit={() => handleEdit(a, 'admin')} onPunish={() => handleOpenPunish(a, 'admin')} onHistory={() => setHistoryTarget(a)} />
                        </Table.Cell>
                      </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </Card.Body>
      </Card.Root>

      {/* View Dialog */}
      <Dialog.Root open={mode === 'view'} onOpenChange={(e) => { if (!e.open) handleClose() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>ข้อมูลผู้ใช้</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              {selectedUser && (
                <Flex direction="column" gap={3}>
                  <Box><Text fontSize="xs" color="gray.500">ชื่อ</Text><Text fontWeight="medium">{selectedUser.name}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">อีเมล</Text><Text>{selectedUser.email}</Text></Box>
                  <Box><Text fontSize="xs" color="gray.500">วันที่สมัคร</Text><Text>{selectedUser.joinedAt}</Text></Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">สถานะ</Text>
                    <Badge colorPalette={statusMap[selectedUser.status].color} variant="subtle" mt={1}>
                      {statusMap[selectedUser.status].label}
                    </Badge>
                  </Box>
                  {userType === 'creator' && (
                    <>
                      <Box><Text fontSize="xs" color="gray.500">ผลงาน</Text><Text>{(selectedUser as CreatorItem).works} เรื่อง</Text></Box>
                      <Box><Text fontSize="xs" color="gray.500">ผู้ติดตาม</Text><Text>{(selectedUser as CreatorItem).followers.toLocaleString()} คน</Text></Box>
                    </>
                  )}
                  {userType === 'admin' && (
                    <>
                      <Box><Text fontSize="xs" color="gray.500">บทบาท</Text><Text>{(selectedUser as AdminItem).role}</Text></Box>
                      <Box><Text fontSize="xs" color="gray.500">เข้าสู่ระบบล่าสุด</Text><Text>{(selectedUser as AdminItem).lastLogin}</Text></Box>
                    </>
                  )}
                </Flex>
              )}
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={handleClose}>ปิด</Button>
              {selectedUser && (
                <Button colorPalette="teal" onClick={() => selectedUser && handleEdit(selectedUser, userType)}>แก้ไข</Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Add Dialog */}
      <Dialog.Root open={isAddOpen} onOpenChange={(e) => { if (!e.open) setIsAddOpen(false) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{addButtonLabel[tab] ?? 'เพิ่ม'}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>ชื่อ</Field.Label>
                  <Input placeholder="ชื่อ-นามสกุล" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>อีเมล</Field.Label>
                  <Input type="email" placeholder="email@example.com" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>สถานะ</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value as UserStatus })}>
                      <option value="active">ใช้งาน</option>
                      <option value="inactive">ไม่ใช้งาน</option>
                      <option value="banned">ถูกระงับ</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                {tab === 'creators' && (
                  <>
                    <Field.Root>
                      <Field.Label>จำนวนผลงาน</Field.Label>
                      <NumberInput.Root min={0} value={String(addForm.works)} onValueChange={(e) => setAddForm({ ...addForm, works: Number(e.value) })}>
                        <NumberInput.Input />
                        <NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control>
                      </NumberInput.Root>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>ผู้ติดตาม</Field.Label>
                      <NumberInput.Root min={0} value={String(addForm.followers)} onValueChange={(e) => setAddForm({ ...addForm, followers: Number(e.value) })}>
                        <NumberInput.Input />
                        <NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control>
                      </NumberInput.Root>
                    </Field.Root>
                  </>
                )}
                {tab === 'admins' && (
                  <Field.Root>
                    <Field.Label>บทบาท</Field.Label>
                    <Input placeholder="เช่น Moderator" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} />
                  </Field.Root>
                )}
              </Flex>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
              <Button colorPalette="teal" onClick={handleAdd} disabled={!addForm.name.trim() || !addForm.email.trim()}>เพิ่ม</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <PunishmentDialog
        open={!!punishTarget}
        targetName={punishTarget?.name ?? ''}
        onClose={() => setPunishTarget(null)}
        onConfirm={handleConfirmPunish}
      />

      <PunishmentHistoryDialog
        open={!!historyTarget}
        userName={historyTarget?.name ?? ''}
        records={punishRecords.filter(r => r.userId === historyTarget?.id)}
        onClose={() => setHistoryTarget(null)}
      />

      {/* Edit Dialog */}
      <Dialog.Root open={mode === 'edit'} onOpenChange={(e) => { if (!e.open) handleClose() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>แก้ไขข้อมูลผู้ใช้</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Field.Root>
                  <Field.Label>ชื่อ</Field.Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field.Root>
                <Field.Root>
                  <Field.Label>สถานะ</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })}
                    >
                      <option value="active">ใช้งาน</option>
                      <option value="inactive">ไม่ใช้งาน</option>
                      <option value="banned">ถูกระงับ</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                {userType === 'admin' && (
                  <Field.Root>
                    <Field.Label>บทบาท</Field.Label>
                    <Input value={form.role ?? ''} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                  </Field.Root>
                )}
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
