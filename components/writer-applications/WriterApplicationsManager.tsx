'use client'

import { Badge, Button, Dialog, Textarea } from '@chakra-ui/react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eye, FileCheck, RefreshCw, Search, X } from 'lucide-react'
import Image from 'next/image'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './WriterApplicationsManager.module.css'

type ApplicationStatus = 'pending' | 'approved' | 'rejected'
type ApplicantType = 'person' | 'company'
type FilterStatus = ApplicationStatus | 'all'
type DocumentKind = 'identity' | 'bank'

interface ApplicationSummary {
  id: string
  applicantType: ApplicantType
  penName: string
  status: ApplicationStatus
  submittedAt: string
  reviewedAt: string | null
  rejectionReason: string | null
  user: {
    id: string
    name: string
    email: string
    status: string
    userType: string
  }
}

interface ApplicationDetail extends ApplicationSummary {
  termsVersion: string
  termsAcceptedAt: string
  createdAt: string
  updatedAt: string
  details: Record<string, string>
}

interface ListResponse {
  items: ApplicationSummary[]
  total: number
  page: number
  pageSize: number
  counts: Record<FilterStatus, number>
}

interface DocumentState {
  identity: string | null
  bank: string | null
}

const emptyDocuments: DocumentState = { identity: null, bank: null }
const statusMeta: Record<ApplicationStatus, { label: string; palette: string }> = {
  pending: { label: 'รอตรวจสอบ', palette: 'orange' },
  approved: { label: 'อนุมัติแล้ว', palette: 'green' },
  rejected: { label: 'ปฏิเสธ', palette: 'red' },
}
const filters: Array<{ value: FilterStatus; label: string }> = [
  { value: 'pending', label: 'รอตรวจสอบ' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'rejected', label: 'ปฏิเสธ' },
  { value: 'all', label: 'ทั้งหมด' },
]

function formatDate(value: string | null, includeTime = true) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value))
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string }
    return body.error || fallback
  } catch {
    return fallback
  }
}

