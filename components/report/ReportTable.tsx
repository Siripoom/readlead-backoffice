'use client'

import { Button, Dialog, Image, Textarea } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { PunishmentDialog } from '@/components/punishment/PunishmentDialog'
import type { PunishmentLevel } from '@/lib/mock-data/punishment'
import type { ReportItem, ReportStatus } from '@/lib/mock-data/report'
import { toaster } from '@/lib/toaster'
import styles from './ReportTable.module.css'

type ReportAttachment = {
  id: string
  messageId: string | null
  url: string
  originalName: string
}

type ReportDetail = {
  id: string
  senderName: string
  subject: string
  type: string
  date: string
  status: 'open' | 'in_progress' | 'resolved'
  message: string
  attachments: ReportAttachment[]
  messages: Array<{
    id: string
    senderType: string
    senderName: string
    message: string
    createdAt: string
    attachments: ReportAttachment[]
  }>
}

type ReportFilter = 'all' | ReportStatus

const statusMap: Record<ReportStatus, { label: string; className: string }> = {
  open: { label: 'รอดำเนินการ', className: styles.statusOpen },
  'in-progress': { label: 'กำลังดำเนินการ', className: styles.statusProgress },
  resolved: { label: 'ปิดแล้ว', className: styles.statusResolved },
}

const filters: Array<{ value: ReportFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'open', label: 'รอดำเนินการ' },
  { value: 'in-progress', label: 'กำลังดำเนินการ' },
  { value: 'resolved', label: 'ปิดแล้ว' },
]

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
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

function formatThaiDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const item = statusMap[status]
  return <span className={`${styles.statusBadge} ${item.className}`}>{item.label}</span>
}

function AttachmentGrid({ items }: { items: ReportAttachment[] }) {
  return (
    <div className={styles.attachmentGrid}>
      {items.map((item) => (
        <a className={styles.attachmentLink} key={item.id} href={item.url} target="_blank" rel="noreferrer" title={item.originalName}>
          <Image className={styles.attachmentImage} src={item.url} alt={item.originalName} />
          <span>{item.originalName}</span>
        </a>
      ))}
    </div>
  )
}

