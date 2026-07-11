'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './TicketManager.module.css'

type Row = { id: string; amount: number; type: string; reason: string; referenceId?: string; status: string; createdAt: string; user: { name: string; email: string } }
type Data = { rows: Row[]; stats: { freeToday: number; votesToday: number; monthCreated: number; tipMonth: number } }
type Filter = 'all' | 'daily' | 'vote' | 'spend' | 'earn'

const labels: Record<string, string> = { free: 'แจกตั๋วฟรี', month: 'ได้รับตั๋วเดือน', vote_free: 'โหวตด้วยตั๋วฟรี', vote_month: 'โหวตด้วยตั๋วเดือน', tip: 'ทิปนักเขียน', subscription: 'สมัครอ่าน' }
function dateTime(value: string) { return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) }
function cheeringMessage(reason: string) {
  const quoted = reason.match(/(?:ข้อความเชียร์\s*:\s*)?[“"]([^”"]+)[”"]/)
  return reason.includes('ข้อความเชียร์') ? quoted?.[1] ?? reason.replace(/^.*ข้อความเชียร์\s*:\s*/, '') : null
}

export function TicketManager() {
  const [data, setData] = useState<Data | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try { const response = await fetch('/api/tickets'); if (!response.ok) throw new Error(); setData(await response.json()) }
    catch { setError(true) }
    finally { setLoading(false) }
  }, [])
  // Fetching the ticket ledger is the external synchronization owned here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => (data?.rows ?? []).filter((row) => {
    if (filter === 'daily') return row.type === 'free'
    if (filter === 'vote') return ['vote_free', 'vote_month'].includes(row.type)
    if (filter === 'spend') return ['tip', 'subscription'].includes(row.type)
    if (filter === 'earn') return row.type === 'month' && row.amount > 0
    return true
  }), [data, filter])
  const messages = useMemo(() => (data?.rows ?? []).filter((row) => row.type === 'tip').map((row) => ({ row, message: cheeringMessage(row.reason) })).filter((item): item is { row: Row; message: string } => !!item.message).slice(0, 5), [data])
  const cards = [
    ['ตั๋วโหวตฟรีแจกวันนี้', data?.stats.freeToday ?? 0, 'แจกอัตโนมัติตามเลเวลสมาชิก'],
    ['โหวตวันนี้ (ทุกชนิด)', data?.stats.votesToday ?? 0, 'ตั๋วฟรี + ตั๋วเดือนที่ถูกใช้'],
    ['ตั๋วเดือนที่เกิดเดือนนี้', data?.stats.monthCreated ?? 0, 'จากยอดสมัครอ่านสะสม + ทิป'],
    ['ยอดทิปเดือนนี้ (เหรียญ)', data?.stats.tipMonth ?? 0, 'รวมทุกเรื่องทั้งเว็บ'],
  ]
  const chips: { key: Filter; label: string }[] = [{ key: 'all', label: 'ทั้งหมด' }, { key: 'daily', label: 'แจกรายวัน' }, { key: 'vote', label: 'โหวต' }, { key: 'spend', label: 'ใช้จ่าย (อ่าน/ทิป)' }, { key: 'earn', label: 'ได้ตั๋วเดือน' }]

  return <div className={styles.tickets}>
    <header className={styles.pageHead}><h1>สมุดตั๋วโหวต · ทิป</h1><p>ทุกธุรกรรมตั๋วและการใช้จ่ายทั้งเว็บ ดึงสดจากสมุดจริง</p></header>
    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลได้ <button type="button" onClick={() => void load()}>ลองใหม่</button></div>}
    <div className={styles.cards}>{cards.map(([label, value, sub]) => <article className={styles.card} key={String(label)}><span>{label}</span><strong>{Number(value).toLocaleString()}</strong><small>{sub}</small></article>)}</div>
    <section className={styles.panel}><div className={styles.panelHead}><div className={styles.chips}>{chips.map((chip) => <button type="button" className={filter === chip.key ? styles.active : ''} key={chip.key} onClick={() => setFilter(chip.key)}>{chip.label}</button>)}</div><span>{loading ? 'กำลังโหลด...' : `${rows.length.toLocaleString()} รายการ`}</span></div><div className={styles.tableWrap}><table><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>รายการ</th><th>เรื่อง</th><th>จำนวน</th></tr></thead><tbody>{rows.map((row) => {
      const spending = ['tip', 'subscription'].includes(row.type)
      const amount = spending ? `−${Math.abs(row.amount).toLocaleString()} เหรียญ` : `${row.amount > 0 ? '+' : ''}${row.amount.toLocaleString()} ใบ`
      return <tr key={row.id}><td>{dateTime(row.createdAt)}</td><td><div className={styles.user}><span>{row.user.name.charAt(0) || '?'}</span><p><b>{row.user.name}</b><small>{row.user.email}</small></p></div></td><td><b>{labels[row.type] ?? row.type}</b><small>{row.reason}</small></td><td>{row.referenceId ?? '–'}</td><td className={row.amount >= 0 && !spending ? styles.positive : styles.negative}>{amount}</td></tr>
    })}{!rows.length && !loading && <tr><td colSpan={5} className={styles.empty}>ยังไม่มีรายการในหมวดนี้</td></tr>}</tbody></table></div></section>
    <section className={styles.panel}><h2>💬 ข้อความเชียร์ล่าสุด</h2><div className={styles.messages}>{messages.length ? messages.map(({ row, message }) => <blockquote key={row.id}>“{message}”<small>— {row.user.name} · {Math.abs(row.amount).toLocaleString()} เหรียญ · {dateTime(row.createdAt)}</small></blockquote>) : <div className={styles.noMessages}>ยังไม่มีข้อความเชียร์</div>}</div></section>
  </div>
}
