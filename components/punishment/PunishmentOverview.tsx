'use client'

import { Dialog } from '@chakra-ui/react'
import { useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './PunishmentOverview.module.css'

type Level = { id: string; level: number; name: string; threshold: number; duration: number }
type User = { id: string; name: string; email: string }
type RecordRow = { id: string; userId: string; user: Omit<User, 'id'>; levelName: string; date: string; note: string | null; status: string; expiresAt: string | null }

function thaiDate(value: string) { return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }) }
function isWarning(row: RecordRow, levels: Level[]) { return (levels.find((level) => level.name === row.levelName)?.level ?? 99) === 1 }
function remainingDays(expiresAt: string | null) { return expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)) : null }

export function PunishmentOverview({ initialRecords, levels, users }: { initialRecords: RecordRow[]; levels: Level[]; users: User[] }) {
  const [records, setRecords] = useState(initialRecords)
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState<RecordRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<RecordRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [levelId, setLevelId] = useState(levels[0]?.id ?? '')
  const [offense, setOffense] = useState('')

  async function addPunishment() {
    if (!userId || !levelId || !offense.trim()) return
    setBusy(true)
    try {
      const response = await fetch('/api/punishment/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, levelId, note: offense.trim() }) })
      if (!response.ok) throw new Error()
      const created = await response.json() as RecordRow
      setRecords((rows) => [created, ...rows])
      setAdding(false)
      setOffense('')
      toaster.success({ title: 'เพิ่มบทลงโทษแล้ว', description: created.user.name })
    } catch { toaster.error({ title: 'เพิ่มบทลงโทษไม่สำเร็จ', description: 'กรุณาตรวจสอบข้อมูลแล้วลองใหม่' }) }
    finally { setBusy(false) }
  }

  async function cancelPunishment() {
    if (!cancelTarget) return
    setBusy(true)
    try {
      const response = await fetch('/api/punishment/records', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: cancelTarget.id, status: 'cancelled' }) })
      if (!response.ok) throw new Error()
      setRecords((rows) => rows.map((row) => row.id === cancelTarget.id ? { ...row, status: 'cancelled' } : row))
      toaster.success({ title: 'ยกเลิกโทษแล้ว', description: cancelTarget.user.name })
      setCancelTarget(null)
    } catch { toaster.error({ title: 'ยกเลิกโทษไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' }) }
    finally { setBusy(false) }
  }

  function closeAdd() { if (!busy) { setAdding(false); setOffense('') } }

  return <div className={styles.punishment}>
    <header className={styles.pageHead}><h1>บทลงโทษ</h1><p>ประวัติการลงโทษผู้ใช้ที่ทำผิดกฎของเว็บ</p></header>
    <section className={styles.panel}>
      <div className={styles.panelHead}><h2>รายการบทลงโทษ</h2><button type="button" className={styles.primary} onClick={() => setAdding(true)}><span aria-hidden="true">＋</span>เพิ่มบทลงโทษ</button></div>
      <div className={styles.tableWrap}><table><thead><tr><th>ผู้ใช้</th><th>ความผิด</th><th>บทลงโทษ</th><th>วันที่</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
        {records.map((row) => {
          const warning = isWarning(row, levels)
          const days = remainingDays(row.expiresAt)
          const active = row.status === 'active'
          const expired = active && days !== null && days === 0
          const punishmentClass = warning ? styles.gray : row.expiresAt ? styles.amber : styles.red
          const statusLabel = row.status === 'cancelled' ? 'ยกเลิกแล้ว' : expired ? 'สิ้นสุดแล้ว' : warning ? 'บันทึกไว้' : days !== null ? `เหลือ ${days} วัน` : 'กำลังบังคับใช้'
          const statusClass = row.status === 'cancelled' || expired ? styles.gray : warning ? styles.green : row.expiresAt ? styles.amber : styles.red
          return <tr key={row.id}><td><div className={styles.user}><span>{row.user.name.trim().charAt(0) || '@'}</span><div><b>{row.user.name}</b><small>{row.user.email}</small></div></div></td><td>{row.note || '—'}</td><td><i className={`${styles.badge} ${punishmentClass}`}>{row.levelName}</i></td><td>{thaiDate(row.date)}</td><td><i className={`${styles.badge} ${statusClass}`}>{statusLabel}</i></td><td><div className={styles.actions}>{active && !warning && !expired ? <button type="button" onClick={() => setCancelTarget(row)}>ยกเลิกโทษ</button> : <button type="button" onClick={() => setDetail(row)}>ดูรายละเอียด</button>}</div></td></tr>
        })}
        {!records.length && <tr><td colSpan={6} className={styles.empty}>ยังไม่มีรายการบทลงโทษ</td></tr>}
      </tbody></table></div>
    </section>

    <Dialog.Root open={adding} onOpenChange={(event) => { if (!event.open) closeAdd() }}><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={styles.dialog}><Dialog.Header><Dialog.Title>เพิ่มบทลงโทษ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header><Dialog.Body><div className={styles.form}>
      <label>ผู้ใช้<select value={userId} onChange={(event) => setUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>
      <label>บทลงโทษ<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>ระดับ {level.level} · {level.name}{level.duration ? ` (${level.duration} วัน)` : ''}</option>)}</select></label>
      <label>ความผิด<textarea value={offense} onChange={(event) => setOffense(event.target.value)} placeholder="ระบุรายละเอียดความผิด" /></label>
      {(!users.length || !levels.length) && <p className={styles.formError}>ต้องมีผู้ใช้และระดับบทลงโทษอย่างน้อยหนึ่งรายการ</p>}
    </div></Dialog.Body><Dialog.Footer><button type="button" className={styles.secondary} disabled={busy} onClick={closeAdd}>ยกเลิก</button><button type="button" className={styles.primary} disabled={busy || !userId || !levelId || !offense.trim()} onClick={addPunishment}>{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root>

    <Dialog.Root open={!!cancelTarget} onOpenChange={(event) => { if (!event.open && !busy) setCancelTarget(null) }}><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={styles.dialog}><Dialog.Header><Dialog.Title>ยืนยันการยกเลิกโทษ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header><Dialog.Body><p>ต้องการยกเลิก <b>{cancelTarget?.levelName}</b> ของ <b>{cancelTarget?.user.name}</b> ใช่หรือไม่?</p></Dialog.Body><Dialog.Footer><button type="button" className={styles.secondary} disabled={busy} onClick={() => setCancelTarget(null)}>ปิด</button><button type="button" className={styles.danger} disabled={busy} onClick={cancelPunishment}>{busy ? 'กำลังบันทึก...' : 'ยืนยันยกเลิกโทษ'}</button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root>

    <Dialog.Root open={!!detail} onOpenChange={(event) => { if (!event.open) setDetail(null) }}><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={styles.dialog}><Dialog.Header><Dialog.Title>รายละเอียดบทลงโทษ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header><Dialog.Body>{detail && <div className={styles.details}><div><span>ผู้ใช้</span><b>{detail.user.name}</b></div><div><span>ความผิด</span><b>{detail.note || '—'}</b></div><div><span>บทลงโทษ</span><b>{detail.levelName}</b></div><div><span>วันที่</span><b>{thaiDate(detail.date)}</b></div></div>}</Dialog.Body><Dialog.Footer><button type="button" className={styles.secondary} onClick={() => setDetail(null)}>ปิด</button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root>
  </div>
}
