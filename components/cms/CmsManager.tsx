'use client'

import { Dialog, Image } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CmsVisualEditor } from '@/components/cms/CmsVisualEditor'
import {
  asItemConfig,
  asSectionConfig,
  CMS_PAGE_SECTIONS,
  legacyProjection,
  modernizeItemConfig,
  normalizeElements,
  starterElements,
  type CmsItemConfig,
  type CmsPageSlug,
  type CmsSectionConfig,
  type CmsSectionDefinition,
} from '@/lib/cms-config'
import { toaster } from '@/lib/toaster'
import styles from './CmsManager.module.css'

type Item = {
  id: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  linkUrl?: string | null
  enabled: boolean
  sortOrder: number
  config?: unknown
}

type Section = { id: string; key: string; title: string; enabled: boolean; config?: unknown; items: Item[] }
type CmsPage = { id: string; slug: CmsPageSlug; label: string; slideSeconds: number; sections: Section[] }
type EditorContext = { section: Section; definition: CmsSectionDefinition; item: Item | null; variant: string; column: number; slot?: number }
type FormState = {
  title: string
  subtitle: string
  imageUrl: string
  mobileImageUrl: string
  linkUrl: string
  enabled: boolean
  config: CmsItemConfig
  discount: string
  countdownDays: number
  countdownHours: number
}

type CatalogWork = {
  id: string
  type: 'novel' | 'manga' | 'audiobook'
  title: string
  tagline: string | null
  views: number
  creator: { name: string; writerApplication: { penName: string } | null }
  _count: { episodes: number }
}

const pages: Array<{ slug: CmsPageSlug; label: string }> = [
  { slug: 'home', label: 'หน้าหลัก' }, { slug: 'novel', label: 'นิยาย' },
  { slug: 'manga', label: 'เว็บตูน' }, { slug: 'audio', label: 'หนังสือเสียง' },
]

const columnLabels = ['คอลัมน์ซ้าย', 'คอลัมน์กลาง', 'คอลัมน์ขวา', 'คอลัมน์ 4']

function itemVariant(sectionKey: string, item: Item) {
  const config = asItemConfig(item.config)
  if (typeof config.variant === 'string') return config.variant
  if (['sale', 'recommend', 'web-books'].includes(sectionKey)) return 'book'
  if (sectionKey === 'web-coverflow') return 'cover'
  return 'default'
}

function itemColumn(item: Item) {
  const column = Number(asItemConfig(item.config).column)
  return Number.isInteger(column) && column >= 0 ? column : 0
}

function itemSlot(item: Item) {
  const slot = Number(asItemConfig(item.config).slot)
  return Number.isInteger(slot) && slot >= 0 ? slot : undefined
}

function sourceMatches(item: Item, mode: string) {
  const generated = asItemConfig(item.config).source === 'generated'
  return mode === 'manual' ? !generated : generated
}

function emptyForm(context: Omit<EditorContext, 'item'>): FormState {
  const visual = !['book'].includes(context.definition.kind) && context.variant !== 'book' && context.variant !== 'cover'
  const title = context.variant === 'main' ? 'แนะนำโดยเว็บ' : 'หัวข้อแบนเนอร์'
  return {
    title,
    subtitle: '',
    imageUrl: '',
    mobileImageUrl: '',
    linkUrl: '',
    enabled: true,
    config: {
      variant: context.variant,
      column: context.column,
      slot: context.slot,
      source: 'manual',
      background: '#27312f',
      focal: { x: 50, y: 50, zoom: 100 },
      elements: visual ? starterElements(title, '', '', 'อ่านเลย') : [],
    },
    discount: '-30%',
    countdownDays: 0,
    countdownHours: 0,
  }
}

function SectionToggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return <label className={styles.toggle}><span>{enabled ? 'เปิด' : 'ปิด'}</span><input type="checkbox" checked={enabled} onChange={onChange} /><i /></label>
}

