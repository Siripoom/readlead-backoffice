'use client'

import { Button, Dialog, NativeSelect } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import type { PunishmentLevel } from '@/lib/mock-data/punishment'
import styles from '@/components/users/UsersPanel.module.css'

interface Props {
  open: boolean
  targetName: string
  onClose: () => void
  onConfirm: (level: PunishmentLevel, note: string) => void
}

function durationLabel(days: number) {
  return days === 0 ? 'ถาวร' : `${days} วัน`
}

export function PunishmentDialog({ open, targetName, onClose, onConfirm }: Props) {
  const [levels, setLevels] = useState<PunishmentLevel[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    fetch('/api/punishment/levels')
      .then((response) => response.json())
      .then((data: PunishmentLevel[]) => {
        setLevels(data)
        setSelectedId(data[0]?.id ?? '')
      })
  }, [])

  const selectedLevel = levels.find((level) => level.id === selectedId) ?? levels[0]

  function handleConfirm() {
    const trimmedNote = note.trim()
    if (!selectedLevel || !trimmedNote) return
    onConfirm(selectedLevel, trimmedNote)
    setSelectedId(levels[0]?.id ?? '')
    setNote('')
  }

  function handleClose() {
    setSelectedId(levels[0]?.id ?? '')
    setNote('')
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(event) => { if (!event.open) handleClose() }}>
      <Dialog.Backdrop className={styles.modalBackdrop} />
      <Dialog.Positioner className={styles.modalPositioner}>
        <Dialog.Content className={styles.modalContent}>
          <Dialog.Header className={styles.modalHeader}>
            <Dialog.Title className={styles.modalTitle}>ลงโทษผู้ใช้</Dialog.Title>
            <Dialog.CloseTrigger className={styles.modalClose} />
          </Dialog.Header>
          <Dialog.Body className={styles.modalBody}>
            <div className={styles.detailList}>
              <div className={styles.dialogNotice}>เป้าหมาย: <strong>{targetName}</strong></div>
              <label>
                <span className={styles.fieldLabel}>เลือกระดับลงโทษ</span>
                <NativeSelect.Root>
                  <NativeSelect.Field className={styles.fieldInput} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    {levels.map((level) => <option key={level.id} value={level.id}>ระดับ {level.level} — {level.name} ({durationLabel(level.duration)})</option>)}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </label>
              <label>
                <span className={styles.fieldLabel}>เหตุผลการลงโทษ</span>
                <textarea className={styles.fieldInput} value={note} onChange={(event) => setNote(event.target.value)} rows={3} required />
              </label>
              {selectedLevel && <div className={styles.dialogSummary}><div>ระยะเวลา: <strong>{durationLabel(selectedLevel.duration)}</strong></div><div>เงื่อนไข: ผิดกฎครั้งที่ {selectedLevel.threshold} ขึ้นไป</div></div>}
            </div>
          </Dialog.Body>
          <Dialog.Footer className={styles.modalFooter}>
            <Button className={styles.dialogGhostButton} onClick={handleClose}>ยกเลิก</Button>
            <Button className={styles.dialogDangerButton} onClick={handleConfirm} disabled={!selectedLevel || !note.trim()}>ยืนยันการลงโทษ</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
