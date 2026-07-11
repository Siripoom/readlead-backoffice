'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './ExpManager.module.css'

type Account = { id: string; userId: string; balance: number; level: number; user: { id: string; name: string; email: string; joinedAt: string } }
type Entry = { id: string; userId: string; amount: number; action: string; source: string; reason?: string; status: string; createdAt: string; user: { name: string } }
type Alert = { type: string; userId: string; userName: string; detail: string }
type Data = { accounts: Account[]; pending: Entry[]; ledger: Entry[]; alerts: Alert[]; grantedToday: number; levelupsToday: number }
type Detail = 'exp' | 'level' | 'pending' | null

const statusLabel: Record<string, string> = { granted: 'ได้แล้ว', pending: 'รอตรวจ', rejected: 'ไม่ผ่าน', revoked: 'ถูกริบ', info: 'ระบบ' }
function dateTime(value: string) { return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) }
function dateOnly(value: string) { return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' }) }

export function ExpManager() {
  const [data, setData] = useState<Data | null>(null)
  const [selected, setSelected] = useState('')
  const [filter, setFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<Detail>(null)
  const [guide, setGuide] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const response = await fetch('/api/exp')
      if (!response.ok) throw new Error()
      const result = await response.json() as Data
      setData(result); setSelected((current) => current || result.accounts[0]?.userId || '')
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])
  // Fetching the EXP snapshot is the external synchronization owned here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  async function decide(id: string, decision: 'approve' | 'reject' | 'revoke') {
    setBusyId(id)
    try {
      const response = await fetch('/api/exp', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, decision }) })
      if (!response.ok) throw new Error()
      toaster.success({ title: 'อัปเดตรายการแล้ว' }); await load()
    } catch { toaster.error({ title: 'ดำเนินการไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' }) }
    finally { setBusyId(null) }
  }

  const account = data?.accounts.find((item) => item.userId === selected)
  const accounts = useMemo(() => data?.accounts.filter((item) => `${item.user.name} ${item.user.email}`.toLowerCase().includes(query.toLowerCase())) ?? [], [data, query])
  const accountLedger = useMemo(() => data?.ledger.filter((entry) => entry.userId === selected) ?? [], [data, selected])
  const actions = useMemo(() => [...new Set(accountLedger.map((entry) => entry.action))], [accountLedger])
  const rows = useMemo(() => accountLedger.filter((entry) => {
    if (filter === 'bad' && !['rejected', 'revoked'].includes(entry.status)) return false
    if (!['all', 'bad'].includes(filter) && entry.status !== filter) return false
    return actionFilter === 'all' || entry.action === actionFilter
  }), [accountLedger, filter, actionFilter])
  const today = new Date().toDateString()
  const todayGranted = data?.ledger.filter((entry) => entry.status === 'granted' && entry.amount > 0 && new Date(entry.createdAt).toDateString() === today) ?? []
  const todayLevelups = data?.ledger.filter((entry) => entry.action === '_levelup' && new Date(entry.createdAt).toDateString() === today) ?? []
  const detailRows = detail === 'exp' ? todayGranted : detail === 'level' ? todayLevelups : detail === 'pending' ? data?.pending ?? [] : []
  const cards = [
    { key: null, label: 'สมาชิกในระบบ EXP', value: data?.accounts.length ?? 0, sub: 'บัญชีที่สมัครผ่านหน้าเว็บ' },
    { key: 'exp' as const, label: 'EXP ที่แจกวันนี้', value: data?.grantedToday ?? 0, sub: 'เฉพาะแต้มที่ได้รับจริง' },
    { key: 'level' as const, label: 'เลื่อนระดับวันนี้', value: data?.levelupsToday ?? 0, sub: 'จำนวนครั้งที่มีคนอัปเลเวล' },
    { key: 'pending' as const, label: 'รีวิวรอตรวจ', value: data?.pending.length ?? 0, sub: 'คิวรอแอดมินตรวจ' },
  ]

  return <div className={styles.exp}>
    <header className={styles.pageHead}><div><h1>ระบบ EXP <button type="button" onClick={() => void load()} disabled={loading}>รีเฟรชข้อมูล</button></h1><p>แต้มสะสมและเลเวลสมาชิก — สรุปสุขภาพระบบ สัญญาณเตือน คิวรีวิวรอตรวจ และสมุดบัญชีรายคน</p></div></header>
    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลได้ <button type="button" onClick={() => void load()}>ลองใหม่</button></div>}
    <div className={styles.cards}>{cards.map((card) => <button type="button" key={card.label} className={`${styles.card} ${detail === card.key && card.key ? styles.selectedCard : ''}`} onClick={() => card.key ? setDetail((current) => current === card.key ? null : card.key) : document.getElementById('exp-members')?.scrollIntoView({ behavior: 'smooth' })}><span>{card.label}</span><strong className={card.key === 'pending' ? styles.pendingValue : ''}>{card.value.toLocaleString()}</strong><small>{card.sub}</small></button>)}</div>

    {detail && <section className={styles.detailPanel}><h2>{detail === 'exp' ? `EXP วันนี้ (${(data?.grantedToday ?? 0).toLocaleString()})` : detail === 'level' ? 'การเลื่อนระดับวันนี้' : `คิวรีวิวรอตรวจ ${data?.pending.length ?? 0} รายการ`}</h2>{detailRows.length ? detailRows.map((entry) => <div className={styles.detailRow} key={entry.id}><time>{dateTime(entry.createdAt)}</time><button type="button" onClick={() => setSelected(entry.userId)}>{entry.user.name}</button><span>{entry.reason || entry.action}</span><b>{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()}</b>{entry.status === 'pending' && <div><button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'approve')}>อนุมัติ</button><button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'reject')}>ไม่ผ่าน</button></div>}</div>) : <div className={styles.empty}>ยังไม่มีรายการ</div>}</section>}

    <div className={styles.sectionTitle}>สัญญาณเตือน <span>{data?.alerts.length ?? 0}</span><button type="button" onClick={() => setGuide((value) => !value)}>📖 คู่มือสำหรับผู้ตรวจ</button></div>
    {guide && <section className={styles.guide}>{[
      ['แดง · จัดการ', 'บัญชีไม่ลงตัว', 'ยอดแต้มบนบัญชีไม่เท่ากับผลบวกจากสมุดรายบรรทัด ควรเปิดสมุดตรวจสอบและแจ้งผู้พัฒนาหากหาที่มาไม่ได้'],
      ['แดง · จัดการ', 'แต้มสายฟรีทะลุเพดาน', 'ตรวจรายการที่ผิดปกติ ริบคืนแต้มที่ไม่ถูกต้อง และส่งเรื่องเข้าระบบบทลงโทษเมื่อทำซ้ำ'],
      ['เหลือง · เฝ้าดู', 'แต้มพุ่งเร็วผิดปกติ', 'ตรวจที่มาของแต้มก่อนตัดสิน หากเกิดจากการใช้จ่ายจริงสามารถปล่อยผ่านได้'],
      ['เหลือง · เฝ้าดู', 'พฤติกรรมคล้ายบอท', 'เฝ้าดูบัญชีใหม่หรือบัญชีที่ชนเพดานหลายหมวด และตรวจซ้ำเมื่อเกิดขึ้นต่อเนื่อง'],
    ].map(([tag, title, text]) => <div key={title}><i className={tag.startsWith('แดง') ? styles.critical : styles.warning}>{tag}</i><p><b>{title}</b><span>{text}</span></p></div>)}</section>}
    <section className={styles.alerts}>{data?.alerts.length ? data.alerts.map((alert) => <div key={`${alert.type}-${alert.userId}`}><span>⛔</span><p><b>บัญชีไม่ลงตัว <i>ควรจัดการ</i></b><small>{alert.detail}</small></p><button type="button" onClick={() => { setSelected(alert.userId); document.getElementById('exp-members')?.scrollIntoView({ behavior: 'smooth' }) }}>{alert.userName} ›</button></div>) : <div className={styles.alertClear}><b>✓</b> ไม่พบความผิดปกติ — ระบบตรวจสมาชิกทุกคนแล้ว</div>}</section>

    <div className={styles.sectionTitle} id="exp-members">เจาะดูรายคน</div>
    <div className={styles.memberGrid}><div className={styles.memberList}><input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อผู้ใช้ หรืออีเมล…" /><div className={styles.tableWrap}><table><thead><tr><th>ผู้ใช้</th><th>ระดับ</th><th>EXP</th><th>สมัครเมื่อ</th></tr></thead><tbody>{accounts.map((item) => <tr key={item.id} className={selected === item.userId ? styles.selectedRow : ''} onClick={() => setSelected(item.userId)}><td><span className={styles.avatar}>{item.user.name.charAt(0)}</span><b>{item.user.name}</b></td><td><i>Lv{item.level}</i></td><td>{item.balance.toLocaleString()}</td><td>{dateOnly(item.user.joinedAt)}</td></tr>)}</tbody></table>{!accounts.length && <div className={styles.empty}>ไม่พบสมาชิก</div>}<footer>ทั้งหมด {accounts.length.toLocaleString()} คน</footer></div></div>
      <section className={styles.ledgerPanel}>{account ? <><div className={styles.accountHead}><span className={styles.avatar}>{account.user.name.charAt(0)}</span><div><b>{account.user.name}</b><small>{account.user.email}</small></div><p><b><i>Lv{account.level}</i></b><small>{account.balance.toLocaleString()} EXP</small></p></div><h3>สมุดบัญชี EXP</h3><div className={styles.filters}><button type="button" className={filter === 'all' ? styles.on : ''} onClick={() => setFilter('all')}>ทั้งหมด {accountLedger.length}</button><button type="button" className={filter === 'pending' ? styles.on : ''} onClick={() => setFilter('pending')}>รอตรวจ {accountLedger.filter((entry) => entry.status === 'pending').length}</button><button type="button" className={filter === 'granted' ? styles.on : ''} onClick={() => setFilter('granted')}>ได้แล้ว {accountLedger.filter((entry) => entry.status === 'granted').length}</button><button type="button" className={filter === 'bad' ? styles.on : ''} onClick={() => setFilter('bad')}>ริบ/ไม่ผ่าน {accountLedger.filter((entry) => ['rejected', 'revoked'].includes(entry.status)).length}</button><select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="all">ทุกประเภท</option>{actions.map((action) => <option key={action}>{action}</option>)}</select></div><small className={styles.showing}>แสดง {rows.length} จาก {accountLedger.length} รายการ</small><div className={styles.ledger}>{rows.map((entry) => <div key={entry.id}><time>{dateTime(entry.createdAt)}</time><p><b>{entry.action}</b><small>{entry.source}{entry.reason ? ` · ${entry.reason}` : ''}</small></p><i className={styles[`status_${entry.status}`]}>{statusLabel[entry.status] ?? entry.status}</i><strong className={entry.amount >= 0 ? styles.plus : styles.minus}>{entry.amount > 0 ? '+' : ''}{entry.amount}</strong><span>{entry.status === 'pending' ? <><button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'approve')}>อนุมัติ</button><button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'reject')}>ไม่ผ่าน</button></> : entry.status === 'granted' && entry.action !== '_levelup' ? <button type="button" disabled={busyId === entry.id} onClick={() => decide(entry.id, 'revoke')}>ริบคืน</button> : null}</span></div>)}{!rows.length && <div className={styles.empty}>ไม่มีรายการตรงตัวกรอง</div>}</div></> : <div className={styles.placeholder}>คลิกที่สมาชิกด้านซ้าย เพื่อกางสมุดบัญชี EXP และจัดการรายการ</div>}</section></div>
  </div>
}