function Conversation({ detail }: { detail: ReportDetail }) {
  if (detail.messages.length === 0) return null
  return (
    <div className={styles.detailField}>
      <span className={styles.detailLabel}>บทสนทนา</span>
      <div className={styles.conversation}>
        {detail.messages.map((message) => {
          const fromAdmin = message.senderType === 'admin'
          return (
            <div className={`${styles.message} ${fromAdmin ? styles.adminMessage : styles.userMessage}`} key={message.id}>
              <div className={styles.messageMeta}>
                <strong>{fromAdmin ? 'เจ้าหน้าที่' : message.senderName}</strong>
                <span>{formatThaiDateTime(message.createdAt)}</span>
              </div>
              {message.message && <p>{message.message}</p>}
              {message.attachments.length > 0 && <AttachmentGrid items={message.attachments} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DetailLoadingState({ error, onRetry }: { error: string; onRetry: () => void }) {
  if (error) {
    return (
      <div className={styles.dialogState} role="alert">
        <span>{error}</span>
        <button type="button" className={styles.smallButton} onClick={onRetry}>ลองใหม่</button>
      </div>
    )
  }
  return <div className={styles.dialogState}>กำลังโหลดรายละเอียด…</div>
}

export function ReportTable({ data: initialData }: { data: ReportItem[] }) {
  const [data, setData] = useState(initialData)
  const [filter, setFilter] = useState<ReportFilter>('all')
  const [selectedItem, setSelectedItem] = useState<ReportItem | null>(null)
  const [mode, setMode] = useState<'view' | 'reply' | null>(null)
  const [replyText, setReplyText] = useState('')
  const [punishTarget, setPunishTarget] = useState<ReportItem | null>(null)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const visibleData = useMemo(
    () => filter === 'all' ? data : data.filter((item) => item.status === filter),
    [data, filter],
  )

  function filterCount(value: ReportFilter) {
    return value === 'all' ? data.length : data.filter((item) => item.status === value).length
  }

  function handleConfirmPunish(level: PunishmentLevel) {
    if (!punishTarget) return
    setData((current) => current.map((item) => item.id === punishTarget.id ? { ...item, status: 'resolved' } : item))
    toaster.error({ title: 'ลงโทษแล้ว', description: `"${punishTarget.sender}" ถูกลงโทษ: ${level.name}` })
    setPunishTarget(null)
  }

  function handleClose() {
    setMode(null)
    setSelectedItem(null)
    setDetail(null)
    setDetailLoading(false)
    setDetailError('')
    setReplyText('')
  }

  async function loadDetail(item: ReportItem) {
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/reports/${item.id}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Unable to load report')
      setDetail(await response.json() as ReportDetail)
    } catch {
      setDetailError('โหลดรายละเอียดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      toaster.error({ title: 'โหลดรายละเอียดไม่สำเร็จ' })
    } finally {
      setDetailLoading(false)
    }
  }

  async function openReport(item: ReportItem, nextMode: 'view' | 'reply') {
    setSelectedItem(item)
    setMode(nextMode)
    setReplyText('')
    await loadDetail(item)
  }

  async function handleSendReply() {
    if (!selectedItem || !replyText.trim() || isSending) return
    setIsSending(true)
    try {
      const response = await fetch(`/api/reports/${selectedItem.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      })
      if (!response.ok) {
        toaster.error({ title: 'ส่งคำตอบไม่สำเร็จ' })
        return
      }
      const nextStatus: ReportStatus = 'in-progress'
      setData((current) => current.map((item) => item.id === selectedItem.id ? { ...item, status: nextStatus } : item))
      toaster.success({ title: 'ส่งคำตอบสำเร็จ', description: `อัปเดตสถานะเป็น "${statusMap[nextStatus].label}"` })
      handleClose()
    } finally {
      setIsSending(false)
    }
  }

  async function handleResolve(item: ReportItem) {
    if (resolvingId) return
    setResolvingId(item.id)
    try {
      const response = await fetch(`/api/reports/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      })
      if (!response.ok) {
        toaster.error({ title: 'ปิดเรื่องไม่สำเร็จ' })
        return
      }
      setData((current) => current.map((row) => row.id === item.id ? { ...row, status: 'resolved' } : row))
      toaster.success({ title: 'ปิดเรื่องแล้ว' })
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>รายงาน</h1>
        <p className={styles.pageDescription}>เรื่องที่ผู้ใช้แจ้งเข้ามา เช่น สแปม เนื้อหาไม่เหมาะสม ละเมิดลิขสิทธิ์</p>
      </div>

      <section className={styles.panel} aria-label="รายการรายงาน">
        <div className={styles.panelHeader}>
          <div className={styles.pills} aria-label="กรองสถานะรายงาน">
            {filters.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`${styles.pill} ${filter === item.value ? styles.activePill : ''}`}
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
              >
                <span>{item.label}</span>
                <span className={styles.filterCount}>{filterCount(item.value)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>ผู้แจ้ง</th><th>ประเภท</th><th>เป้าหมาย</th><th>วันที่</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {visibleData.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.avatar}>{initials(item.sender)}</span>
                      <strong>{item.sender}</strong>
                    </div>
                  </td>
                  <td>{item.type}</td>
                  <td><span className={styles.subject} title={item.subject}>{item.subject}</span></td>
                  <td className={styles.mutedCell}>{formatThaiDate(item.date)}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    <div className={styles.actions}>
                      <button type="button" className={styles.smallButton} onClick={() => void openReport(item, 'view')}>ดู</button>
                      <button type="button" className={styles.smallButton} disabled={item.status === 'resolved'} onClick={() => void openReport(item, 'reply')}>ตอบกลับ</button>
                      {!item.support && <button type="button" className={`${styles.smallButton} ${styles.dangerButton}`} onClick={() => setPunishTarget(item)}>ลงโทษ</button>}
                      {item.status !== 'resolved' && <button type="button" className={`${styles.smallButton} ${styles.dangerButton}`} disabled={resolvingId === item.id} onClick={() => void handleResolve(item)}>{resolvingId === item.id ? 'กำลังปิด…' : 'ปิดเรื่อง'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleData.length === 0 && <div className={styles.emptyState}>ยังไม่มีรายงานจากผู้ใช้ในสถานะนี้</div>}
        </div>
      </section>

      <Dialog.Root open={mode === 'view'} onOpenChange={(event) => { if (!event.open) handleClose() }}>
        <Dialog.Backdrop className={styles.modalBackdrop} />
        <Dialog.Positioner className={styles.modalPositioner}>
          <Dialog.Content className={styles.modalContent}>
            <Dialog.Header className={styles.modalHeader}>
              <Dialog.Title className={styles.modalTitle}>รายละเอียดเรื่องที่แจ้ง</Dialog.Title>
              <Dialog.CloseTrigger className={styles.modalClose} />
            </Dialog.Header>
            <Dialog.Body className={styles.modalBody}>
              {selectedItem && (detailLoading || detailError) && <DetailLoadingState error={detailError} onRetry={() => void loadDetail(selectedItem)} />}
              {selectedItem && detail && (
                <div className={styles.detailList}>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailField}><span className={styles.detailLabel}>ผู้แจ้ง</span><strong>{selectedItem.sender}</strong></div>
                    <div className={styles.detailField}><span className={styles.detailLabel}>วันที่</span><strong>{formatThaiDate(selectedItem.date)}</strong></div>
                  </div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>หัวเรื่อง</span><strong>{selectedItem.subject}</strong></div>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailField}><span className={styles.detailLabel}>ประเภท</span><strong>{selectedItem.type}</strong></div>
                    <div className={styles.detailField}><span className={styles.detailLabel}>สถานะ</span><StatusBadge status={selectedItem.status} /></div>
                  </div>
                  <div className={styles.detailField}><span className={styles.detailLabel}>เนื้อหา</span><div className={styles.reportMessage}>{detail.message}</div></div>
                  {detail.attachments.some((item) => !item.messageId) && <div className={styles.detailField}><span className={styles.detailLabel}>ไฟล์แนบ</span><AttachmentGrid items={detail.attachments.filter((item) => !item.messageId)} /></div>}
                  <Conversation detail={detail} />
                </div>
              )}
            </Dialog.Body>
            <Dialog.Footer className={styles.modalFooter}>
              <Button className={styles.dialogGhostButton} onClick={handleClose}>ปิด</Button>
              {selectedItem && selectedItem.status !== 'resolved' && <Button className={styles.dialogPrimaryButton} onClick={() => setMode('reply')}>ตอบกลับ</Button>}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <PunishmentDialog open={!!punishTarget} targetName={punishTarget?.sender ?? ''} onClose={() => setPunishTarget(null)} onConfirm={handleConfirmPunish} />

      <Dialog.Root open={mode === 'reply'} onOpenChange={(event) => { if (!event.open) handleClose() }}>
        <Dialog.Backdrop className={styles.modalBackdrop} />
        <Dialog.Positioner className={styles.modalPositioner}>
          <Dialog.Content className={styles.modalContent}>
            <Dialog.Header className={styles.modalHeader}>
              <Dialog.Title className={styles.modalTitle}>ตอบกลับรายงาน</Dialog.Title>
              <Dialog.CloseTrigger className={styles.modalClose} />
            </Dialog.Header>
            <Dialog.Body className={styles.modalBody}>
              {selectedItem && (detailLoading || detailError) && <DetailLoadingState error={detailError} onRetry={() => void loadDetail(selectedItem)} />}
              {selectedItem && detail && (
                <div className={styles.detailList}>
                  <div className={styles.replySubject}><span>หัวเรื่อง</span><strong>{selectedItem.subject}</strong></div>
                  <Conversation detail={detail} />
                  <label className={styles.detailField}>
                    <span className={styles.detailLabel}>ตอบกลับถึงผู้ใช้</span>
                    <Textarea className={styles.replyTextarea} rows={5} maxLength={1000} placeholder="พิมพ์ข้อความตอบกลับ..." value={replyText} onChange={(event) => setReplyText(event.target.value)} />
                    <span className={styles.characterCount}>{replyText.length}/1,000</span>
                  </label>
                </div>
              )}
            </Dialog.Body>
            <Dialog.Footer className={styles.modalFooter}>
              <Button className={styles.dialogGhostButton} onClick={handleClose}>ยกเลิก</Button>
              <Button className={styles.dialogPrimaryButton} onClick={() => void handleSendReply()} disabled={!detail || !replyText.trim() || isSending}>{isSending ? 'กำลังส่ง…' : 'ส่งคำตอบ'}</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}