function BookPicker({ page, selectedId, onSelect }: { page: CmsPageSlug; selectedId?: string; onSelect: (work: CatalogWork) => void }) {
  const defaultType = page === 'audio' ? 'audiobook' : page === 'manga' ? 'manga' : page === 'novel' ? 'novel' : ''
  const [query, setQuery] = useState('')
  const [type, setType] = useState(defaultType)
  const [items, setItems] = useState<CatalogWork[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ pageSize: '50' })
        if (query.trim()) params.set('query', query.trim())
        if (type) params.set('type', type)
        const response = await fetch(`/api/public/catalog/works?${params}`, { signal: controller.signal })
        if (response.ok) setItems((await response.json()).items ?? [])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, type])

  return <div className={styles.bookPicker}>
    <div className={styles.bookSearch}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อเรื่องหรือนักเขียน" /><select value={type} onChange={(event) => setType(event.target.value)}><option value="">ทุกประเภท</option><option value="novel">นิยาย</option><option value="manga">เว็บตูน</option><option value="audiobook">หนังสือเสียง</option></select></div>
    <div className={styles.bookResults}>
      {loading && <div className={styles.empty}>กำลังค้นหา…</div>}
      {!loading && items.length === 0 && <div className={styles.empty}>ไม่พบเรื่องที่ค้นหา</div>}
      {!loading && items.map((work) => {
        const creator = work.creator.writerApplication?.penName || work.creator.name
        return <button type="button" key={work.id} className={selectedId === work.id ? styles.selectedBook : ''} onClick={() => onSelect(work)}><Image src={`/api/public/catalog/works/${work.id}/cover`} alt="" /><span><b>{work.title}</b><small>{creator} · {work._count.episodes} ตอน · {work.views.toLocaleString('th-TH')} วิว</small></span>{selectedId === work.id && <em>✓</em>}</button>
      })}
    </div>
  </div>
}

