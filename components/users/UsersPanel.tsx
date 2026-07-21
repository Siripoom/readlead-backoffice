'use client'

import {
  Button,
  Dialog,
  Field,
  Flex,
  Input,
  NativeSelect,
  NumberInput,
} from '@chakra-ui/react'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PunishmentDialog } from '@/components/punishment/PunishmentDialog'
import { ModerationPanel } from '@/components/users/ModerationPanel'
import { PunishmentHistoryDialog } from '@/components/users/PunishmentHistoryDialog'
import type { PunishmentLevel, PunishmentRecord } from '@/lib/mock-data/punishment'
import type { AdminItem, CreatorItem, UserItem, UserStatus } from '@/lib/mock-data/users'
import { toaster } from '@/lib/toaster'
import styles from './UsersPanel.module.css'

type AnyUser = UserItem | CreatorItem | AdminItem
type UserType = 'user' | 'creator' | 'admin'
type UserTab = 'users' | 'creators' | 'admins'
type StatusFilter = 'all' | UserStatus

interface EditForm {
  name: string
  status: UserStatus
  role?: string
  permissions?: string[]
}

interface AddForm {
  name: string
  email: string
  status: UserStatus
  role: string
  works: number
  followers: number
  password: string
}

const emptyAddForm: AddForm = {
  name: '',
  email: '',
  status: 'active',
  role: '',
  works: 0,
  followers: 0,
  password: '',
}

const pageContent: Record<UserTab, { title: string; description: string; addLabel: string }> = {
  users: {
    title: 'ผู้ใช้งาน',
    description: 'บัญชีนักอ่านทั้งหมดในระบบ — ดู ระงับ หรือจัดการบัญชี',
    addLabel: 'เพิ่มผู้ใช้งาน',
  },
  creators: {
    title: 'นักเขียน',
    description: 'บัญชีนักเขียนพร้อมจำนวนผลงานและผู้ติดตาม',
    addLabel: 'เพิ่มนักเขียน',
  },
  admins: {
    title: 'แอดมิน',
    description: 'เพิ่มผู้ดูแลระบบ ออกไอดีแอดมิน และกำหนดสิทธิ์ว่าแต่ละคนเห็นเมนูไหนได้บ้าง',
    addLabel: 'เพิ่มแอดมิน',
  },
}

const statusMap: Record<UserStatus, { label: string; className: string }> = {
  active: { label: 'ใช้งานอยู่', className: styles.statusActive },
  inactive: { label: 'ไม่ใช้งาน', className: styles.statusInactive },
  banned: { label: 'ถูกระงับ', className: styles.statusBanned },
}

const permissionLabels: Record<string, string> = {
  dashboard: 'ภาพรวม',
  users: 'ผู้ใช้',
  admins: 'แอดมิน',
  reports: 'รายงาน',
  finance: 'การเงิน',
  punishment: 'บทลงโทษ',
  cms: 'แบนเนอร์',
  exp: 'EXP/ตั๋ว',
}

const filters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'ใช้งานอยู่' },
  { value: 'inactive', label: 'ไม่ใช้งาน' },
  { value: 'banned', label: 'ถูกระงับ' },
]

function isUserTab(value: string | null): value is UserTab {
  return value === 'users' || value === 'creators' || value === 'admins'
}

function formatThaiDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function UserIdentity({ item }: { item: AnyUser }) {
  return (
    <div className={styles.userCell}>
      <span className={styles.avatar}>{initials(item.name)}</span>
      <span className={styles.userName}>{item.name}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  const item = statusMap[status]
  return <span className={`${styles.statusBadge} ${item.className}`}>{item.label}</span>
}

function ActionButtons({
  onView,
  onEdit,
  onPunish,
  onHistory,
}: {
  onView: () => void
  onEdit: () => void
  onPunish: () => void
  onHistory: () => void
}) {
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.smallButton} onClick={onView}>ดู</button>
      <button type="button" className={styles.smallButton} onClick={onEdit}>แก้ไข</button>
      <button type="button" className={`${styles.smallButton} ${styles.dangerButton}`} onClick={onPunish}>ลงโทษ</button>
      <button type="button" className={styles.smallButton} onClick={onHistory}>ประวัติ</button>
    </div>
  )
}

