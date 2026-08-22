'use client'

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useRef, useState } from 'react'
import {
  clamp,
  normalizeElements,
  normalizeFocal,
  safeBackground,
  safeColor,
  type CmsElementType,
  type CmsItemConfig,
  type CmsVisualElement,
} from '@/lib/cms-config'
import styles from './CmsManager.module.css'

type DragState = {
  kind: 'move' | 'resize' | 'image'
  pointerId: number
  id?: string
  startX: number
  startY: number
  baseX: number
  baseY: number
  baseWidth?: number
  baseHeight?: number
  resizeDirection?: 'e' | 's' | 'se'
}

interface Props {
  config: CmsItemConfig
  imageUrl: string
  aspect: string
  allowSpecial?: boolean
  showSearchMock?: boolean
  onChange: (config: CmsItemConfig) => void
}

const typeLabels: Record<CmsElementType, string> = {
  badge: 'ป้าย', title: 'หัวข้อ', text: 'ข้อความ', button: 'ปุ่ม', votes: 'จำนวนโหวต', countdown: 'นับถอยหลัง',
}

function newElement(type: CmsElementType, index: number): CmsVisualElement {
  const text: Record<CmsElementType, string> = { badge: 'ป้าย', title: 'หัวข้อใหม่', text: 'ข้อความใหม่', button: 'อ่านเลย', votes: '12,450', countdown: '' }
  return {
    id: `${type}-${Date.now()}-${index}`,
    type,
    text: text[type],
    x: 10,
    y: Math.min(82, 12 + index * 9),
    scale: 1,
    color: type === 'badge' ? '#0e5f57' : '#ffffff',
    backgroundColor: type === 'button' ? '#14b8a6' : '#ffffff',
    bold: type === 'title' || type === 'button' || type === 'badge' || type === 'votes',
    shadow: type === 'title' || type === 'text' || type === 'votes',
    link: type === 'button' ? '' : undefined,
    width: type === 'button' ? 18 : undefined,
    height: type === 'button' ? 12 : undefined,
    offsetSeconds: type === 'countdown' ? 86400 : undefined,
  }
}

function countdownParts(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return { days, hours, minutes }
}

