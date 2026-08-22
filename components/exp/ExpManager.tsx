'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { expActionLabel, FREE_WEEK_MAX } from '@/lib/exp-rules'
import { toaster } from '@/lib/toaster'
import styles from './ExpManager.module.css'

type Account = {
  id: string
  userId: string
  balance: number
  level: number
  levelName: string
  user: { id: string; name: string; email: string; joinedAt: string }
}
type Entry = {
  id: string
  userId: string
  amount: number
  action: string
  source: string
  reason?: string
  status: string
  createdAt: string
  user: { name: string }
}
type Alert = {
  type: string
  severity: 'critical' | 'warning'
  userId: string
  userName: string
  rule: string
  detail: string
  breakdown?: string
}
type BaseData = {
  summary: { totalUsers: number; grantedToday: number; levelupsToday: number; pendingReviews: number }
  details: {
    expByAction: { action: string; label: string; amount: number; percent: number }[]
    topRecipients: { userId: string; userName: string; amount: number }[]
    levelups: Entry[]
    pending: Entry[]
  }
  accounts: Account[]
  alerts: Alert[]
}
type MemberData = {
  account: Account & {
    progress: {
      level: number
      name: string
      minExp: number
      percent: number
      next: { level: number; name: string; minExp: number } | null
    }
  }
  weeklyCaps: { action: string; label: string; used: number; cap: number }[]
  voteFanWorks: { workId: string; title: string; freeVotes: number; monthlyVotes: number; coins: number; fanPoints: number }[]
  ledger: Entry[]
}
type Detail = 'exp' | 'level' | 'pending' | null
type LedgerFilter = 'all' | 'pending' | 'granted' | 'bad'

const PAGE_SIZE = 20
const statusLabel: Record<string, string> = {
  granted: 'ได้แล้ว', pending: 'รอตรวจ', rejected: 'ไม่ผ่าน', denied: 'ไม่ผ่าน', revoked: 'ถูกริบ', info: 'ระบบ',
}
const avatarPalette = [
  ['#d6f4ec', '#0e8e80'], ['#fce7f3', '#be185d'], ['#ede9fe', '#6d28d9'],
  ['#ffedd5', '#c2410c'], ['#dbeafe', '#1d4ed8'], ['#ecfccb', '#4d7c0f'],
]

function dateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
}
function dateOnly(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(date)
}
function avatarStyle(seed: string) {
  let hash = 0
  for (const char of seed) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  const [backgroundColor, color] = avatarPalette[Math.abs(hash) % avatarPalette.length]
  return { backgroundColor, color }
}
function entryTitle(entry: Entry) {
  return entry.action === '_levelup' ? entry.reason || 'เลื่อนระดับ' : expActionLabel(entry.action)
}

