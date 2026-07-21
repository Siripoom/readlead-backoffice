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
}

interface Props {
  config: CmsItemConfig
  imageUrl: string
  mobileImageUrl: string
  aspect: string
  allowSpecial?: boolean
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

function countdownLabel(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${String(days).padStart(2, '0')} วัน · ${String(hours).padStart(2, '0')} ชม. · ${String(minutes).padStart(2, '0')} นาที`
}

export function CmsVisualEditor({ config, imageUrl, mobileImageUrl, aspect, allowSpecial, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'elements' | 'image'>('elements')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const elements = normalizeElements(config.elements)
  const focal = normalizeFocal(config.focal)
  const selected = elements.find((element) => element.id === selectedId) ?? null
  const stageImage = device === 'mobile' ? mobileImageUrl || imageUrl : imageUrl

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

  function startElement(event: ReactPointerEvent, element: CmsVisualElement, kind: 'move' | 'resize') {
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
    if (drag.kind === 'resize') updateElement(drag.id, { width: clamp((drag.baseWidth ?? 18) + dx, 18, 8, 100 - drag.baseX), height: clamp((drag.baseHeight ?? 12) + dy, 12, 4, 100 - drag.baseY) })
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
        <strong>จัดวางองค์ประกอบ</strong>
        <div className={styles.editorSegments}>
          <button type="button" className={mode === 'elements' ? styles.segmentActive : ''} onClick={() => setMode('elements')}>ข้อความ</button>
          <button type="button" disabled={!stageImage} className={mode === 'image' ? styles.segmentActive : ''} onClick={() => setMode('image')}>ตำแหน่งภาพ</button>
        </div>
        <div className={styles.editorSegments}>
          <button type="button" className={device === 'desktop' ? styles.segmentActive : ''} onClick={() => setDevice('desktop')}>Desktop</button>
          <button type="button" className={device === 'mobile' ? styles.segmentActive : ''} onClick={() => setDevice('mobile')}>Mobile</button>
        </div>
      </div>

      {mode === 'elements' && (
        <div className={styles.addElements}>
          <span>เพิ่ม:</span>
          {(['badge', 'title', 'text', 'button', ...(allowSpecial ? ['votes', 'countdown'] : [])] as CmsElementType[]).map((type) => <button type="button" key={type} disabled={elements.length >= 14} onClick={() => addElement(type)}>+ {typeLabels[type]}</button>)}
          <em>{elements.length}/14</em>
        </div>
      )}

      <div
        ref={stageRef}
        className={`${styles.editorStage} ${mode === 'image' ? styles.imageMode : ''}`}
        style={{ aspectRatio: device === 'mobile' ? '750 / 700' : aspect, background: safeBackground(config.background, '#27312f') }}
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
            {element.type === 'countdown' ? countdownLabel(element.offsetSeconds ?? 0) : element.text || typeLabels[element.type]}
            {element.type === 'button' && selectedId === element.id && <button type="button" aria-label="ปรับขนาดปุ่ม" className={styles.resizeHandle} onPointerDown={(event) => startElement(event, element, 'resize')} />}
          </div>
        ))}
        {mode === 'image' && <span className={styles.imageHint}>ลากเพื่อจัดตำแหน่งภาพ</span>}
      </div>

      {mode === 'image' ? (
        <div className={styles.editorTools}>
          <label>ซูมภาพ <input type="range" min={100} max={240} value={focal.zoom} onChange={(event) => updateFocal({ zoom: Number(event.target.value) })} /><span>{Math.round(focal.zoom)}%</span></label>
          <button type="button" className={styles.toolButton} onClick={() => updateFocal({ x: 50, y: 50, zoom: 100 })}>รีเซ็ตภาพ</button>
        </div>
      ) : selected ? (
        <div className={styles.selectedTools}>
          {selected.type !== 'countdown' ? <label className={styles.growTool}>ข้อความ<input value={selected.text} onChange={(event) => updateElement(selected.id, { text: event.target.value.slice(0, 500) })} /></label> : <label className={styles.growTool}>เวลานับถอยหลัง (วินาที)<input type="number" min={0} max={31536000} value={selected.offsetSeconds ?? 0} onChange={(event) => updateElement(selected.id, { offsetSeconds: Number(event.target.value) })} /></label>}
          <label>ขนาด <input type="range" min={50} max={240} value={Math.round(selected.scale * 100)} onChange={(event) => updateElement(selected.id, { scale: Number(event.target.value) / 100 })} /></label>
          <label>สีข้อความ<input type="color" value={safeColor(selected.color)} onChange={(event) => updateElement(selected.id, { color: event.target.value })} /></label>
          {(selected.type === 'badge' || selected.type === 'button') && <label>สีพื้น<input type="color" value={safeColor(selected.backgroundColor)} onChange={(event) => updateElement(selected.id, { backgroundColor: event.target.value })} /></label>}
          {selected.type === 'button' && <label className={styles.growTool}>ลิงก์<input value={selected.link ?? ''} onChange={(event) => updateElement(selected.id, { link: event.target.value.slice(0, 1000) })} /></label>}
          <label className={styles.checkTool}><input type="checkbox" checked={selected.bold ?? false} onChange={(event) => updateElement(selected.id, { bold: event.target.checked })} /> ตัวหนา</label>
          <label className={styles.checkTool}><input type="checkbox" checked={selected.shadow ?? false} onChange={(event) => updateElement(selected.id, { shadow: event.target.checked })} /> เงา</label>
          <button type="button" className={styles.deleteTool} onClick={removeSelected}>ลบชิ้นนี้</button>
        </div>
      ) : <div className={styles.editorHint}>คลิกชิ้นงานเพื่อแก้ไข แล้วลากไปยังตำแหน่งที่ต้องการ</div>}
    </div>
  )
}