function DetailField({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return (
    <div className={wide ? styles.fieldWide : styles.field}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = statusMeta[status]
  return <Badge colorPalette={meta.palette} variant="subtle" size="sm">{meta.label}</Badge>
}

export function WriterApplicationsManager() {
  const [data, setData] = useState<ListResponse | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [page, setPage] = useState(1)
  const [queryDraft, setQueryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [listBusy, setListBusy] = useState(true)
  const [listError, setListError] = useState('')

  const [selected, setSelected] = useState<ApplicationSummary | null>(null)
  const [detail, setDetail] = useState<ApplicationDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [documents, setDocuments] = useState<DocumentState>(emptyDocuments)
  const [documentErrors, setDocumentErrors] = useState<DocumentState>(emptyDocuments)
  const documentUrlsRef = useRef<DocumentState>(emptyDocuments)

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [decisionBusy, setDecisionBusy] = useState(false)

  const fetchList = useCallback(async () => {
    setListBusy(true)
    setListError('')
    try {
      const params = new URLSearchParams({ status: filter, page: String(page), pageSize: '20' })
      if (query) params.set('query', query)
      const response = await fetch(`/api/writer-applications?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await responseError(response, 'โหลดรายการใบสมัครไม่สำเร็จ'))
      setData(await response.json() as ListResponse)
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'โหลดรายการใบสมัครไม่สำเร็จ')
    } finally {
      setListBusy(false)
    }
  }, [filter, page, query])

  useEffect(() => { void fetchList() }, [fetchList])

  const revokeDocuments = useCallback(() => {
    for (const url of Object.values(documentUrlsRef.current)) {
      if (url) URL.revokeObjectURL(url)
    }
    documentUrlsRef.current = emptyDocuments
    setDocuments(emptyDocuments)
  }, [])

  useEffect(() => () => {
    for (const url of Object.values(documentUrlsRef.current)) {
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  async function loadDocument(id: string, kind: DocumentKind) {
    const response = await fetch(`/api/writer-applications/${id}/documents/${kind}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(await responseError(response, 'โหลดเอกสารไม่สำเร็จ'))
    return URL.createObjectURL(await response.blob())
  }

  async function openDetail(application: ApplicationSummary) {
    revokeDocuments()
    setSelected(application)
    setDetail(null)
    setDetailError('')
    setDocumentErrors(emptyDocuments)
    setDetailBusy(true)

    const detailRequest = fetch(`/api/writer-applications/${application.id}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, 'โหลดรายละเอียดใบสมัครไม่สำเร็จ'))
        const body = await response.json() as { application: ApplicationDetail }
        setDetail(body.application)
      })
      .catch((error: unknown) => setDetailError(error instanceof Error ? error.message : 'โหลดรายละเอียดใบสมัครไม่สำเร็จ'))

    const documentRequests = (['identity', 'bank'] as DocumentKind[]).map(async (kind) => {
      try {
        const url = await loadDocument(application.id, kind)
        documentUrlsRef.current = { ...documentUrlsRef.current, [kind]: url }
        setDocuments((current) => ({ ...current, [kind]: url }))
      } catch (error) {
        setDocumentErrors((current) => ({
          ...current,
          [kind]: error instanceof Error ? error.message : 'โหลดเอกสารไม่สำเร็จ',
        }))
      }
    })

    await Promise.all([detailRequest, ...documentRequests])
    setDetailBusy(false)
  }

  function closeDetail() {
    revokeDocuments()
    setSelected(null)
    setDetail(null)
    setDetailError('')
    setDocumentErrors(emptyDocuments)
    setApproveOpen(false)
    setRejectOpen(false)
    setRejectReason('')
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setPage(1)
    setQuery(queryDraft.trim())
  }

  async function submitDecision(decision: 'approved' | 'rejected') {
    if (!selected) return
    setDecisionBusy(true)
    try {
      const response = await fetch(`/api/writer-applications/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...(decision === 'rejected' ? { reason: rejectReason.trim() } : {}) }),
      })
      if (!response.ok) throw new Error(await responseError(response, 'บันทึกผลการตรวจสอบไม่สำเร็จ'))
      toaster.success({
        title: decision === 'approved' ? 'อนุมัติใบสมัครแล้ว' : 'ปฏิเสธใบสมัครแล้ว',
        description: decision === 'approved'
          ? `บัญชีของ “${selected.penName}” เปลี่ยนเป็นนักเขียนเรียบร้อย`
          : `ส่งเหตุผลกลับไปยัง “${selected.penName}” แล้ว`,
      })
      closeDetail()
      await fetchList()
    } catch (error) {
      toaster.error({
        title: 'บันทึกผลไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
      })
    } finally {
      setDecisionBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)))
  const canApprove = selected?.status === 'pending' && detail?.user.status === 'active' && !!documents.identity && !!documents.bank && !detailBusy

  return (
    <>
      <section className={styles.stats} aria-label="สรุปใบสมัคร">
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={`${styles.statCard} ${filter === item.value ? styles.statActive : ''}`}
            onClick={() => { setFilter(item.value); setPage(1) }}
          >
            <span>{item.label}</span>
            <strong>{data?.counts[item.value] ?? 0}</strong>
          </button>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div>
            <h2>รายการใบสมัคร</h2>
            <p>พบ {data?.total ?? 0} รายการตามตัวกรอง</p>
          </div>
          <form className={styles.search} onSubmit={submitSearch}>
            <Search size={17} aria-hidden="true" />
            <input
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="ค้นหานามปากกา ชื่อ หรืออีเมล"
              aria-label="ค้นหาใบสมัคร"
              maxLength={100}
            />
            <Button type="submit" size="sm" colorPalette="teal">ค้นหา</Button>
          </form>
        </div>

        {listError && (
          <div className={styles.errorState} role="alert">
            <AlertTriangle size={20} />
            <span>{listError}</span>
            <Button size="sm" variant="outline" onClick={() => void fetchList()}><RefreshCw size={15} />ลองใหม่</Button>
          </div>
        )}

        {!listError && listBusy && (
          <div className={styles.loadingState}><span className={styles.spinner} />กำลังโหลดใบสมัคร…</div>
        )}

        {!listError && !listBusy && data?.items.length === 0 && (
          <div className={styles.emptyState}>
            <FileCheck size={38} />
            <strong>ไม่พบใบสมัคร</strong>
            <span>ลองเปลี่ยนสถานะหรือล้างคำค้นหา</span>
          </div>
        )}

        {!listError && !listBusy && !!data?.items.length && (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ผู้สมัคร</th>
                  <th>ประเภท</th>
                  <th>นามปากกา</th>
                  <th>ส่งเมื่อ</th>
                  <th>สถานะ</th>
                  <th><span className={styles.srOnly}>จัดการ</span></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((application) => (
                  <tr key={application.id}>
                    <td><strong>{application.user.name}</strong><span>{application.user.email}</span></td>
                    <td>{application.applicantType === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา'}</td>
                    <td><strong>{application.penName}</strong></td>
                    <td>{formatDate(application.submittedAt)}</td>
                    <td><StatusBadge status={application.status} /></td>
                    <td><Button size="sm" variant="outline" onClick={() => void openDetail(application)}><Eye size={16} />ตรวจสอบ</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!listError && !listBusy && (data?.total ?? 0) > 0 && (
          <div className={styles.pagination}>
            <span>หน้า {data?.page ?? page} จาก {totalPages}</span>
            <div>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} />ก่อนหน้า</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>ถัดไป<ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </section>

      <Dialog.Root open={!!selected} onOpenChange={(event) => { if (!event.open) closeDetail() }} size="cover">
        <Dialog.Backdrop />
        <Dialog.Positioner className={styles.dialogPositioner}>
          <Dialog.Content className={styles.detailDialog}>
            <Dialog.Header className={styles.dialogHeader}>
              <div>
                <Dialog.Title>ตรวจสอบใบสมัครนักเขียน</Dialog.Title>
                <p>{selected?.penName} · ส่งเมื่อ {formatDate(selected?.submittedAt ?? null)}</p>
              </div>
              {selected && <StatusBadge status={selected.status} />}
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body className={styles.dialogBody}>
              <div className={styles.privacyNotice}>
                <AlertTriangle size={18} />
                ข้อมูลและเอกสารในหน้านี้เป็นข้อมูลส่วนบุคคล ระบบไม่อนุญาตให้ดาวน์โหลดและบันทึกการเปิดดูทุกครั้ง
              </div>

              {detailBusy && <div className={styles.loadingState}><span className={styles.spinner} />กำลังถอดรหัสข้อมูลและเอกสาร…</div>}
              {detailError && <div className={styles.errorState} role="alert"><AlertTriangle size={20} />{detailError}</div>}

              {detail && (
                <div className={styles.detailContent}>
                  <section className={styles.detailSection}>
                    <div className={styles.sectionHeading}><span>1</span><div><h3>ข้อมูลผู้สมัคร</h3><p>{detail.applicantType === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา'}</p></div></div>
                    <div className={styles.fieldGrid}>
                      {detail.applicantType === 'company' && <DetailField label="ชื่อบริษัท" value={detail.details.companyName} wide />}
                      {detail.applicantType === 'company' && <DetailField label="เลขประจำตัวผู้เสียภาษี" value={detail.details.taxId} />}
                      <DetailField label="เลขบัตรประชาชน" value={detail.details.nationalId} />
                      <DetailField label="คำนำหน้า" value={detail.details.prefix} />
                      <DetailField label="ชื่อ" value={detail.details.firstName} />
                      <DetailField label="นามสกุล" value={detail.details.lastName} />
                      <DetailField label="นามปากกา" value={detail.penName} />
                      <DetailField label="เบอร์โทรศัพท์" value={detail.details.phone} />
                      <DetailField label="อีเมลติดต่อ" value={detail.details.email} />
                      <DetailField label="บัญชี ReadLead" value={detail.user.email} />
                      <DetailField label="สถานะบัญชี" value={detail.user.status === 'active' ? 'ใช้งาน' : detail.user.status === 'banned' ? 'ถูกระงับ' : 'ไม่ใช้งาน'} />
                    </div>
                    {detail.user.status !== 'active' && <div className={styles.accountWarning}><AlertTriangle size={17} />ไม่สามารถอนุมัติได้ เนื่องจากบัญชีผู้สมัครถูกระงับหรือไม่ใช้งาน</div>}
                  </section>

                  <section className={styles.detailSection}>
                    <div className={styles.sectionHeading}><span>2</span><div><h3>ที่อยู่</h3><p>ที่อยู่สำหรับเอกสารและภาษี</p></div></div>
                    <div className={styles.fieldGrid}>
                      <DetailField label="ที่อยู่" value={detail.details.address} wide />
                      <DetailField label="จังหวัด" value={detail.details.provinceName} />
                      <DetailField label="อำเภอ / เขต" value={detail.details.districtName} />
                      <DetailField label="ตำบล / แขวง" value={detail.details.subdistrictName} />
                      <DetailField label="รหัสไปรษณีย์" value={detail.details.postalCode} />
                    </div>
                  </section>

                  <section className={styles.detailSection}>
                    <div className={styles.sectionHeading}><span>3</span><div><h3>บัญชีรับรายได้</h3><p>บัญชีธนาคารสำหรับโอนรายได้</p></div></div>
                    <div className={styles.fieldGrid}>
                      <DetailField label="ธนาคาร" value={detail.details.bankName} />
                      <DetailField label="เลขที่บัญชี" value={detail.details.accountNumber} />
                      <DetailField label="ชื่อบัญชี" value={detail.details.accountName} wide />
                    </div>
                  </section>

                  <section className={styles.detailSection}>
                    <div className={styles.sectionHeading}><span>4</span><div><h3>เอกสารยืนยัน</h3><p>แสดงจากไฟล์ที่ถอดรหัสบนเซิร์ฟเวอร์</p></div></div>
                    <div className={styles.documentsGrid}>
                      {(['identity', 'bank'] as DocumentKind[]).map((kind) => (
                        <article className={styles.documentCard} key={kind}>
                          <div><strong>{kind === 'identity' ? 'บัตรประชาชน' : 'หน้าสมุดบัญชี'}</strong>{documents[kind] && <span><Check size={14} />ถอดรหัสสำเร็จ</span>}</div>
                          {documents[kind] && <Image src={documents[kind]} alt={kind === 'identity' ? 'เอกสารบัตรประชาชน' : 'เอกสารหน้าสมุดบัญชี'} width={900} height={560} unoptimized />}
                          {!documents[kind] && !documentErrors[kind] && <div className={styles.documentLoading}><span className={styles.spinner} />กำลังโหลด…</div>}
                          {documentErrors[kind] && <div className={styles.documentError}><AlertTriangle size={18} />{documentErrors[kind]}</div>}
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className={styles.termsRow}>
                    <FileCheck size={19} />
                    <div><strong>ยอมรับข้อกำหนดนักเขียนแล้ว</strong><span>เวอร์ชัน {detail.termsVersion} · {formatDate(detail.termsAcceptedAt)}</span></div>
                  </section>

                  {detail.status === 'rejected' && detail.rejectionReason && (
                    <section className={styles.rejectionBox}><strong>เหตุผลที่ปฏิเสธ</strong><p>{detail.rejectionReason}</p></section>
                  )}
                </div>
              )}
            </Dialog.Body>
            <Dialog.Footer className={styles.dialogFooter}>
              <Button variant="outline" onClick={closeDetail}>ปิด</Button>
              {selected?.status === 'pending' && (
                <>
                  <Button colorPalette="red" variant="outline" disabled={!detail || detailBusy} onClick={() => setRejectOpen(true)}><X size={16} />ปฏิเสธ</Button>
                  <Button colorPalette="teal" disabled={!canApprove} onClick={() => setApproveOpen(true)}><Check size={16} />อนุมัติเป็นนักเขียน</Button>
                </>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={approveOpen} onOpenChange={(event) => setApproveOpen(event.open)} role="alertdialog">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>ยืนยันการอนุมัติ</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
            <Dialog.Body>
              <p>บัญชีของ <strong>{selected?.user.name}</strong> จะได้รับสิทธิ์นักเขียน และสร้างโปรไฟล์ Creator ทันที</p>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" disabled={decisionBusy} onClick={() => setApproveOpen(false)}>ยกเลิก</Button>
              <Button colorPalette="teal" loading={decisionBusy} disabled={!canApprove} onClick={() => void submitDecision('approved')}>ยืนยันอนุมัติ</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={rejectOpen} onOpenChange={(event) => setRejectOpen(event.open)} role="alertdialog">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header><Dialog.Title>ปฏิเสธใบสมัคร</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header>
            <Dialog.Body>
              <label className={styles.reasonLabel} htmlFor="writer-rejection-reason">เหตุผลที่แจ้งผู้สมัคร</label>
              <Textarea id="writer-rejection-reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} maxLength={500} rows={5} placeholder="ระบุข้อมูลหรือเอกสารที่ต้องแก้ไข" />
              <div className={styles.reasonCount}>{rejectReason.length}/500</div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" disabled={decisionBusy} onClick={() => setRejectOpen(false)}>ยกเลิก</Button>
              <Button colorPalette="red" loading={decisionBusy} disabled={!rejectReason.trim()} onClick={() => void submitDecision('rejected')}>ยืนยันปฏิเสธ</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