export function ExpManager() {
  const [data, setData] = useState<BaseData | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [member, setMember] = useState<MemberData | null>(null)
  const [detail, setDetail] = useState<Detail>(null)
  const [guide, setGuide] = useState(false)
  const [alertsAll, setAlertsAll] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [memberLoading, setMemberLoading] = useState(false)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const membersRef = useRef<HTMLDivElement>(null)

  const loadBase = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/exp', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      setData(await response.json() as BaseData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMember = useCallback(async (userId: string) => {
    setMemberLoading(true)
    try {
      const response = await fetch(`/api/exp/members/${encodeURIComponent(userId)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      setMember(await response.json() as MemberData)
    } catch {
      setMember(null)
      toaster.error({ title: 'โหลดสมุดบัญชีไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setMemberLoading(false)
    }
  }, [])

  // Fetching the EXP snapshot is the external synchronization owned here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadBase() }, [loadBase])

  async function selectMember(userId: string, scroll = false) {
    setSelected(userId)
    setLedgerFilter('all')
    setActionFilter('all')
    await loadMember(userId)
    if (scroll) membersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function refreshAll() {
    await loadBase()
    if (selected) await loadMember(selected)
  }

  async function decide(id: string, decision: 'approve' | 'reject' | 'revoke') {
    setBusyId(id)
    try {
      const response = await fetch('/api/exp', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, decision }),
      })
      if (!response.ok) throw new Error()
      toaster.success({ title: 'อัปเดตรายการแล้ว' })
      await refreshAll()
    } catch {
      toaster.error({ title: 'ดำเนินการไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setBusyId(null)
    }
  }

  async function revokeVotes(work: MemberData['voteFanWorks'][number]) {
    if (!selected) return
    const confirmed = window.confirm(`ริบโหวต/แต้มของบัญชีนี้ในเรื่อง “${work.title}” ทั้งหมด?\n\nตั๋วแนะนำ ${work.freeVotes.toLocaleString()} ใบ · ตั๋วเดือน ${work.monthlyVotes.toLocaleString()} ใบ · เงินนับแต้ม ${work.coins.toLocaleString()} เหรียญ\nรวมหักแต้มแฟน ${work.fanPoints.toLocaleString()} แต้ม`)
    if (!confirmed) return
    setBusyId(`vote-${work.workId}`)
    try {
      const response = await fetch('/api/exp/vote-revocations', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: selected, workId: work.workId }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error)
      toaster.success({ title: 'ริบโหวตและแต้มแฟนแล้ว' })
      await loadMember(selected)
    } catch (caught) {
      toaster.error({ title: 'ริบโหวต/แต้มไม่สำเร็จ', description: caught instanceof Error && caught.message ? caught.message : 'กรุณาลองใหม่' })
    } finally {
      setBusyId(null)
    }
  }

  const filteredAccounts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.accounts ?? []).filter((account) => !needle || `${account.user.name} ${account.user.email}`.toLowerCase().includes(needle))
  }, [data, query])
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE))
  const visibleAccounts = filteredAccounts.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, Math.min(page, totalPages) * PAGE_SIZE)
  const actions = useMemo(() => [...new Set((member?.ledger ?? []).filter((entry) => entry.action !== '_levelup').map((entry) => entry.action))], [member])
  const ledgerRows = useMemo(() => (member?.ledger ?? []).filter((entry) => {
    if (ledgerFilter === 'pending' && entry.status !== 'pending') return false
    if (ledgerFilter === 'granted' && entry.status !== 'granted') return false
    if (ledgerFilter === 'bad' && !['rejected', 'denied', 'revoked'].includes(entry.status)) return false
    return actionFilter === 'all' || entry.action === actionFilter
  }), [member, ledgerFilter, actionFilter])
  const shownAlerts = alertsAll ? data?.alerts ?? [] : (data?.alerts ?? []).slice(0, 8)

  const cards: { key: Detail | 'users'; label: string; value: number; sub: string }[] = [
    { key: 'users', label: 'สมาชิกในระบบ EXP', value: data?.summary.totalUsers ?? 0, sub: 'บัญชีที่สมัครผ่านหน้าเว็บ' },
    { key: 'exp', label: 'EXP ที่แจกวันนี้', value: data?.summary.grantedToday ?? 0, sub: 'เฉพาะแต้มที่ได้รับจริง' },
    { key: 'level', label: 'เลื่อนระดับวันนี้', value: data?.summary.levelupsToday ?? 0, sub: 'จำนวนครั้งที่มีคนอัปเลเวล' },
    { key: 'pending', label: 'รีวิวรอตรวจ', value: data?.summary.pendingReviews ?? 0, sub: 'คิวรอแอดมินตรวจ' },
  ]

  function cardClick(key: Detail | 'users') {
    if (key === 'users') {
      setDetail(null)
      membersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => searchRef.current?.focus(), 450)
      return
    }
    setDetail((current) => current === key ? null : key)
  }

  return <div className={styles.exp}>
    <header className={styles.pageHead}>
      <h1>ระบบ EXP <button type="button" onClick={() => void refreshAll()} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรชข้อมูล'}</button></h1>
      <p>แต้มสะสมและเลเวลสมาชิก สรุปสุขภาพระบบ สัญญาณเตือน คิวรีวิวรอตรวจ และสมุดบัญชีรายคน</p>
    </header>
    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลได้ <button type="button" onClick={() => void loadBase()}>ลองใหม่</button></div>}

    <div className={styles.cards}>{cards.map((card) => <button type="button" key={card.key} className={`${styles.card} ${detail === card.key ? styles.cardOn : ''}`} onClick={() => cardClick(card.key)}>
      <span>{card.label}</span><strong className={card.key === 'pending' ? styles.amber : ''}>{card.value.toLocaleString()}</strong>
      <small>{card.sub}<b>{card.key === 'users' ? ' · กดเพื่อไปที่ตารางรายคน ›' : detail === card.key ? ' · กดอีกครั้งเพื่อปิด' : ' · กดดูรายละเอียด ›'}</b></small>
    </button>)}</div>

    {detail && <section className={`${styles.panel} ${styles.detailPanel}`}>
      {detail === 'exp' && <>
        <h2>EXP วันนี้แยกตามหมวด (รวม {(data?.summary.grantedToday ?? 0).toLocaleString()})</h2>
        {data?.details.expByAction.length ? data.details.expByAction.map((item) => <div className={styles.detailBar} key={item.action}><span>{item.label}</span><i><b style={{ width: `${item.percent}%` }} /></i><strong>{item.amount.toLocaleString()} ({item.percent}%)</strong></div>) : <div className={styles.empty}>วันนี้ยังไม่มีการแจกแต้ม</div>}
        {!!data?.details.topRecipients.length && <><h2>รับแต้มสูงสุดวันนี้</h2>{data.details.topRecipients.map((item) => <div className={styles.detailRow} key={item.userId}><span /><button type="button" onClick={() => void selectMember(item.userId, true)}>{item.userName}</button><em /><strong>+{item.amount.toLocaleString()}</strong></div>)}</>}
      </>}
      {detail === 'level' && <><h2>การเลื่อนระดับวันนี้ (กดชื่อเพื่อเปิดสมุด)</h2>{data?.details.levelups.length ? data.details.levelups.map((entry) => <div className={styles.detailRow} key={entry.id}><time>{dateTime(entry.createdAt)}</time><button type="button" onClick={() => void selectMember(entry.userId, true)}>{entry.user.name}</button><em>{entry.reason || 'เลื่อนระดับ'}</em></div>) : <div className={styles.empty}>วันนี้ยังไม่มีใครเลื่อนระดับ</div>}</>}
      {detail === 'pending' && <><h2>คิวรีวิวรอตรวจ {data?.details.pending.length ?? 0} รายการ (เรียงเก่าสุดก่อน อนุมัติได้จากตรงนี้เลย)</h2>{data?.details.pending.length ? data.details.pending.map((entry) => <div className={styles.detailRow} key={entry.id}><time>{dateTime(entry.createdAt)}</time><button type="button" onClick={() => void selectMember(entry.userId, true)}>{entry.user.name}</button><em>{entry.reason || entry.source}</em><strong>+{entry.amount.toLocaleString()}</strong><span className={styles.detailActions}><button type="button" disabled={busyId === entry.id} onClick={() => void decide(entry.id, 'approve')}>อนุมัติ</button><button type="button" disabled={busyId === entry.id} onClick={() => void decide(entry.id, 'reject')}>ไม่ผ่าน</button></span></div>) : <div className={styles.empty}>ไม่มีรีวิวค้างตรวจ เยี่ยมมาก</div>}</>}
    </section>}

    <div className={styles.sectionTitle}>สัญญาณเตือน <span>{data?.alerts.length ?? 0}</span><button type="button" onClick={() => setGuide((value) => !value)}>📖 คู่มือสำหรับผู้ตรวจ</button></div>
    {guide && <section className={`${styles.panel} ${styles.guide}`}>{[
      ['critical', 'แดง · จัดการ', 'บัญชีไม่ลงตัว', 'ยอดแต้มบนบัญชีไม่เท่ากับผลบวกจากสมุดรายบรรทัด ทุกแต้มที่ถูกกติกาต้องมีบันทึกเสมอ', 'กดชื่อท้ายการ์ดเพื่อเปิดสมุด ไล่ดูว่ารายการรวมได้เท่าไหร่ ถ้าหาที่มาไม่ได้ให้แจ้งผู้พัฒนาทันที'],
      ['critical', 'แดง · จัดการ', 'แต้มสายฟรีทะลุเพดานที่เป็นไปได้', `กิจกรรมฟรีทุกหมวดรวมกันได้สูงสุด ${FREE_WEEK_MAX.toLocaleString()} EXP ต่อสัปดาห์ ถ้าใครได้จากสายฟรีเกินนี้แปลว่ามีรูรั่วหรือโกง`, 'เปิดสมุด ริบคืนรายการที่ผิดปกติ และส่งเรื่องเข้าระบบบทลงโทษหากทำซ้ำ'],
      ['warning', 'เหลือง · เฝ้าดู', 'แต้มพุ่งเร็วผิดปกติ', 'ได้เกิน 1,000 EXP ใน 24 ชั่วโมง ก้อนใหญ่อาจมาจากการใช้จ่ายจริง', 'อ่านที่มาของแต้มก่อนตัดสิน จ่ายจริงปล่อยผ่านได้ สายฟรีล้วนให้เปิดสมุดตรวจละเอียด'],
      ['warning', 'เหลือง · เฝ้าดู', 'พฤติกรรมคล้ายบอท / บัญชีใหม่แต้มพุ่ง', 'ชนเพดานพร้อมกันตั้งแต่ 3 หมวด หรือบัญชีอายุไม่ถึง 7 วันแต่มีแต้มเกิน 500', 'เฝ้าดูบัญชีใหม่หรือบัญชีที่ชนเพดานหลายหมวด และตรวจซ้ำเมื่อเกิดขึ้นต่อเนื่อง'],
    ].map(([severity, tag, title, text, action]) => <div key={title}><span className={severity === 'critical' ? styles.tagCritical : styles.tagWarning}>{tag}</span><div><b>{title}</b><p>{text}</p><em>ทำอย่างไร: {action}</em></div></div>)}</section>}

    <section className={`${styles.panel} ${styles.alerts}`}>
      {data?.alerts.length ? <>{alertsAll && data.alerts.length > 8 && <button className={styles.alertToggle} type="button" onClick={() => setAlertsAll(false)}>▲ ย่อกลับ แสดงเฉพาะ 8 รายการแรก</button>}{shownAlerts.map((alert, index) => <div className={`${styles.alert} ${alert.severity === 'critical' ? styles.alertCritical : styles.alertWarning}`} key={`${alert.type}-${alert.userId}-${index}`}><span className={styles.signal}>{alert.severity === 'critical' ? '⛔' : '⚠'}</span><div><b>{alert.rule}<i>{alert.severity === 'critical' ? 'ควรจัดการ' : 'น่าเหลือบมอง'}</i></b><p>{alert.detail}</p>{alert.breakdown && <small>{alert.breakdown}</small>}</div><button type="button" onClick={() => void selectMember(alert.userId, true)}>{alert.userName} ›</button></div>)}{!alertsAll && data.alerts.length > 8 && <button className={styles.alertToggle} type="button" onClick={() => setAlertsAll(true)}>▼ ยังมีอีก {data.alerts.length - 8} รายการ กดเพื่อแสดงทั้งหมด (การ์ดแดงถูกจัดขึ้นก่อนเสมอ)</button>}</> : <div className={styles.alertClear}><b>✓</b> ไม่พบความผิดปกติ ระบบกวาดตรวจสมาชิกทุกคนตามกฎเตือน 4 ข้อแล้ว</div>}
    </section>

    <div className={styles.sectionTitle} ref={membersRef}>เจาะดูรายคน</div>
    <div className={styles.memberGrid}>
      <div className={styles.memberList}>
        <input ref={searchRef} className={styles.search} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="ค้นหาชื่อผู้ใช้ หรืออีเมล…" />
        <section className={`${styles.panel} ${styles.tablePanel}`}><div className={styles.tableScroll}><table><colgroup><col /><col className={styles.levelCol} /><col className={styles.expCol} /><col className={styles.dateCol} /></colgroup><thead><tr><th>ผู้ใช้</th><th>ระดับ</th><th>EXP</th><th>สมัครเมื่อ</th></tr></thead><tbody>{visibleAccounts.map((account) => <tr key={account.id} className={selected === account.userId ? styles.selectedRow : ''} onClick={() => void selectMember(account.userId)}><td><span className={styles.avatar} style={avatarStyle(account.userId)}>{account.user.name.charAt(0).toUpperCase() || '?'}</span>{account.user.name}</td><td><i>Lv{account.level}</i>{account.levelName}</td><td>{account.balance.toLocaleString()}</td><td>{dateOnly(account.user.joinedAt)}</td></tr>)}</tbody></table>{!visibleAccounts.length && !loading && <div className={styles.empty}>{data?.accounts.length ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิก สมาชิกที่สมัครจากหน้าเว็บจะขึ้นที่นี่อัตโนมัติ'}</div>}</div><footer className={styles.pager}>{filteredAccounts.length > PAGE_SIZE && <><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹ ก่อนหน้า</button><b>หน้า {Math.min(page, totalPages)} / {totalPages}</b><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>ถัดไป ›</button></>}<span>ทั้งหมด {filteredAccounts.length.toLocaleString()} คน{filteredAccounts.length > PAGE_SIZE ? ` · หน้าละ ${PAGE_SIZE}` : ''}</span></footer></section>
      </div>

      <section className={`${styles.panel} ${styles.memberPanel}`}>
        {memberLoading ? <div className={styles.placeholder}>กำลังโหลดสมุดบัญชี EXP…</div> : member ? <>
          <div className={styles.accountHead}><span className={styles.avatar} style={avatarStyle(member.account.userId)}>{member.account.user.name.charAt(0).toUpperCase() || '?'}</span><div><b>{member.account.user.name}</b><small>{member.account.user.email}</small></div><p><b><i>Lv{member.account.progress.level}</i>{member.account.progress.name}</b><small>{member.account.balance.toLocaleString()} EXP{member.account.progress.next ? ` · อีก ${(member.account.progress.next.minExp - member.account.balance).toLocaleString()} ถึง Lv${member.account.progress.next.level}` : ''}</small></p></div>
          <h3>มิเตอร์เพดานสัปดาห์นี้ (รีเซ็ตทุกวันจันทร์)</h3><div className={styles.meters}>{member.weeklyCaps.map((meter) => { const percent = Math.min(100, Math.round((meter.used / meter.cap) * 100)); return <div key={meter.action}><span>{meter.label}</span><i><b className={percent >= 100 ? styles.meterFull : ''} style={{ width: `${percent}%` }} /></i><em>{meter.used.toLocaleString()} / {meter.cap.toLocaleString()}</em></div> })}</div>
          <h3>โหวต &amp; แต้มแฟนต่อเรื่อง</h3>{member.voteFanWorks.length ? <div className={styles.voteWorks}><p>ริบ = หักคะแนนโหวตออกจากเรื่อง + ล้างแต้มแฟนของบัญชีนี้ในเรื่องนั้น ส่วน EXP ริบแยกรายการได้ที่สมุดบัญชีด้านล่าง</p>{member.voteFanWorks.map((work) => <div key={work.workId}><b title={work.workId}>{work.title}</b><span>แนะนำ {work.freeVotes}</span><span>เดือน {work.monthlyVotes}</span><span>เงิน {work.coins.toLocaleString()}</span><strong>{work.fanPoints.toLocaleString()} แต้ม</strong><button type="button" disabled={busyId === `vote-${work.workId}`} onClick={() => void revokeVotes(work)}>ริบทั้งหมด</button></div>)}</div> : <div className={styles.inlineEmpty}>ยังไม่มีโหวตหรือแต้มแฟนกับเรื่องใด</div>}
          <h3>สมุดบัญชี EXP</h3><div className={styles.chips}>{([['all', 'ทั้งหมด'], ['pending', 'รอตรวจ'], ['granted', 'ได้แล้ว'], ['bad', 'ริบ/ไม่ผ่าน']] as [LedgerFilter, string][]).map(([key, label]) => { const count = key === 'all' ? member.ledger.length : key === 'bad' ? member.ledger.filter((entry) => ['rejected', 'denied', 'revoked'].includes(entry.status)).length : member.ledger.filter((entry) => entry.status === key).length; return <button type="button" key={key} className={ledgerFilter === key ? styles.chipOn : ''} onClick={() => setLedgerFilter(key)}>{label} {count}</button> })}<select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="all">ทุกประเภท</option>{actions.map((action) => <option value={action} key={action}>{expActionLabel(action)}</option>)}</select></div><small className={styles.showing}>แสดง {ledgerRows.length} จาก {member.ledger.length} รายการ</small>
          <div className={styles.ledger}>{ledgerRows.map((entry) => <div key={entry.id}><time>{dateTime(entry.createdAt)}</time><p><b>{entryTitle(entry)}</b>{entry.action !== '_levelup' && (entry.reason || entry.source) && <small>{entry.reason || entry.source}</small>}</p><i className={styles[`status_${entry.status}`]}>{statusLabel[entry.status] ?? entry.status}</i><strong className={entry.status === 'granted' && entry.amount > 0 ? styles.plus : entry.status === 'revoked' ? styles.minus : ''}>{entry.amount > 0 ? entry.status === 'revoked' ? `−${entry.amount}` : `+${entry.amount}` : '—'}</strong><span>{entry.status === 'pending' ? <><button type="button" disabled={busyId === entry.id} onClick={() => void decide(entry.id, 'approve')}>อนุมัติ</button><button type="button" disabled={busyId === entry.id} onClick={() => void decide(entry.id, 'reject')}>ไม่ผ่าน</button></> : entry.status === 'granted' && entry.action !== '_levelup' ? <button type="button" disabled={busyId === entry.id} onClick={() => void decide(entry.id, 'revoke')}>ริบคืน</button> : null}</span></div>)}{!ledgerRows.length && <div className={styles.empty}>ไม่มีรายการตรงตัวกรอง</div>}</div>
        </> : <div className={styles.placeholder}>คลิกที่สมาชิกด้านซ้าย เพื่อกางมิเตอร์เพดาน สมุดบัญชี EXP และจัดการรายการ (อนุมัติ / ไม่ผ่าน / ริบคืน)</div>}
      </section>
    </div>
  </div>
}
