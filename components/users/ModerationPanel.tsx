'use client'

import { useCallback, useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './UsersPanel.module.css'

type Queue = {
  id: string
  title: string
  creatorName: string
  reason: string
  chapter?: string
  status: string
  submittedAt: string
}

type Blacklist = { id: string; term: string }

function formatThaiDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function ModerationPanel() {
  const [queue, setQueue] = useState<Queue[]>([])
  const [blacklist, setBlacklist] = useState<Blacklist[]>([])
  const [term, setTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/moderation')
      if (!response.ok) throw new Error('Unable to load moderation queue')
      const data = await response.json()
      setQueue(data.queue ?? [])
      setBlacklist(data.blacklist ?? [])
    } catch {
      setError('โหลดคิวตรวจเนื้อหาไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // The callback performs the initial synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function decide(id: string, decision: string) {
    const response = await fetch('/api/moderation', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, decision }),
    })
    if (!response.ok) {
      toaster.error({ title: 'อัปเดตคิวไม่สำเร็จ' })
      return
    }
    toaster.success({ title: 'อัปเดตคิวแล้ว' })
    await load()
  }

  async function add() {
    if (!term.trim()) return
    const response = await fetch('/api/moderation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ term }),
    })
    if (!response.ok) {
      toaster.error({ title: 'เพิ่มรายการเฝ้าระวังไม่สำเร็จ' })
      return
    }
    setTerm('')
    await load()
  }

  async function remove(id: string) {
    const response = await fetch(`/api/moderation?blacklistId=${id}`, { method: 'DELETE' })
    if (!response.ok) {
      toaster.error({ title: 'ลบรายการเฝ้าระวังไม่สำเร็จ' })
      return
    }
    await load()
  }

  const pending = queue.filter((item) => item.status === 'pending')

  return (
    <section className={styles.moderationPanel} aria-label="คิวตรวจเนื้อหา">
      <div className={styles.moderationHeader}>
        <h2 className={styles.moderationTitle}>
          🚨 เรื่องถูกระบบคัดกรองดักไว้
          <span className={styles.moderationCount}>{pending.length}</span>
        </h2>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.smallButton} onClick={() => void load()}>ลองใหม่</button>
        </div>
      )}

      {isLoading ? <div className={styles.tableState}>กำลังโหลดคิวตรวจเนื้อหา…</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>เรื่อง</th><th>นักเขียน</th><th>เหตุที่ระบบดัก</th><th>ตอน</th><th>ส่งเมื่อ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {pending.map((item) => (
                <tr key={item.id}>
                  <td className={styles.userName}>{item.title}</td>
                  <td>{item.creatorName}</td>
                  <td className={styles.reasonCell}>{item.reason}</td>
                  <td>{item.chapter ?? '—'}</td>
                  <td className={styles.mutedCell}>{formatThaiDate(item.submittedAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={`${styles.smallButton} ${styles.successButton}`} onClick={() => void decide(item.id, 'approved')}>อนุมัติ</button>
                      <button type="button" className={`${styles.smallButton} ${styles.dangerButton}`} onClick={() => void decide(item.id, 'rejected')}>ปฏิเสธ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length === 0 && <div className={styles.tableState}>ไม่มีเรื่องรอตรวจ</div>}
        </div>
      )}

      <div className={styles.blacklistRow}>
        <span className={styles.blacklistLabel}>🛡️ รายการเฝ้าระวังลิขสิทธิ์:</span>
        <input className={styles.blacklistInput} placeholder="ชื่อเรื่อง / IP / คำที่ต้องบล็อก" value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void add() }} />
        <button type="button" className={styles.smallButton} onClick={() => void add()}>+ เพิ่ม</button>
        {blacklist.map((item) => <button type="button" className={styles.blacklistChip} key={item.id} onClick={() => void remove(item.id)} title="ลบรายการ">{item.term} ×</button>)}
      </div>
    </section>
  )
}
