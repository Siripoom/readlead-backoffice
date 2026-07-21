'use client'

import { Button, Dialog } from '@chakra-ui/react'
import type { PunishmentRecord } from '@/lib/mock-data/punishment'
import styles from './UsersPanel.module.css'

interface Props {
  open: boolean
  userName: string
  records: PunishmentRecord[]
  onClose: () => void
}

function formatThaiDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function PunishmentHistoryDialog({ open, userName, records, onClose }: Props) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Dialog.Root open={open} onOpenChange={(event) => { if (!event.open) onClose() }}>
      <Dialog.Backdrop className={styles.modalBackdrop} />
      <Dialog.Positioner className={styles.modalPositioner}>
        <Dialog.Content className={`${styles.modalContent} ${styles.wideModal}`}>
          <Dialog.Header className={styles.modalHeader}>
            <Dialog.Title className={styles.modalTitle}>ประวัติการลงโทษ — {userName}</Dialog.Title>
            <Dialog.CloseTrigger className={styles.modalClose} />
          </Dialog.Header>
          <Dialog.Body className={styles.modalBody}>
            <div className={styles.historySummary}>
              <span>ถูกลงโทษทั้งหมด</span>
              <span className={styles.moderationCount}>{records.length} ครั้ง</span>
            </div>
            {sorted.length === 0 ? <div className={styles.tableState}>ไม่มีประวัติการลงโทษ</div> : (
              <div className={`${styles.panel} ${styles.historyPanel}`}>
                <div className={styles.tableWrap}>
                  <table className={`${styles.table} ${styles.compactTable}`}>
                    <thead><tr><th>วันที่</th><th>ระดับโทษ</th><th>หมายเหตุ</th></tr></thead>
                    <tbody>{sorted.map((record) => <tr key={record.id}><td className={styles.mutedCell}>{formatThaiDate(record.date)}</td><td><span className={styles.moderationCount}>{record.levelName}</span></td><td className={styles.mutedCell}>{record.note ?? '—'}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </Dialog.Body>
          <Dialog.Footer className={styles.modalFooter}>
            <Button className={styles.dialogGhostButton} onClick={onClose}>ปิด</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
