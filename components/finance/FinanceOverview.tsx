'use client'

import { Dialog } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './FinanceOverview.module.css'

type Status = 'pending' | 'approved' | 'rejected'
type Income = { id: string; month: string; income: number; transactions: number; creators: number }
type Withdrawal = {
  id: string
  creator: string
  bank: string
  bankAccount: string
  amount: number
  amountSatang: number | null
  taxSatang: number | null
  feeSatang: number | null
  netSatang: number | null
  requestedAt: string
  status: Status
  slipUrl: string | null
  reviewerName: string | null
  reviewedAt: string | null
  destination?: { bankName?: string; accountNumber?: string; accountName?: string } | null
  history?: Array<{ status: Status; note: string | null; createdAt: string }>
}

const statusMap: Record<Status, { label: string; className: string }> = {
  pending: { label: 'รออนุมัติ', className: styles.amber },
  approved: { label: 'อนุมัติแล้ว', className: styles.green },
  rejected: { label: 'ปฏิเสธ', className: styles.red },
}

function currency(value: number) { return `฿${Math.round(value).toLocaleString('en-US')}` }
function maskAccount(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? `···${digits.slice(-4)}` : '····'
}
function thaiDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })
}

export function FinanceOverview({ income, initialWithdrawals }: { income: Income[]; initialWithdrawals: Withdrawal[] }) {
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Withdrawal | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [detailBusy, setDetailBusy] = useState(false)

  const stats = useMemo(() => {
    const latest = income.at(-1)
    const previous = income.at(-2)
    const latestIncome = latest?.income ?? 0
    const growth = previous?.income ? (latestIncome - previous.income) / previous.income * 100 : null
    const pending = withdrawals.filter((item) => item.status === 'pending')
    return {
      latest,
      latestIncome,
      growth,
      platformShare: latestIncome * 0.3,
      pendingTotal: pending.reduce((total, item) => total + item.amount, 0),
      pendingCount: pending.length,
    }
  }, [income, withdrawals])

  async function updateStatus(item: Withdrawal, status: Status, note?: string) {
    setBusyId(item.id)
    try {
      const response = await fetch('/api/finance/withdrawals', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, status, note }),
      })
      if (!response.ok) throw new Error('request failed')
      const updated = await response.json() as Withdrawal & { amount: string | number; requestedAt: string; reviewedAt: string | null }
      const normalized: Withdrawal = { ...item, ...updated, amount: Number(updated.amount), status }
      setWithdrawals((rows) => rows.map((row) => row.id === item.id ? normalized : row))
      toaster.success({ title: status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว', description: `${item.creator} ${currency(item.amount)}` })
      return true
    } catch {
      toaster.error({ title: status === 'approved' ? 'อนุมัติไม่สำเร็จ' : 'ปฏิเสธไม่สำเร็จ', description: 'กรุณาลองใหม่อีกครั้ง' })
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return
    const success = await updateStatus(rejectTarget, 'rejected', rejectNote.trim() || undefined)
    if (success) { setRejectTarget(null); setRejectNote('') }
  }

  async function openDetail(item: Withdrawal) {
    setDetailBusy(true)
    try {
      const response = await fetch(`/api/finance/withdrawals?id=${encodeURIComponent(item.id)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('request failed')
      const row = await response.json() as Withdrawal & { amount: string | number }
      setDetail({ ...item, ...row, amount: Number(row.amount) })
    } catch { toaster.error({ title: 'เปิดรายละเอียดบัญชีไม่สำเร็จ' }) }
    finally { setDetailBusy(false) }
  }

  return <div className={styles.finance}>
    <header className={styles.pageHead}>
      <h1>การเงินของเว็บ</h1>
      <p>ภาพรวมรายได้และคำขอถอนเงินของนักเขียน</p>
    </header>

    <div className={styles.cards}>
      <article className={styles.card}><span>รายได้รวมเดือนนี้</span><strong>{currency(stats.latestIncome)}</strong><small className={stats.growth !== null && stats.growth >= 0 ? styles.up : undefined}>{stats.growth === null ? 'ยังไม่มีข้อมูลเดือนก่อน' : `${stats.growth >= 0 ? '▲' : '▼'} ${Math.abs(stats.growth).toFixed(1)}% เทียบเดือนก่อน`}</small></article>
      <article className={styles.card}><span>ยอดขายเหรียญ</span><strong>{currency(stats.latestIncome)}</strong><small>{stats.latest ? `${stats.latest.transactions.toLocaleString()} ธุรกรรม` : 'ยังไม่มีข้อมูล'}</small></article>
      <article className={styles.card}><span>ส่วนแบ่งแพลตฟอร์ม</span><strong>{currency(stats.platformShare)}</strong><small>30% ของยอดขาย · ค่าคำนวณ</small></article>
      <article className={`${styles.card} ${styles.tint}`}><span>รอจ่ายนักเขียน</span><strong>{currency(stats.pendingTotal)}</strong><small>{stats.pendingCount.toLocaleString()} คำขอรออนุมัติ</small></article>
    </div>

    <section className={styles.panel}>
      <h2>คำขอถอนเงินรออนุมัติ</h2>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>นักเขียน</th><th>จำนวน</th><th>ธนาคาร</th><th>วันที่ขอ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>
            {withdrawals.map((item) => <tr key={item.id}>
              <td><div className={styles.creator}><span className={styles.avatar}>{item.creator.trim().charAt(0) || '?'}</span><b>{item.creator}</b></div></td>
              <td className={styles.amount}>{currency(item.amount)}</td>
              <td>{item.bank === 'encrypted' ? 'บัญชีที่ยืนยันแล้ว' : item.bank} {maskAccount(item.bankAccount)}</td>
              <td>{thaiDate(item.requestedAt)}</td>
              <td><span className={`${styles.badge} ${statusMap[item.status].className}`}>{statusMap[item.status].label}</span></td>
              <td><div className={styles.actions}>{item.status === 'pending' ? <>
                <button type="button" className={styles.approve} disabled={busyId === item.id} onClick={() => updateStatus(item, 'approved')}>อนุมัติ</button>
                <button type="button" className={styles.reject} disabled={busyId === item.id} onClick={() => setRejectTarget(item)}>ปฏิเสธ</button>
                <button type="button" className={styles.secondary} disabled={detailBusy} onClick={() => void openDetail(item)}>ดูบัญชี</button>
              </> : <button type="button" className={styles.secondary} disabled={detailBusy} onClick={() => void openDetail(item)}>{item.status === 'approved' ? 'ดูการจ่าย' : 'ดูรายละเอียด'}</button>}</div></td>
            </tr>)}
            {!withdrawals.length && <tr><td colSpan={6} className={styles.empty}>ยังไม่มีคำขอถอนเงิน</td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <Dialog.Root open={!!rejectTarget} onOpenChange={(event) => { if (!event.open && !busyId) setRejectTarget(null) }}>
      <Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={styles.dialog}>
        <Dialog.Header><Dialog.Title>ยืนยันการปฏิเสธ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
        <Dialog.Body>{rejectTarget && <><p>ต้องการปฏิเสธคำขอถอนเงินของ <b>{rejectTarget.creator}</b> จำนวน <b>{currency(rejectTarget.amount)}</b> ใช่หรือไม่?</p><label className={styles.field}>เหตุผลที่ปฏิเสธ *<textarea maxLength={500} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="ระบุเหตุผล 1–500 ตัวอักษร" /></label></>}</Dialog.Body>
        <Dialog.Footer><button type="button" className={styles.secondary} disabled={!!busyId} onClick={() => setRejectTarget(null)}>ยกเลิก</button><button type="button" className={styles.rejectSolid} disabled={!!busyId || !rejectNote.trim()} onClick={confirmReject}>{busyId ? 'กำลังบันทึก...' : 'ยืนยันการปฏิเสธ'}</button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner>
    </Dialog.Root>

    <Dialog.Root open={!!detail} onOpenChange={(event) => { if (!event.open) setDetail(null) }}>
      <Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={styles.dialog}>
        <Dialog.Header><Dialog.Title>{detail?.status === 'approved' ? 'สลิปและรายละเอียดการถอนเงิน' : 'รายละเอียดคำขอถอนเงิน'}</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
        <Dialog.Body>{detail && <div className={styles.details}><div><span>นักเขียน</span><b>{detail.creator}</b></div><div><span>ยอดก่อนภาษี</span><b>{currency((detail.amountSatang ?? Math.round(detail.amount * 100)) / 100)}</b></div><div><span>ภาษีหัก ณ ที่จ่าย 3%</span><b>{currency((detail.taxSatang ?? 0) / 100)}</b></div><div><span>ค่าธรรมเนียม</span><b>{currency((detail.feeSatang ?? 0) / 100)}</b></div><div><span>ยอดสุทธิ</span><b>{currency((detail.netSatang ?? 0) / 100)}</b></div><div><span>ธนาคาร</span><b>{detail.destination?.bankName || detail.bank}</b></div><div><span>ชื่อบัญชี</span><b>{detail.destination?.accountName || '—'}</b></div><div><span>เลขบัญชี</span><b>{detail.destination?.accountNumber || maskAccount(detail.bankAccount)}</b></div><div><span>สถานะ</span><b>{statusMap[detail.status].label}</b></div>{detail.reviewerName && <div><span>ผู้ตรวจสอบ</span><b>{detail.reviewerName}</b></div>}{detail.slipUrl ? <a href={detail.slipUrl} target="_blank" rel="noreferrer" className={styles.slipLink}>เปิดดูสลิป</a> : detail.status === 'approved' && <p className={styles.noSlip}>บันทึกสถานะจ่ายแล้ว แต่ยังไม่มีสลิปแนบ</p>}</div>}</Dialog.Body>
        <Dialog.Footer><button type="button" className={styles.secondary} onClick={() => setDetail(null)}>ปิด</button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner>
    </Dialog.Root>
  </div>
}
