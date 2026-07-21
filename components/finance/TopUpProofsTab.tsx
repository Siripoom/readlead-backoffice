'use client'

import { Dialog } from '@chakra-ui/react'
import Image from 'next/image'
import { FormEvent, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { toaster } from '@/lib/toaster'
import styles from './FinanceOverview.module.css'

type Status = 'pending' | 'approved' | 'rejected'
type Filter = 'all' | Status
type TopUpProof = {
  id: string
  reference: string
  packageId: string
  baseCoins: number
  bonusCoins: number
  totalCoins: number
  amountBaht: number
  status: Status
  slip: { url: string; contentType: string; sizeBytes: number; name: string }
  rejectionReason: string | null
  reviewedAt: string | null
  submittedAt: string
  user: { id: string; name: string; email: string; status: string }
  reviewerName: string | null
}
type TopUpResponse = {
  items: TopUpProof[]
  total: number
  page: number
  pageSize: number
  counts: Record<Filter, number>
}

const statusInfo: Record<Status, { label: string; className: string }> = {
  pending: { label: 'รอตรวจสอบ', className: styles.amber },
  approved: { label: 'อนุมัติแล้ว', className: styles.green },
  rejected: { label: 'ปฏิเสธ', className: styles.red },
}

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'pending', label: 'รอตรวจสอบ' },
  { id: 'approved', label: 'อนุมัติแล้ว' },
  { id: 'rejected', label: 'ปฏิเสธ' },
]

function dateTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok',
  }).format(new Date(value))
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  return body.error || 'ดำเนินการไม่สำเร็จ'
}