function FilterPills({ value, onChange }: { value: StatusFilter; onChange: (value: StatusFilter) => void }) {
  return (
    <div className={styles.pills} aria-label="กรองสถานะ">
      {filters.map((filter) => (
        <button
          key={filter.value}
          type="button"
          className={`${styles.pill} ${value === filter.value ? styles.activePill : ''}`}
          onClick={() => onChange(filter.value)}
          aria-pressed={value === filter.value}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}

function TableState({ message }: { message: string }) {
  return <div className={styles.tableState}>{message}</div>
}

export function UsersPanel() {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab: UserTab = isUserTab(requestedTab) ? requestedTab : 'users'
  const currentPage = pageContent[tab]

  const [users, setUsers] = useState<UserItem[]>([])
  const [creators, setCreators] = useState<CreatorItem[]>([])
  const [admins, setAdmins] = useState<AdminItem[]>([])
  const [filtersByTab, setFiltersByTab] = useState<Record<'users' | 'creators', StatusFilter>>({ users: 'all', creators: 'all' })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [selectedUser, setSelectedUser] = useState<AnyUser | null>(null)
  const [userType, setUserType] = useState<UserType>('user')
  const [mode, setMode] = useState<'view' | 'edit' | null>(null)
  const [form, setForm] = useState<EditForm>({ name: '', status: 'active', role: '' })
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>(emptyAddForm)
  const [punishTarget, setPunishTarget] = useState<AnyUser | null>(null)
  const [punishRecords, setPunishRecords] = useState<PunishmentRecord[]>([])
  const [historyTarget, setHistoryTarget] = useState<AnyUser | null>(null)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const responses = await Promise.all([
        fetch('/api/users?type=user'),
        fetch('/api/users?type=creator'),
        fetch('/api/users?type=admin'),
        fetch('/api/punishment/records'),
      ])
      if (responses.some((response) => !response.ok)) throw new Error('Unable to load users')

      const [rawUsers, rawCreators, rawAdmins, rawRecords] = await Promise.all(responses.map((response) => response.json()))
      setUsers(rawUsers.map((user: UserItem & { joinedAt: string }) => ({ ...user, joinedAt: user.joinedAt })))
      setCreators(rawCreators.map((user: UserItem & { creatorProfile: { works: number; followers: number } | null }) => ({
        ...user,
        joinedAt: user.joinedAt,
        works: user.creatorProfile?.works ?? 0,
        followers: user.creatorProfile?.followers ?? 0,
      })))
      setAdmins(rawAdmins.map((user: UserItem & { adminProfile: { role: string; lastLogin: string | null; adminCode?: string; permissions?: string[]; isOwner?: boolean } | null }) => ({
        ...user,
        joinedAt: user.joinedAt,
        role: user.adminProfile?.role ?? '',
        lastLogin: user.adminProfile?.lastLogin ?? '-',
        adminCode: user.adminProfile?.adminCode,
        permissions: user.adminProfile?.permissions ?? [],
        isOwner: user.adminProfile?.isOwner ?? false,
      })))
      setPunishRecords(rawRecords.map((record: PunishmentRecord & { date: string }) => ({ ...record, date: record.date })))
    } catch {
      setLoadError('โหลดข้อมูลผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // The callback performs the initial synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll()
  }, [fetchAll])

  const visibleUsers = useMemo(() => {
    const filter = filtersByTab.users
    return filter === 'all' ? users : users.filter((user) => user.status === filter)
  }, [filtersByTab.users, users])

  const visibleCreators = useMemo(() => {
    const filter = filtersByTab.creators
    return filter === 'all' ? creators : creators.filter((creator) => creator.status === filter)
  }, [creators, filtersByTab.creators])

  function setFilter(section: 'users' | 'creators', value: StatusFilter) {
    setFiltersByTab((current) => ({ ...current, [section]: value }))
  }

  function punishmentCount(userId: string) {
    return punishRecords.filter((record) => record.userId === userId).length
  }

  async function handleConfirmPunish(level: PunishmentLevel) {
    if (!punishTarget) return
    const punishmentResponse = await fetch(`/api/users/${punishTarget.id}/punishments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelName: level.name }),
    })
    if (!punishmentResponse.ok) {
      toaster.error({ title: 'ลงโทษไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' })
      return
    }
    if (level.level >= 2) {
      await fetch(`/api/users/${punishTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'banned' }),
      })
    }
    await fetchAll()
    toaster.error({ title: 'ลงโทษแล้ว', description: `"${punishTarget.name}" ถูกลงโทษ: ${level.name}` })
    setPunishTarget(null)
  }

  function handleOpenAdd() {
    setAddForm(emptyAddForm)
    setIsAddOpen(true)
  }

  async function handleAdd() {
    const userTypeMap: Record<UserTab, UserType> = { users: 'user', creators: 'creator', admins: 'admin' }
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addForm.name,
        email: addForm.email,
        status: addForm.status,
        userType: userTypeMap[tab],
        works: addForm.works,
        followers: addForm.followers,
        role: addForm.role,
        password: addForm.password,
        permissions: ['dashboard', 'users', 'reports'],
      }),
    })
    if (!response.ok) {
      toaster.error({ title: 'เพิ่มไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' })
      return
    }
    await fetchAll()
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
      permissions: (item as AdminItem).permissions ?? [],
    })
    setMode('edit')
  }

  function handleClose() {
    setMode(null)
    setSelectedUser(null)
  }

  async function handleSave() {
    if (!selectedUser) return
    const response = await fetch(`/api/users/${selectedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, status: form.status, role: form.role, permissions: form.permissions }),
    })
    if (!response.ok) {
      toaster.error({ title: 'บันทึกไม่สำเร็จ', description: 'กรุณาตรวจสอบสิทธิ์แล้วลองใหม่อีกครั้ง' })
      return
    }
    await fetchAll()
    toaster.success({ title: 'บันทึกสำเร็จ', description: `อัปเดตข้อมูล "${form.name}" แล้ว` })
    handleClose()
  }

  const renderActions = (item: AnyUser, type: UserType) => (
    <ActionButtons
      onView={() => handleView(item, type)}
      onEdit={() => handleEdit(item, type)}
      onPunish={() => setPunishTarget(item)}
      onHistory={() => setHistoryTarget(item)}
    />
  )

  return (
    <>
      {tab === 'creators' && <ModerationPanel />}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{currentPage.title}</h1>
          <p className={styles.pageDescription}>{currentPage.description}</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={handleOpenAdd}>
          <Plus aria-hidden="true" />
          {currentPage.addLabel}
        </button>
      </div>

      {loadError && (
        <div className={styles.errorBanner} role="alert">
          <span>{loadError}</span>
          <button type="button" className={styles.smallButton} onClick={() => void fetchAll()}>ลองใหม่</button>
        </div>
      )}

      {tab === 'users' && (
        <section className={styles.panel} aria-label="รายชื่อผู้ใช้งาน">
          <div className={styles.panelHeader}>
            <FilterPills value={filtersByTab.users} onChange={(value) => setFilter('users', value)} />
          </div>
          {isLoading ? <TableState message="กำลังโหลดข้อมูลผู้ใช้งาน…" /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>ผู้ใช้</th><th>ไอดี</th><th>อีเมล</th><th>สมัครเมื่อ</th><th>โทษ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const count = punishmentCount(user.id)
                    return (
                      <tr key={user.id}>
                        <td><UserIdentity item={user} /></td>
                        <td className={styles.mutedCell}>{user.id}</td>
                        <td className={styles.mutedCell}>{user.email}</td>
                        <td className={styles.mutedCell}>{formatThaiDate(user.joinedAt)}</td>
                        <td>{count > 0 ? <button type="button" className={styles.punishmentCount} onClick={() => setHistoryTarget(user)}>{count} ครั้ง</button> : <span className={styles.emptyValue}>—</span>}</td>
                        <td><StatusBadge status={user.status} /></td>
                        <td>{renderActions(user, 'user')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {visibleUsers.length === 0 && <TableState message="ไม่มีบัญชีในหมวดนี้" />}
            </div>
          )}
        </section>
      )}

      {tab === 'creators' && (
        <section className={styles.panel} aria-label="รายชื่อนักเขียน">
          <div className={styles.panelHeader}>
            <FilterPills value={filtersByTab.creators} onChange={(value) => setFilter('creators', value)} />
          </div>
          {isLoading ? <TableState message="กำลังโหลดข้อมูลนักเขียน…" /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>นักเขียน</th><th>ไอดี</th><th>ผลงาน</th><th>ผู้ติดตาม</th><th>โทษ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {visibleCreators.map((creator) => {
                    const count = punishmentCount(creator.id)
                    return (
                      <tr key={creator.id}>
                        <td><UserIdentity item={creator} /></td>
                        <td className={styles.mutedCell}>{creator.id}</td>
                        <td>{creator.works.toLocaleString('th-TH')}</td>
                        <td>{creator.followers.toLocaleString('th-TH')}</td>
                        <td>{count > 0 ? <button type="button" className={styles.punishmentCount} onClick={() => setHistoryTarget(creator)}>{count} ครั้ง</button> : <span className={styles.emptyValue}>—</span>}</td>
                        <td><StatusBadge status={creator.status} /></td>
                        <td>{renderActions(creator, 'creator')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {visibleCreators.length === 0 && <TableState message="ไม่มีบัญชีนักเขียนในหมวดนี้" />}
            </div>
          )}
        </section>
      )}

      {tab === 'admins' && (
        <section className={styles.panel} aria-label="รายชื่อแอดมิน">
          {isLoading ? <TableState message="กำลังโหลดข้อมูลแอดมิน…" /> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>ชื่อ</th><th>ไอดีแอดมิน</th><th>บทบาท</th><th>เมนูที่เห็น</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td><UserIdentity item={admin} /></td>
                      <td className={styles.mutedCell}>{admin.adminCode ?? '—'}</td>
                      <td className={styles.mutedCell}>{admin.role || '—'}</td>
                      <td>
                        <div className={styles.permissionChips}>
                          {admin.isOwner ? <span className={`${styles.permissionChip} ${styles.allPermissions}`}>ทุกเมนู</span> : admin.permissions?.map((permission) => <span className={styles.permissionChip} key={permission}>{permissionLabels[permission] ?? permission}</span>)}
                        </div>
                      </td>
                      <td><StatusBadge status={admin.status} /></td>
                      <td>{renderActions(admin, 'admin')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {admins.length === 0 && <TableState message="ยังไม่มีบัญชีแอดมิน" />}
            </div>
          )}
        </section>
      )}

      <Dialog.Root open={mode === 'view'} onOpenChange={(event) => { if (!event.open) handleClose() }}>
        <Dialog.Backdrop className={styles.modalBackdrop} />
        <Dialog.Positioner className={styles.modalPositioner}>
          <Dialog.Content className={styles.modalContent}>
            <Dialog.Header className={styles.modalHeader}>
              <Dialog.Title className={styles.modalTitle}>ข้อมูลผู้ใช้</Dialog.Title>
              <Dialog.CloseTrigger className={styles.modalClose} />
            </Dialog.Header>
            <Dialog.Body className={styles.modalBody}>
              {selectedUser && (
                <div className={styles.detailList}>
                  <div><span>ชื่อ</span><strong>{selectedUser.name}</strong></div>
                  <div><span>อีเมล</span><strong>{selectedUser.email}</strong></div>
                  <div><span>วันที่สมัคร</span><strong>{formatThaiDate(selectedUser.joinedAt)}</strong></div>
                  <div><span>สถานะ</span><StatusBadge status={selectedUser.status} /></div>
                  {userType === 'creator' && <><div><span>ผลงาน</span><strong>{(selectedUser as CreatorItem).works.toLocaleString('th-TH')} เรื่อง</strong></div><div><span>ผู้ติดตาม</span><strong>{(selectedUser as CreatorItem).followers.toLocaleString('th-TH')} คน</strong></div></>}
                  {userType === 'admin' && <><div><span>บทบาท</span><strong>{(selectedUser as AdminItem).role || '—'}</strong></div><div><span>เข้าสู่ระบบล่าสุด</span><strong>{formatThaiDate((selectedUser as AdminItem).lastLogin)}</strong></div></>}
                </div>
              )}
            </Dialog.Body>
            <Dialog.Footer className={styles.modalFooter}>
              <Button className={styles.dialogGhostButton} onClick={handleClose}>ปิด</Button>
              {selectedUser && <Button className={styles.dialogPrimaryButton} onClick={() => handleEdit(selectedUser, userType)}>แก้ไข</Button>}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={isAddOpen} onOpenChange={(event) => { if (!event.open) setIsAddOpen(false) }}>
        <Dialog.Backdrop className={styles.modalBackdrop} />
        <Dialog.Positioner className={styles.modalPositioner}>
          <Dialog.Content className={styles.modalContent}>
            <Dialog.Header className={styles.modalHeader}>
              <Dialog.Title className={styles.modalTitle}>{currentPage.addLabel}</Dialog.Title>
              <Dialog.CloseTrigger className={styles.modalClose} />
            </Dialog.Header>
            <Dialog.Body className={styles.modalBody}>
              <Flex direction="column" gap={4}>
                <Field.Root><Field.Label className={styles.fieldLabel}>ชื่อ</Field.Label><Input className={styles.fieldInput} placeholder="ชื่อ-นามสกุล" value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} /></Field.Root>
                <Field.Root><Field.Label className={styles.fieldLabel}>อีเมล</Field.Label><Input className={styles.fieldInput} type="email" placeholder="email@example.com" value={addForm.email} onChange={(event) => setAddForm({ ...addForm, email: event.target.value })} /></Field.Root>
                <Field.Root>
                  <Field.Label className={styles.fieldLabel}>สถานะ</Field.Label>
                  <NativeSelect.Root><NativeSelect.Field className={styles.fieldInput} value={addForm.status} onChange={(event) => setAddForm({ ...addForm, status: event.target.value as UserStatus })}><option value="active">ใช้งาน</option><option value="inactive">ไม่ใช้งาน</option><option value="banned">ถูกระงับ</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>
                </Field.Root>
                {tab === 'creators' && <><Field.Root><Field.Label className={styles.fieldLabel}>จำนวนผลงาน</Field.Label><NumberInput.Root min={0} value={String(addForm.works)} onValueChange={(event) => setAddForm({ ...addForm, works: Number(event.value) })}><NumberInput.Input className={styles.fieldInput} /><NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control></NumberInput.Root></Field.Root><Field.Root><Field.Label className={styles.fieldLabel}>ผู้ติดตาม</Field.Label><NumberInput.Root min={0} value={String(addForm.followers)} onValueChange={(event) => setAddForm({ ...addForm, followers: Number(event.value) })}><NumberInput.Input className={styles.fieldInput} /><NumberInput.Control><NumberInput.IncrementTrigger /><NumberInput.DecrementTrigger /></NumberInput.Control></NumberInput.Root></Field.Root></>}
                {tab === 'admins' && <><Field.Root><Field.Label className={styles.fieldLabel}>บทบาท</Field.Label><Input className={styles.fieldInput} placeholder="เช่น ผู้ดูแลเนื้อหา" value={addForm.role} onChange={(event) => setAddForm({ ...addForm, role: event.target.value })} /></Field.Root><Field.Root><Field.Label className={styles.fieldLabel}>รหัสผ่านเริ่มต้น</Field.Label><Input className={styles.fieldInput} type="password" minLength={8} value={addForm.password} onChange={(event) => setAddForm({ ...addForm, password: event.target.value })} /></Field.Root></>}
              </Flex>
            </Dialog.Body>
            <Dialog.Footer className={styles.modalFooter}>
              <Button className={styles.dialogGhostButton} onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
              <Button className={styles.dialogPrimaryButton} onClick={handleAdd} disabled={!addForm.name.trim() || !addForm.email.trim() || (tab === 'admins' && (!addForm.role.trim() || addForm.password.length < 8))}>เพิ่ม</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <PunishmentDialog open={!!punishTarget} targetName={punishTarget?.name ?? ''} onClose={() => setPunishTarget(null)} onConfirm={handleConfirmPunish} />
      <PunishmentHistoryDialog open={!!historyTarget} userName={historyTarget?.name ?? ''} records={punishRecords.filter((record) => record.userId === historyTarget?.id)} onClose={() => setHistoryTarget(null)} />

      <Dialog.Root open={mode === 'edit'} onOpenChange={(event) => { if (!event.open) handleClose() }}>
        <Dialog.Backdrop className={styles.modalBackdrop} />
        <Dialog.Positioner className={styles.modalPositioner}>
          <Dialog.Content className={styles.modalContent}>
            <Dialog.Header className={styles.modalHeader}>
              <Dialog.Title className={styles.modalTitle}>แก้ไขข้อมูลผู้ใช้</Dialog.Title>
              <Dialog.CloseTrigger className={styles.modalClose} />
            </Dialog.Header>
            <Dialog.Body className={styles.modalBody}>
              <Flex direction="column" gap={4}>
                <Field.Root><Field.Label className={styles.fieldLabel}>ชื่อ</Field.Label><Input className={styles.fieldInput} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field.Root>
                <Field.Root><Field.Label className={styles.fieldLabel}>สถานะ</Field.Label><NativeSelect.Root><NativeSelect.Field className={styles.fieldInput} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserStatus })}><option value="active">ใช้งาน</option><option value="inactive">ไม่ใช้งาน</option><option value="banned">ถูกระงับ</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root></Field.Root>
                {userType === 'admin' && <><Field.Root><Field.Label className={styles.fieldLabel}>บทบาท</Field.Label><Input className={styles.fieldInput} value={form.role ?? ''} onChange={(event) => setForm({ ...form, role: event.target.value })} /></Field.Root>{!(selectedUser as AdminItem)?.isOwner && <Field.Root><Field.Label className={styles.fieldLabel}>เมนูที่เห็น</Field.Label><div className={styles.permissionGrid}>{Object.entries(permissionLabels).map(([key, label]) => <label className={styles.permissionOption} key={key}><input type="checkbox" checked={form.permissions?.includes(key) ?? false} onChange={(event) => setForm({ ...form, permissions: event.target.checked ? [...(form.permissions ?? []), key] : (form.permissions ?? []).filter((permission) => permission !== key) })} /><span>{label}</span></label>)}</div></Field.Root>}</>}
              </Flex>
            </Dialog.Body>
            <Dialog.Footer className={styles.modalFooter}>
              <Button className={styles.dialogGhostButton} onClick={handleClose}>ยกเลิก</Button>
              <Button className={styles.dialogPrimaryButton} onClick={handleSave}>บันทึก</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