export function CmsManager() {
  const [slug, setSlug] = useState<CmsPageSlug>('home')
  const [data, setData] = useState<CmsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editor, setEditor] = useState<EditorContext | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await fetch(`/api/cms?page=${slug}`)
      if (!response.ok) throw new Error()
      setData(await response.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [slug])

  // Loading the selected page is the external synchronization owned by this component.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const sections = useMemo(() => {
    const byKey = new Map((data?.sections ?? []).map((section) => [section.key, section]))
    return CMS_PAGE_SECTIONS[slug].flatMap((definition) => {
      const section = byKey.get(definition.key)
      return section ? [{ definition, section }] : []
    })
  }, [data, slug])

  async function patch(body: object) {
    const response = await fetch('/api/cms', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'บันทึกไม่สำเร็จ')
  }

  async function toggleSection(target: Section) {
    const enabled = !target.enabled
    setData((page) => page ? { ...page, sections: page.sections.map((section) => section.id === target.id ? { ...section, enabled } : section) } : page)
    try {
      await patch({ type: 'section', id: target.id, enabled })
      toaster.success({ title: 'บันทึกอัตโนมัติแล้ว' })
    } catch {
      await load()
      toaster.error({ title: 'บันทึกไม่สำเร็จ' })
    }
  }

  async function saveSectionConfig(target: Section, config: CmsSectionConfig) {
    setData((page) => page ? { ...page, sections: page.sections.map((section) => section.id === target.id ? { ...section, config } : section) } : page)
    try {
      await patch({ type: 'section', id: target.id, config })
      toaster.success({ title: 'บันทึกอัตโนมัติแล้ว' })
    } catch {
      await load()
      toaster.error({ title: 'บันทึกไม่สำเร็จ' })
    }
  }

  function open(target: Section, definition: CmsSectionDefinition, options: { item?: Item; variant?: string; column?: number; slot?: number } = {}) {
    const context: EditorContext = { section: target, definition, item: options.item ?? null, variant: options.variant ?? 'default', column: options.column ?? 0, slot: options.slot }
    setEditor(context)
    if (!options.item) {
      setForm(emptyForm(context))
      return
    }
    const raw = modernizeItemConfig(options.item.config, options.item)
    const config: CmsItemConfig = { ...raw, variant: options.variant ?? itemVariant(target.key, options.item), column: options.column ?? itemColumn(options.item), slot: options.slot ?? itemSlot(options.item), source: raw.source === 'generated' ? 'generated' : 'manual' }
    const seconds = Number(config.countdownSeconds) || 0
    setForm({
      title: options.item.title,
      subtitle: options.item.subtitle ?? '',
      imageUrl: options.item.imageUrl ?? '',
      mobileImageUrl: typeof config.mobileImageUrl === 'string' ? config.mobileImageUrl : '',
      linkUrl: options.item.linkUrl ?? '',
      enabled: options.item.enabled,
      config,
      discount: typeof config.discount === 'string' ? config.discount : '-30%',
      countdownDays: Math.floor(seconds / 86400),
      countdownHours: Math.floor((seconds % 86400) / 3600),
    })
  }

  function close() {
    if (saving || uploading) return
    setEditor(null)
    setForm(null)
  }

  function visualChange(config: CmsItemConfig) {
    setForm((current) => {
      if (!current) return current
      const elements = normalizeElements(config.elements)
      const title = elements.find((element) => element.type === 'title')?.text || elements.find((element) => element.text)?.text || current.title
      const subtitle = elements.find((element) => element.type === 'text')?.text ?? current.subtitle
      const linkUrl = elements.find((element) => element.type === 'button')?.link ?? current.linkUrl
      return { ...current, title, subtitle, linkUrl, config }
    })
  }

  async function upload(file: File, target: 'desktop' | 'mobile') {
    if (!form) return
    setUploading(true)
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch('/api/cms/upload', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setForm((current) => current ? { ...current, [target === 'desktop' ? 'imageUrl' : 'mobileImageUrl']: result.url } : current)
    } catch (uploadError) {
      toaster.error({ title: uploadError instanceof Error ? uploadError.message : 'อัปโหลดไม่สำเร็จ' })
    } finally {
      setUploading(false)
    }
  }

  function selectBook(work: CatalogWork) {
    setForm((current) => current ? {
      ...current,
      title: work.title,
      subtitle: work.tagline || `${work.creator.writerApplication?.penName || work.creator.name} · ${work._count.episodes} ตอน`,
      imageUrl: `/api/public/catalog/works/${work.id}/cover`,
      linkUrl: `/works/${work.id}`,
      config: { ...current.config, bookId: work.id, workType: work.type, source: 'manual', variant: 'book' },
    } : current)
  }

  function editorKind() {
    if (!editor) return 'visual'
    if (editor.definition.kind === 'book' || editor.variant === 'book') return 'book'
    if (editor.variant === 'cover') return 'cover'
    return 'visual'
  }

  async function save() {
    if (!editor || !form || !form.title.trim()) return
    const kind = editorKind()
    if ((editor.section.key === 'hero' || kind === 'cover') && !form.imageUrl.trim()) return
    setSaving(true)
    try {
      const config: CmsItemConfig = {
        ...form.config,
        variant: editor.variant,
        column: editor.column,
        slot: editor.slot,
        source: form.config.source === 'generated' ? 'generated' : 'manual',
        mobileImageUrl: form.mobileImageUrl,
        discount: form.discount,
        countdownSeconds: Math.max(0, form.countdownDays * 86400 + form.countdownHours * 3600),
      }
      Object.assign(config, legacyProjection(config))
      const payload = { title: form.title.trim(), subtitle: form.subtitle, imageUrl: form.imageUrl, linkUrl: form.linkUrl, enabled: form.enabled, config }
      const response = await fetch('/api/cms', {
        method: editor.item ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editor.item ? { type: 'item', id: editor.item.id, ...payload } : { sectionId: editor.section.id, ...payload }),
      })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'บันทึกไม่สำเร็จ')
      close()
      await load()
      toaster.success({ title: 'บันทึกแล้ว' })
    } catch (saveError) {
      toaster.error({ title: saveError instanceof Error ? saveError.message : 'บันทึกไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Item) {
    if (!window.confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return
    try {
      const response = await fetch(`/api/cms?id=${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'ลบไม่สำเร็จ')
      await load()
      toaster.success({ title: 'ลบแล้ว' })
    } catch (removeError) {
      toaster.error({ title: removeError instanceof Error ? removeError.message : 'ลบไม่สำเร็จ' })
    }
  }

  async function move(group: Item[], index: number, delta: number) {
    const destination = index + delta
    if (!group[destination]) return
    const reordered = [...group]
    ;[reordered[index], reordered[destination]] = [reordered[destination], reordered[index]]
    try {
      await patch({ type: 'items-order', orders: reordered.map((item, sortOrder) => ({ id: item.id, sortOrder })) })
      await load()
    } catch {
      toaster.error({ title: 'จัดลำดับไม่สำเร็จ' })
    }
  }

  async function saveSlideSeconds() {
    if (!data) return
    const slideSeconds = Math.min(60, Math.max(1, data.slideSeconds || 5))
    setData({ ...data, slideSeconds })
    try {
      await patch({ type: 'page', id: data.id, slideSeconds })
      toaster.success({ title: 'บันทึกอัตโนมัติแล้ว' })
    } catch {
      toaster.error({ title: 'บันทึกไม่สำเร็จ' })
    }
  }

  async function setMode(target: Section, mode: 'manual' | 'popular' | 'random') {
    const config = { ...asSectionConfig(target.config), mode }
    if (mode === 'manual') {
      await saveSectionConfig(target, config)
      return
    }
    await generate(target, mode)
  }

  async function generate(target: Section, mode: 'popular' | 'random') {
    setGenerating(target.id)
    try {
      const response = await fetch('/api/cms/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sectionId: target.id, mode }) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'สร้างรายการไม่สำเร็จ')
      await load()
      toaster.success({ title: mode === 'popular' ? 'ดึงรายการยอดนิยมแล้ว' : 'สุ่มรายการใหม่แล้ว' })
    } catch (generateError) {
      toaster.error({ title: generateError instanceof Error ? generateError.message : 'สร้างรายการไม่สำเร็จ' })
    } finally {
      setGenerating(null)
    }
  }

  function groupItems(target: Section, variant: string, column = 0, slot?: number) {
    return target.items.filter((item) => itemVariant(target.key, item) === variant && itemColumn(item) === column && (slot === undefined || itemSlot(item) === slot)).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  }

  function ItemCard({ target, definition, item, group, index, editable = true }: { target: Section; definition: CmsSectionDefinition; item: Item; group: Item[]; index: number; editable?: boolean }) {
    const config = asItemConfig(item.config)
    return <article className={styles.item}><div className={`${styles.thumb} ${!item.imageUrl ? styles.noImage : ''}`} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}>{!item.imageUrl && 'รูปภาพ'}</div><div className={styles.itemBody}><b>{item.title}</b><span>{item.subtitle || item.linkUrl || 'ไม่มีคำอธิบาย'}</span><div className={styles.itemMeta}><em className={item.enabled ? styles.enabled : styles.disabled}>{item.enabled ? 'เปิด' : 'ปิด'}</em>{config.source === 'generated' && <em className={styles.generated}>อัตโนมัติ</em>}</div></div>{editable && <div className={styles.itemActions}><button type="button" disabled={index === 0} aria-label="เลื่อนขึ้น" onClick={() => void move(group, index, -1)}>↑</button><button type="button" disabled={index === group.length - 1} aria-label="เลื่อนลง" onClick={() => void move(group, index, 1)}>↓</button><button type="button" onClick={() => open(target, definition, { item, variant: itemVariant(target.key, item), column: itemColumn(item), slot: itemSlot(item) })}>แก้ไข</button><button type="button" className={styles.delete} onClick={() => void remove(item)}>ลบ</button></div>}</article>
  }

  function ItemList({ target, definition, variant = 'default', column = 0, slot, items, editable = true }: { target: Section; definition: CmsSectionDefinition; variant?: string; column?: number; slot?: number; items?: Item[]; editable?: boolean }) {
    const group = items ?? groupItems(target, variant, column, slot)
    return <div className={`${styles.itemList} ${variant === 'book' ? styles.bookGrid : ''}`}>{group.length === 0 && <div className={styles.empty}>ยังไม่มีรายการในส่วนนี้</div>}{group.map((item, index) => <ItemCard key={item.id} target={target} definition={definition} item={item} group={group} index={index} editable={editable} />)}</div>
  }

  function ModeControl({ target }: { target: Section }) {
    const mode = asSectionConfig(target.config).mode ?? 'manual'
    return <div className={styles.modeBlock}><div className={styles.modeChoices}>{(['manual', 'popular', 'random'] as const).map((value) => <label key={value}><input type="radio" checked={mode === value} onChange={() => void setMode(target, value)} /><span>{value === 'manual' ? 'เลือกเอง' : value === 'popular' ? 'อัตโนมัติ — คนอ่านมากสุด' : 'อัตโนมัติ — สุ่ม'}</span></label>)}</div>{mode !== 'manual' && <button type="button" className={styles.smallButton} disabled={generating === target.id} onClick={() => void generate(target, mode)}>{generating === target.id ? 'กำลังสร้าง…' : mode === 'popular' ? '↻ ดึงใหม่' : '⇄ สุ่มใหม่'}</button>}</div>
  }

  function PanelHead({ target, definition, action }: { target: Section; definition: CmsSectionDefinition; action?: ReactNode }) {
    return <div className={styles.panelHead}><div><h2>{definition.title}</h2><small>{target.items.length} รายการ</small></div><div className={styles.panelActions}>{action}<SectionToggle enabled={target.enabled} onChange={() => void toggleSection(target)} /></div></div>
  }

  function renderVisualPanel(target: Section, definition: CmsSectionDefinition) {
    if (definition.kind === 'fixed') {
      const sectionConfig = asSectionConfig(target.config)
      const slotEnabled = sectionConfig.slotEnabled ?? {}
      return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} /><div className={styles.fixedGrid}>{Array.from({ length: 4 }, (_, slot) => { const item = groupItems(target, 'default', slot, slot)[0]; const enabled = slotEnabled[String(slot)] !== false; return <div className={styles.fixedSlot} key={slot}><div className={styles.columnHead}><span>ช่อง {slot + 1} · 276×130</span><SectionToggle enabled={enabled} onChange={() => void saveSectionConfig(target, { ...sectionConfig, slotEnabled: { ...slotEnabled, [slot]: !enabled } })} /></div>{item ? <ItemList target={target} definition={definition} column={slot} slot={slot} items={[item]} /> : <button type="button" className={styles.slotButton} onClick={() => open(target, definition, { column: slot, slot })}>＋ แก้ไขช่องนี้</button>}</div> })}</div><div className={styles.hint}>ปิดได้รายช่องหรือทั้งแถว · ปิด/ว่างทุกช่อง = ซ่อนทั้งแถว</div></section>
    }
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} action={definition.columns === 1 ? <button type="button" className={styles.addButton} disabled={groupItems(target, 'default').length >= 10} title={groupItems(target, 'default').length >= 10 ? 'ครบ 10 รายการแล้ว' : undefined} onClick={() => open(target, definition)}>＋ {definition.addLabel}</button> : undefined} />{definition.hint && <div className={styles.hint}>{definition.hint}</div>}<div className={definition.columns > 1 ? `${styles.columns} ${styles[`columns${definition.columns}`]}` : ''}>{Array.from({ length: definition.columns }, (_, column) => { const full = groupItems(target, 'default', column).length >= 10; return <div key={column}>{definition.columns > 1 && <div className={styles.columnHead}><span>{columnLabels[column]}</span><button type="button" className={styles.smallButton} disabled={full} title={full ? 'ครบ 10 รายการแล้ว' : undefined} onClick={() => open(target, definition, { column })}>＋ เพิ่ม</button></div>}<ItemList target={target} definition={definition} column={column} /></div> })}</div></section>
  }

  function renderBookPanel(target: Section, definition: CmsSectionDefinition) {
    const mode = definition.key === 'web-books' ? asSectionConfig(target.config).mode ?? 'manual' : 'manual'
    const items = groupItems(target, 'book').filter((item) => sourceMatches(item, mode))
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} action={mode === 'manual' ? <button type="button" className={styles.addButton} onClick={() => open(target, definition, { variant: 'book' })}>＋ เพิ่มเรื่อง</button> : undefined} />{definition.key === 'web-books' && <ModeControl target={target} />}<ItemList target={target} definition={definition} variant="book" items={items} editable={mode === 'manual'} /></section>
  }

  function renderRecommendPanel(target: Section, definition: CmsSectionDefinition) {
    const mode = asSectionConfig(target.config).mode ?? 'manual'
    const books = groupItems(target, 'book').filter((item) => sourceMatches(item, mode))
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} /><div className={styles.columnHead}><span>แบนเนอร์ (ซ้าย / กลาง / ขวา)</span></div><div className={`${styles.columns} ${styles.columns3}`}>{Array.from({ length: 3 }, (_, column) => <div key={column}><div className={styles.columnHead}><span>{columnLabels[column]}</span><button type="button" className={styles.smallButton} onClick={() => open(target, definition, { variant: 'banner', column })}>＋ เพิ่ม</button></div><ItemList target={target} definition={definition} variant="banner" column={column} /></div>)}</div><div className={styles.divider} /><div className={styles.columnHead}><span>รายการแนะนำ</span>{mode === 'manual' && <button type="button" className={styles.addButton} onClick={() => open(target, definition, { variant: 'book' })}>＋ เพิ่มเรื่อง</button>}</div><ModeControl target={target} /><ItemList target={target} definition={definition} variant="book" items={books} editable={mode === 'manual'} /></section>
  }

  function renderCoverflowPanel(target: Section, definition: CmsSectionDefinition) {
    const main = groupItems(target, 'main')[0]
    const covers = groupItems(target, 'cover')
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} action={<button type="button" className={styles.smallButton} onClick={() => open(target, definition, { item: main, variant: 'main' })}>✎ แก้ไขข้อความแบนเนอร์</button>} /><div className={styles.hint}>วางหัวข้อ คำโปรย และปุ่มได้อิสระ พร้อมปกที่เลื่อนวนอัตโนมัติ</div><div className={styles.columnHead}><span>ปกในแบนเนอร์</span><button type="button" className={styles.smallButton} onClick={() => open(target, definition, { variant: 'cover' })}>＋ เพิ่มปก</button></div><ItemList target={target} definition={definition} variant="cover" items={covers} /></section>
  }

  return <div className={styles.cms}>
    <header className={styles.pageHead}><h1>แบนเนอร์ &amp; โปรโมชัน</h1><p>จัดการแบนเนอร์ของแต่ละหน้าแยกกัน — เลือกหน้าด้านล่าง · บันทึกอัตโนมัติ (รีเฟรชหน้านั้นเพื่อดูผล)</p></header>
    <nav className={styles.pageBar} aria-label="เลือกหน้าที่ต้องการจัดการ"><b>เลือกหน้า:</b>{pages.map((page) => <button type="button" key={page.slug} className={slug === page.slug ? styles.activeTab : ''} onClick={() => setSlug(page.slug)}>{page.label}</button>)}<span>{data ? `กำลังจัดการ: ${data.label}` : ''}</span></nav>
    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลได้ <button type="button" onClick={() => void load()}>ลองใหม่</button></div>}
    {loading && <div className={styles.loading}>กำลังโหลดข้อมูล…</div>}
    {data && !loading && <>
      <section className={styles.panel}><div className={styles.panelHead}><h2>ความเร็วสไลด์แบนเนอร์ (เมื่อมีมากกว่า 1 อันในแถว)</h2></div><div className={styles.slideControl}><span>เปลี่ยนอัตโนมัติทุก</span><input aria-label="ความเร็วสไลด์เป็นวินาที" type="number" min={1} max={60} value={data.slideSeconds} onChange={(event) => setData({ ...data, slideSeconds: Number(event.target.value) })} onBlur={() => void saveSlideSeconds()} /><span>วินาที (มีผลกับแบนเนอร์ทุกแถว)</span></div></section>
      {sections.map(({ section: target, definition }) => definition.kind === 'book' ? renderBookPanel(target, definition) : definition.kind === 'recommend' ? renderRecommendPanel(target, definition) : definition.kind === 'coverflow' ? renderCoverflowPanel(target, definition) : renderVisualPanel(target, definition))}
    </>}

    <Dialog.Root open={!!editor && !!form} onOpenChange={(event) => { if (!event.open) close() }}><Dialog.Backdrop className={styles.modalBackdrop} /><Dialog.Positioner className={styles.modalPositioner}><Dialog.Content className={styles.dialog}><Dialog.Header className={styles.dialogHeader}><Dialog.Title>{editor?.item ? 'แก้ไข' : 'เพิ่ม'} {editor?.definition.title}</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header><Dialog.Body className={styles.dialogBody}>{editor && form && <div className={styles.form}>
      {editorKind() === 'book' && <><BookPicker page={slug} selectedId={typeof form.config.bookId === 'string' ? form.config.bookId : undefined} onSelect={selectBook} />{form.config.bookId && <div className={styles.selectedBookPreview}><Image src={form.imageUrl} alt="" /><span><b>{form.title}</b><small>{form.subtitle}</small></span></div>}{editor.section.key === 'sale' && <div className={styles.configGrid}><label>ส่วนลด<input value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value.slice(0, 20) })} placeholder="-30%" /></label><label>นับถอยหลัง (วัน)<input type="number" min={0} value={form.countdownDays} onChange={(event) => setForm({ ...form, countdownDays: Number(event.target.value) })} /></label><label>ชั่วโมง<input type="number" min={0} max={23} value={form.countdownHours} onChange={(event) => setForm({ ...form, countdownHours: Number(event.target.value) })} /></label></div>}<label>ป้ายกำกับ<input value={typeof form.config.badge === 'string' ? form.config.badge : ''} onChange={(event) => setForm({ ...form, config: { ...form.config, badge: event.target.value.slice(0, 80) } })} placeholder="ใหม่ / ฮิต / จบแล้ว" /></label></>}
      {editorKind() === 'cover' && <><label>ชื่อปก<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>คำโปรย<input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></label><label>ลิงก์<input value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} /></label></>}
      {editorKind() === 'visual' && <><label>รูป Desktop — แนะนำตามสัดส่วน {editor.definition.aspect}<input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value.slice(0, 2000) })} placeholder="วาง URL รูป หรือเลือกไฟล์ด้านล่าง" /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], 'desktop')} /><small className={styles.fileStatus}>{form.imageUrl ? 'มีรูป Desktop แล้ว' : 'ยังไม่ได้เลือกรูป — ใช้สีพื้นแทนได้'}</small></label><label>รูป Mobile — แนะนำ 750 × 700 px<input value={form.mobileImageUrl} onChange={(event) => setForm({ ...form, mobileImageUrl: event.target.value.slice(0, 2000) })} placeholder="วาง URL รูป หรือเว้นว่างเพื่อใช้รูป Desktop" /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], 'mobile')} /><small className={styles.fileStatus}>{form.mobileImageUrl ? 'มีรูป Mobile แล้ว' : 'ยังไม่มี — ใช้รูป Desktop แทน'}</small></label><label>สี/พื้นหลัง CSS<input value={typeof form.config.background === 'string' ? form.config.background : ''} onChange={(event) => setForm({ ...form, config: { ...form.config, background: event.target.value.slice(0, 500) } })} placeholder="#27312f หรือ linear-gradient(...)" /></label><CmsVisualEditor config={form.config} imageUrl={form.imageUrl} mobileImageUrl={form.mobileImageUrl} aspect={editor.definition.aspect} allowSpecial={editor.definition.allowSpecial} onChange={visualChange} /></>}
      {editorKind() === 'cover' && <label>รูปภาพ<input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value.slice(0, 2000) })} placeholder="วาง URL รูป หรือเลือกไฟล์ด้านล่าง" /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], 'desktop')} /><small className={styles.fileStatus}>{form.imageUrl ? 'มีรูปแล้ว' : 'ยังไม่ได้เลือกรูป'}</small></label>}
      {editor.item && <label className={styles.enabledCheck}><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> เปิดใช้งานรายการนี้</label>}
    </div>}</Dialog.Body><Dialog.Footer className={styles.dialogFooter}><button type="button" className={styles.cancelButton} disabled={saving || uploading} onClick={close}>ยกเลิก</button><button type="button" className={styles.saveButton} disabled={saving || uploading || !form?.title.trim() || ((editor?.section.key === 'hero' || editorKind() === 'cover') && !form?.imageUrl.trim())} onClick={() => void save()}>{uploading ? 'กำลังอัปโหลด…' : saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root>
  </div>
}