export function TopUpProofsTab() {
  const [data, setData] = useState<TopUpResponse | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<TopUpProof | null>(null)
  const [rejectTarget, setRejectTarget] = useState<TopUpProof | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ status: filter, q: query, page: String(page), pageSize: '20' })
    fetch(`/api/finance/topups?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response))
        return response.json() as Promise<TopUpResponse>
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : 'โหลดรายการหลักฐานไม่สำเร็จ')
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filter, page, query, revision])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setPage(1)
    setQuery(searchInput.trim())
    setRevision((value) => value + 1)
  }

  function changeFilter(next: Filter) {
    setLoading(true)
    setError('')
    setFilter(next)
    setPage(1)
  }

  async function decide(item: TopUpProof, decision: 'approved' | 'rejected', reason?: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/finance/topups/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const result = await response.json() as { request: TopUpProof }
      setDetail(result.request)
      setRejectTarget(null)
      setRejectReason('')
      setRevision((value) => value + 1)
      toaster.success({
        title: decision === 'approved' ? 'อนุมัติและเติมเหรียญแล้ว' : 'ปฏิเสธหลักฐานแล้ว',
        description: `${item.user.name} · ${item.reference}`,
      })
    } catch (reason) {
      toaster.error({ title: 'บันทึกผลไม่สำเร็จ', description: reason instanceof Error ? reason.message : 'กรุณาลองใหม่' })
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)))

  return <section className={styles.proofPanel} aria-busy={loading}>
    <div className={styles.proofHead}>
      <div><h2>ตรวจสอบหลักฐานการเติมเหรียญ</h2><p>อนุมัติแล้วระบบจะเพิ่มเหรียญรวมโบนัสเข้ากระเป๋าทันที</p></div>
      <span className={styles.pendingCount}>{(data?.counts.pending ?? 0).toLocaleString('th-TH')} รายการรอตรวจ</span>
    </div>

    <div className={styles.proofTools}>
      <div className={styles.proofFilters} role="tablist" aria-label="กรองสถานะหลักฐาน">
        {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? styles.proofFilterActive : ''} onClick={() => changeFilter(item.id)}>{item.label}<span>{(data?.counts[item.id] ?? 0).toLocaleString('th-TH')}</span></button>)}
      </div>
      <form className={styles.proofSearch} onSubmit={submitSearch}>
        <Search aria-hidden="true" />
        <input value={searchInput} maxLength={120} onChange={(event) => setSearchInput(event.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือเลขอ้างอิง" aria-label="ค้นหาหลักฐาน" />
        <button type="submit">ค้นหา</button>
      </form>
    </div>

    {error ? <div className={styles.proofState}><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); setRevision((value) => value + 1) }}>ลองอีกครั้ง</button></div> : loading && !data ? <div className={styles.proofState}>กำลังโหลดรายการ...</div> : <>
      <div className={styles.tableWrap}>
        <table className={styles.proofTable}>
          <thead><tr><th>รายการ</th><th>ผู้ใช้</th><th>แพ็กเกจ</th><th>ยอดชำระ</th><th>วันที่ส่ง</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>
            {(data?.items ?? []).map((item) => <tr key={item.id}>
              <td><b>{item.reference}</b></td>
              <td><div className={styles.proofUser}><b>{item.user.name}</b><span>{item.user.email}</span></div></td>
              <td><b>{item.totalCoins.toLocaleString('th-TH')} เหรียญ</b><small>{item.baseCoins.toLocaleString('th-TH')} + โบนัส {item.bonusCoins.toLocaleString('th-TH')}</small></td>
              <td className={styles.amount}>฿{item.amountBaht.toLocaleString('th-TH')}</td>
              <td>{dateTime(item.submittedAt)}</td>
              <td><span className={`${styles.badge} ${statusInfo[item.status].className}`}>{statusInfo[item.status].label}</span></td>
              <td><button type="button" className={styles.secondary} onClick={() => setDetail(item)}>ตรวจสอบ</button></td>
            </tr>)}
            {!data?.items.length && <tr><td colSpan={7} className={styles.empty}>ไม่พบรายการหลักฐาน</td></tr>}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && <div className={styles.proofPagination}><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>ก่อนหน้า</button><span>หน้า {page.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}</span><button type="button" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>ถัดไป</button></div>}
    </>}

    <Dialog.Root open={!!detail} onOpenChange={(event) => { if (!event.open && !busy) setDetail(null) }}>
      <Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={`${styles.dialog} ${styles.proofDialog}`}>
        <Dialog.Header><Dialog.Title>หลักฐาน {detail?.reference}</Dialog.Title><Dialog.CloseTrigger disabled={busy} /></Dialog.Header>
        <Dialog.Body>{detail && <div className={styles.proofDetail}>
          <a href={detail.slip.url} target="_blank" rel="noreferrer" className={styles.proofImageLink}><Image src={detail.slip.url} alt={`สลิป ${detail.reference}`} width={900} height={1200} unoptimized /></a>
          <div className={styles.proofMeta}>
            <div><span>ผู้ใช้</span><b>{detail.user.name}</b><small>{detail.user.email}</small></div>
            <div><span>ยอดชำระ</span><b>฿{detail.amountBaht.toLocaleString('th-TH')}</b></div>
            <div><span>เหรียญที่จะได้รับ</span><b>{detail.totalCoins.toLocaleString('th-TH')} เหรียญ</b><small>รวมโบนัส {detail.bonusCoins.toLocaleString('th-TH')}</small></div>
            <div><span>ส่งเมื่อ</span><b>{dateTime(detail.submittedAt)}</b></div>
            <div><span>ไฟล์</span><b>{detail.slip.name}</b><small>{(detail.slip.sizeBytes / 1024 / 1024).toFixed(2)} MB</small></div>
            <div><span>สถานะ</span><b>{statusInfo[detail.status].label}</b></div>
            {detail.reviewerName && <div><span>ผู้ตรวจสอบ</span><b>{detail.reviewerName}</b></div>}
            {detail.rejectionReason && <div className={styles.proofRejectReason}><span>เหตุผลที่ปฏิเสธ</span><b>{detail.rejectionReason}</b></div>}
          </div>
        </div>}</Dialog.Body>
        <Dialog.Footer>{detail?.status === 'pending' ? <><button type="button" className={styles.reject} disabled={busy} onClick={() => setRejectTarget(detail)}>ปฏิเสธ</button><button type="button" className={styles.approve} disabled={busy} onClick={() => void decide(detail, 'approved')}>{busy ? 'กำลังอนุมัติ...' : 'อนุมัติและเติมเหรียญ'}</button></> : <button type="button" className={styles.secondary} onClick={() => setDetail(null)}>ปิด</button>}</Dialog.Footer>
      </Dialog.Content></Dialog.Positioner>
    </Dialog.Root>

    <Dialog.Root open={!!rejectTarget} onOpenChange={(event) => { if (!event.open && !busy) setRejectTarget(null) }}>
      <Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className={styles.dialog}>
        <Dialog.Header><Dialog.Title>ปฏิเสธหลักฐาน</Dialog.Title><Dialog.CloseTrigger disabled={busy} /></Dialog.Header>
        <Dialog.Body><p>ระบุเหตุผลเพื่อแจ้งให้ผู้ใช้สร้างคำขอใหม่</p><label className={styles.field}>เหตุผลที่ปฏิเสธ *<textarea autoFocus minLength={1} maxLength={500} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="เช่น ยอดเงินในสลิปไม่ตรงกับแพ็กเกจ" /></label></Dialog.Body>
        <Dialog.Footer><button type="button" className={styles.secondary} disabled={busy} onClick={() => setRejectTarget(null)}>ยกเลิก</button><button type="button" className={styles.rejectSolid} disabled={busy || !rejectReason.trim()} onClick={() => rejectTarget && void decide(rejectTarget, 'rejected', rejectReason.trim())}>{busy ? 'กำลังบันทึก...' : 'ยืนยันการปฏิเสธ'}</button></Dialog.Footer>
      </Dialog.Content></Dialog.Positioner>
    </Dialog.Root>
  </section>
}