export function CmsVisualEditor({ config, imageUrl, aspect, allowSpecial, showSearchMock, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'elements' | 'image'>('elements')
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const elements = normalizeElements(config.elements)
  const focal = normalizeFocal(config.focal)
  const selected = elements.find((element) => element.id === selectedId) ?? null
  const stageImage = imageUrl

  function changeElements(next: CmsVisualElement[]) {
    onChange({ ...config, elements: next.slice(0, 14), focal })
  }

  function updateElement(id: string, patch: Partial<CmsVisualElement>) {
    changeElements(elements.map((element) => element.id === id ? { ...element, ...patch } : element))
  }

  function updateFocal(next: Partial<typeof focal>) {
    onChange({ ...config, elements, focal: { ...focal, ...next } })
  }

  function addElement(type: CmsElementType) {
    if (elements.length >= 14) return
    const element = newElement(type, elements.length)
    changeElements([...elements, element])
    setSelectedId(element.id)
    setMode('elements')
  }

  function removeSelected() {
    if (!selectedId) return
    changeElements(elements.filter((element) => element.id !== selectedId))
    setSelectedId(null)
  }

  function startElement(event: ReactPointerEvent, element: CmsVisualElement, kind: 'move' | 'resize', resizeDirection?: 'e' | 's' | 'se') {
    if (mode !== 'elements') return
    event.stopPropagation()
    event.preventDefault()
    setSelectedId(element.id)
    dragRef.current = {
      kind,
      pointerId: event.pointerId,
      id: element.id,
      startX: event.clientX,
      startY: event.clientY,
      baseX: element.x,
      baseY: element.y,
      baseWidth: element.width ?? 18,
      baseHeight: element.height ?? 12,
      resizeDirection,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function startImage(event: ReactPointerEvent<HTMLDivElement>) {
    if (mode !== 'image' || !stageImage) {
      if (event.target === event.currentTarget) setSelectedId(null)
      return
    }
    event.preventDefault()
    dragRef.current = { kind: 'image', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: focal.x, baseY: focal.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const rect = stageRef.current?.getBoundingClientRect()
    if (!drag || !rect || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const dx = (event.clientX - drag.startX) / rect.width * 100
    const dy = (event.clientY - drag.startY) / rect.height * 100
    if (drag.kind === 'image') {
      updateFocal({ x: clamp(drag.baseX - dx, 50, 0, 100), y: clamp(drag.baseY - dy, 50, 0, 100) })
      return
    }
    if (!drag.id) return
    if (drag.kind === 'move') updateElement(drag.id, { x: clamp(drag.baseX + dx, 0, 0, 94), y: clamp(drag.baseY + dy, 0, 0, 94) })
    if (drag.kind === 'resize') {
      const patch: Partial<CmsVisualElement> = {}
      if (drag.resizeDirection === 'e' || drag.resizeDirection === 'se') patch.width = clamp((drag.baseWidth ?? 18) + dx, 18, 8, 100 - drag.baseX)
      if (drag.resizeDirection === 's' || drag.resizeDirection === 'se') patch.height = clamp((drag.baseHeight ?? 12) + dy, 12, 4, 100 - drag.baseY)
      updateElement(drag.id, patch)
    }
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  function elementStyle(element: CmsVisualElement): CSSProperties {
    const style: CSSProperties = {
      left: `${element.x}%`, top: `${element.y}%`, color: element.color,
      fontWeight: element.bold ? 800 : 500,
      textShadow: element.shadow ? '0 1px 6px rgba(0,0,0,.48)' : 'none',
    }
    if (element.type === 'button') {
      style.width = `${element.width ?? 18}%`
      style.height = `${element.height ?? 12}%`
      style.background = element.backgroundColor
      style.fontSize = `${12.5 * element.scale}px`
    } else {
      style.transform = `scale(${element.scale})`
      style.background = element.type === 'badge' ? element.backgroundColor : undefined
    }
    return style
  }

  return (
    <div className={styles.visualEditor}>
      <div className={styles.editorHead}>
        <strong>ตัวอย่าง &amp; จัดวาง</strong>
        <div className={styles.editorSegments}>
          <button type="button" className={mode === 'elements' ? styles.segmentActive : ''} onClick={() => setMode('elements')}>จัดวางข้อความ</button>
          <button type="button" disabled={!stageImage} className={mode === 'image' ? styles.segmentActive : ''} onClick={() => setMode('image')}>ปรับตำแหน่งรูป</button>
        </div>
      </div>

      {mode === 'elements' && (
        <div className={styles.addElements}>
          <span>เพิ่ม:</span>
          {(['title', 'text', 'button', 'badge', ...(allowSpecial ? ['votes', 'countdown'] : [])] as CmsElementType[]).map((type) => <button type="button" key={type} disabled={elements.length >= 14} onClick={() => addElement(type)}>+ {type === 'text' ? 'เนื้อหา' : type === 'votes' ? 'ผู้โหวต' : type === 'countdown' ? 'เวลานับถอยหลัง' : typeLabels[type]}</button>)}
        </div>
      )}

      <div
        ref={stageRef}
        className={`${styles.editorStage} ${mode === 'image' ? styles.imageMode : ''}`}
        style={{ aspectRatio: aspect, background: safeBackground(config.background, '#27312f') }}
        onPointerDown={startImage}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {stageImage && <div className={styles.stageImage} style={{ backgroundImage: `url(${stageImage})`, backgroundPosition: `${focal.x}% ${focal.y}%`, transform: `scale(${focal.zoom / 100})` }} />}
        <div className={styles.stageScrim} />
        {elements.map((element) => (
          <div
            key={element.id}
            data-element-id={element.id}
            className={`${styles.visualElement} ${styles[`element${element.type[0].toUpperCase()}${element.type.slice(1)}`]} ${selectedId === element.id ? styles.selectedElement : ''}`}
            style={elementStyle(element)}
            onPointerDown={(event) => startElement(event, element, 'move')}
          >
            {element.type === 'countdown' ? (() => { const part = countdownParts(element.offsetSeconds ?? 0); return <><span>{String(part.days).padStart(2, '0')}<i>วัน</i></span><span>{String(part.hours).padStart(2, '0')}<i>ชม.</i></span><span>{String(part.minutes).padStart(2, '0')}<i>นาที</i></span></> })() : element.text || typeLabels[element.type]}
            {element.type === 'button' && selectedId === element.id && <><button type="button" aria-label="ปรับความกว้างปุ่ม" className={`${styles.resizeHandle} ${styles.resizeEast}`} onPointerDown={(event) => startElement(event, element, 'resize', 'e')} /><button type="button" aria-label="ปรับความสูงปุ่ม" className={`${styles.resizeHandle} ${styles.resizeSouth}`} onPointerDown={(event) => startElement(event, element, 'resize', 's')} /><button type="button" aria-label="ปรับขนาดปุ่ม" className={`${styles.resizeHandle} ${styles.resizeCorner}`} onPointerDown={(event) => startElement(event, element, 'resize', 'se')} /></>}
          </div>
        ))}
        {showSearchMock && <div className={styles.searchMock}><span>⌕</span><b>ค้นหานิยาย นักเขียน เว็บตูน หนังสือเสียง…</b><i>⌕</i></div>}
        {mode === 'image' && <span className={styles.imageHint}>ลากเพื่อจัดตำแหน่งภาพ</span>}
      </div>

      {mode === 'image' ? (
        <div className={styles.editorTools}>
          <label>ซูมรูป <input type="range" min={100} max={260} value={focal.zoom} onChange={(event) => updateFocal({ zoom: Number(event.target.value) })} /><span>{Math.round(focal.zoom)}%</span></label>
        </div>
      ) : selected ? (
        <div className={styles.selectedTools}>
          {selected.type !== 'countdown' ? <label className={styles.growTool}><input aria-label="ข้อความ" placeholder="ข้อความ" value={selected.text} onChange={(event) => updateElement(selected.id, { text: event.target.value.slice(0, 500) })} /></label> : (() => { const part = countdownParts(selected.offsetSeconds ?? 0); const setPart = (key: keyof typeof part, value: number) => updateElement(selected.id, { offsetSeconds: (key === 'days' ? value : part.days) * 86400 + (key === 'hours' ? value : part.hours) * 3600 + (key === 'minutes' ? value : part.minutes) * 60 }); return <div className={styles.countdownControl}><b>เหลือเวลา</b><input aria-label="วัน" type="number" min={0} value={part.days} onChange={(event) => setPart('days', Number(event.target.value))} /><span>วัน</span><input aria-label="ชั่วโมง" type="number" min={0} value={part.hours} onChange={(event) => setPart('hours', Number(event.target.value))} /><span>ชม.</span><input aria-label="นาที" type="number" min={0} value={part.minutes} onChange={(event) => setPart('minutes', Number(event.target.value))} /><span>นาที</span></div> })()}
          <label>ขนาด <input type="range" min={50} max={240} value={Math.round(selected.scale * 100)} onChange={(event) => updateElement(selected.id, { scale: Number(event.target.value) / 100 })} /></label>
          <label>สีข้อความ<input type="color" value={safeColor(selected.color)} onChange={(event) => updateElement(selected.id, { color: event.target.value })} /></label>
          {(selected.type === 'badge' || selected.type === 'button') && <label>สีพื้น<input type="color" value={safeColor(selected.backgroundColor)} onChange={(event) => updateElement(selected.id, { backgroundColor: event.target.value })} /></label>}
          {selected.type === 'button' && <label className={styles.growTool}>ลิงก์<input value={selected.link ?? ''} onChange={(event) => updateElement(selected.id, { link: event.target.value.slice(0, 1000) })} /></label>}
          {(selected.type === 'title' || selected.type === 'text' || selected.type === 'votes') && <><label className={styles.toggleTool}>เงา<button type="button" className={selected.shadow ? styles.toggleActive : ''} onClick={() => updateElement(selected.id, { shadow: !selected.shadow })}>{selected.shadow ? 'เปิด' : 'ปิด'}</button></label><label className={styles.toggleTool}>ตัวหนา<button type="button" className={selected.bold ? styles.toggleActive : ''} onClick={() => updateElement(selected.id, { bold: !selected.bold })}>{selected.bold ? 'เปิด' : 'ปิด'}</button></label></>}
          <button type="button" className={styles.deleteTool} onClick={removeSelected}>ลบชิ้นนี้</button>
        </div>
      ) : <div className={styles.editorHint}>แตะชิ้นในภาพเพื่อแก้ไข หรือกด “เพิ่ม” ด้านบนเพื่อใส่ชิ้นใหม่</div>}
      <div className={styles.editorFoot}><button type="button" className={styles.toolButton} onClick={() => { if (window.confirm('ล้างทุกชิ้นและเริ่มใหม่?')) { const resetElement = newElement('title', 0); resetElement.text = 'หัวข้อ'; resetElement.x = 5; resetElement.y = 40; onChange({ ...config, elements: [resetElement], focal: { x: 50, y: 50, zoom: 100 } }); setSelectedId(null) } }}>รีเซ็ตทั้งหมด</button><span>เพิ่มหัวข้อหลายชิ้นเพื่อทำสองสี/เล็กใหญ่ผสมกัน · ลากวางได้อิสระ · เลือกปุ่มแล้วลากมือจับที่ขอบ/มุมเพื่อปรับกว้าง–สูง</span></div>
    </div>
  )
}
