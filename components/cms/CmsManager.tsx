'use client'

import { Dialog, Image } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CmsVisualEditor } from '@/components/cms/CmsVisualEditor'
import {
  asItemConfig,
  asSectionConfig,
  CMS_PAGE_LABELS,
  CMS_PAGE_SECTIONS,
  legacyProjection,
  modernizeItemConfig,
  normalizeElements,
  starterElements,
  type CmsAutoMode,
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
type EditorContext = { section: Section; definition: CmsSectionDefinition; item: Item | null; variant: string; column: number; slot?: number; group?: string }
type PickerContext = { section: Section; definition: CmsSectionDefinition; column: number; group: string }
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
  dailyVotes: number
  category: string
  creator: { name: string; writerApplication: { penName: string } | null }
  _count: { episodes: number }
}

const pages = (Object.entries(CMS_PAGE_LABELS) as Array<[CmsPageSlug, string]>).map(([slug, label]) => ({ slug, label }))

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

function itemGroup(item: Item) {
  const group = asItemConfig(item.config).group
  return typeof group === 'string' ? group : undefined
}

function sourceMatches(item: Item, mode: string) {
  const generated = asItemConfig(item.config).source === 'generated'
  return mode === 'manual' ? !generated : generated
}

function emptyForm(context: Omit<EditorContext, 'item'>): FormState {
  const visual = !['book'].includes(context.definition.kind) && context.variant !== 'book' && context.variant !== 'cover'
  const title = context.variant === 'main' ? 'แนะนำโดยเว็บ' : context.variant === 'cover' ? '(ปกไม่มีคำโปรย)' : visual ? 'หัวข้อ' : ''
  const softGradient = 'linear-gradient(120deg,#eef0f5,#f3eaf8)'
  const background = context.definition.key === 'category'
    ? 'radial-gradient(130% 150% at 88% 8%, #f6ecff 0%, rgba(246,236,255,0) 46%),linear-gradient(110deg,#ece1ff 0%, #f1e8ff 30%, #f9ebf4 64%, #ffeef5 100%)'
    : context.definition.key === 'writer-banner'
      ? 'linear-gradient(120deg,#fbeef5,#f0e8fb)'
      : ['row-3', 'narrator', 'web-sides', 'bottom-cta'].includes(context.definition.key) || context.definition.key === 'activity'
        ? softGradient
        : 'linear-gradient(135deg,#6344c8,#8b6df0 55%,#3a2f63)'
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
      group: context.group,
      source: 'manual',
      background,
      focal: { x: 50, y: 50, zoom: 100 },
      elements: visual ? starterElements(title, '', '', '') : [],
    },
    discount: '-30%',
    countdownDays: 0,
    countdownHours: 0,
  }
}

function SectionToggle({ enabled, onChange, showLabel = true }: { enabled: boolean; onChange: () => void; showLabel?: boolean }) {
  return <label className={styles.toggle}>{showLabel && <span>{enabled ? 'เปิด' : 'ปิด'}</span>}<input type="checkbox" checked={enabled} onChange={onChange} /><i /></label>
}

function BookPicker({ page, selectedId, selectedIds = [], forcedType, continuous = false, onSelect }: { page: CmsPageSlug; selectedId?: string; selectedIds?: string[]; forcedType?: string; continuous?: boolean; onSelect: (work: CatalogWork) => void }) {
  const defaultType = forcedType || (page === 'audio' ? 'audiobook' : page === 'manga' ? 'manga' : page === 'novel' ? 'novel' : '')
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

  const filters = [{ value: '', label: 'ทั้งหมด' }, { value: 'novel', label: 'นิยาย' }, { value: 'manga', label: 'หนังสือ' }, { value: 'audiobook', label: 'หนังสือเสียง' }]
  return <div className={styles.bookPicker}>
    <div className={styles.bookSearch}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={continuous ? 'ค้นหาชื่อเรื่อง / ผู้เขียน...' : 'ค้นหาชื่อเรื่องหรือนักเขียน'} /></div>
    {!forcedType && <div className={styles.bookFilters}>{filters.map((filter) => <button type="button" key={filter.value} className={type === filter.value ? styles.activeFilter : ''} onClick={() => setType(filter.value)}>{filter.label}</button>)}</div>}
    <div className={styles.bookResults}>
      {loading && <div className={styles.empty}>กำลังค้นหา…</div>}
      {!loading && items.length === 0 && <div className={styles.empty}>ไม่พบเรื่องที่ค้นหา</div>}
      {!loading && items.map((work) => {
        const creator = work.creator.writerApplication?.penName || work.creator.name
        const selected = selectedId === work.id || selectedIds.includes(work.id)
        return <div key={work.id} className={`${styles.bookRow} ${selectedId === work.id ? styles.selectedBook : ''}`}><Image src={`/api/public/catalog/works/${work.id}/cover`} alt="" /><span><b>{work.title}</b><small>{creator} · {work.category} · 👁 {work.views.toLocaleString('th-TH')} · ❤ {work.dailyVotes.toLocaleString('th-TH')}</small></span>{continuous ? selected ? <em>เพิ่มแล้ว</em> : <button type="button" onClick={() => onSelect(work)}>เลือก</button> : <button type="button" aria-label={`เลือก ${work.title}`} onClick={() => onSelect(work)}>{selected ? '✓' : 'เลือก'}</button>}</div>
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
  const [picker, setPicker] = useState<PickerContext | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [savedToast, setSavedToast] = useState(false)
  const toastTimer = useRef<number | null>(null)
  const slideTimer = useRef<number | null>(null)

  function showSaved() {
    setSavedToast(true)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setSavedToast(false), 350)
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(false)
    try {
      const response = await fetch(`/api/cms?page=${slug}`)
      if (!response.ok) throw new Error()
      setData(await response.json())
    } catch {
      setError(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [slug])

  // Loading the selected page is the external synchronization owned by this component.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    if (slideTimer.current) window.clearTimeout(slideTimer.current)
  }, [])

  const sections = useMemo(() => {
    const byKey = new Map((data?.sections ?? []).map((section) => [section.key, section]))
    return CMS_PAGE_SECTIONS[slug].filter((definition) => definition.adminVisible !== false).flatMap((definition) => {
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
      showSaved()
    } catch {
      await load(true)
      toaster.error({ title: 'บันทึกไม่สำเร็จ' })
    }
  }

  async function saveSectionConfig(target: Section, config: CmsSectionConfig) {
    setData((page) => page ? { ...page, sections: page.sections.map((section) => section.id === target.id ? { ...section, config } : section) } : page)
    try {
      await patch({ type: 'section', id: target.id, config })
      showSaved()
    } catch {
      await load(true)
      toaster.error({ title: 'บันทึกไม่สำเร็จ' })
    }
  }

  function open(target: Section, definition: CmsSectionDefinition, options: { item?: Item; variant?: string; column?: number; slot?: number; group?: string } = {}) {
    const column = options.column ?? 0
    const editorDefinition = definition.slotAspects?.[column] ? { ...definition, aspect: definition.slotAspects[column] } : definition
    const context: EditorContext = { section: target, definition: editorDefinition, item: options.item ?? null, variant: options.variant ?? 'default', column, slot: options.slot, group: options.group }
    setEditor(context)
    if (!options.item) {
      setForm(emptyForm(context))
      return
    }
    const raw = modernizeItemConfig(options.item.config, options.item)
    const config: CmsItemConfig = { ...raw, variant: options.variant ?? itemVariant(target.key, options.item), column: options.column ?? itemColumn(options.item), slot: options.slot ?? itemSlot(options.item), group: options.group ?? itemGroup(options.item), source: raw.source === 'generated' ? 'generated' : 'manual' }
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

  async function uploadFile(file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch('/api/cms/upload', { method: 'POST', body })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    return result.url as string
  }

  async function upload(file: File, target: 'desktop' | 'mobile') {
    if (!form) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setForm((current) => current ? { ...current, [target === 'desktop' ? 'imageUrl' : 'mobileImageUrl']: url } : current)
    } catch (uploadError) {
      toaster.error({ title: uploadError instanceof Error ? uploadError.message : 'อัปโหลดไม่สำเร็จ' })
    } finally {
      setUploading(false)
    }
  }

  async function saveCategoryImage(target: Section, definition: CmsSectionDefinition, group: string, column: number, file: File) {
    setUploading(true)
    try {
      const imageUrl = await uploadFile(file)
      const item = groupItems(target, 'image', column, undefined, group)[0]
      const payload = { title: definition.columnLabels?.[column] ?? `หมวด ${column + 1}`, subtitle: '', imageUrl, linkUrl: '', enabled: true, config: { variant: 'image', column, group, source: 'manual' } }
      const response = await fetch('/api/cms', {
        method: item ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item ? { type: 'item', id: item.id, ...payload } : { sectionId: target.id, ...payload }),
      })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'บันทึกรูปไม่สำเร็จ')
      await load(true)
      showSaved()
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

  async function addPickedBook(work: CatalogWork) {
    if (!picker) return
    const payload = {
      sectionId: picker.section.id,
      title: work.title,
      subtitle: work.tagline || `${work.creator.writerApplication?.penName || work.creator.name} · ${work._count.episodes} ตอน`,
      imageUrl: `/api/public/catalog/works/${work.id}/cover`,
      linkUrl: `/works/${work.id}`,
      enabled: true,
      config: { variant: 'book', column: picker.column, group: picker.group, source: 'manual', bookId: work.id, workType: work.type },
    }
    setSaving(true)
    try {
      const response = await fetch('/api/cms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'เพิ่มเรื่องไม่สำเร็จ')
      await load(true)
      showSaved()
    } catch (pickError) {
      toaster.error({ title: pickError instanceof Error ? pickError.message : 'เพิ่มเรื่องไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  function editorKind() {
    if (!editor) return 'visual'
    if (editor.definition.kind === 'book' || editor.variant === 'book') return 'book'
    if (editor.variant === 'cover') return 'cover'
    return 'visual'
  }

  async function save() {
    if (!editor || !form || !form.title.trim()) return
    setSaving(true)
    try {
      const config: CmsItemConfig = {
        ...form.config,
        variant: editor.variant,
        column: editor.column,
        slot: editor.slot,
        group: editor.group,
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
      await load(true)
      showSaved()
    } catch (saveError) {
      toaster.error({ title: saveError instanceof Error ? saveError.message : 'บันทึกไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: Item) {
    if (!window.confirm('ลบรายการนี้?')) return
    try {
      const response = await fetch(`/api/cms?id=${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'ลบไม่สำเร็จ')
      await load(true)
      showSaved()
    } catch (removeError) {
      toaster.error({ title: removeError instanceof Error ? removeError.message : 'ลบไม่สำเร็จ' })
    }
  }

  async function clearItems(items: Item[]) {
    if (!items.length || !window.confirm(`ลบแบนเนอร์ทั้งหมด ${items.length} อันในแถวนี้?`)) return
    try {
      const responses = await Promise.all(items.map((item) => fetch(`/api/cms?id=${item.id}`, { method: 'DELETE' })))
      if (responses.some((response) => !response.ok)) throw new Error('ล้างรายการไม่สำเร็จ')
      await load(true)
      showSaved()
    } catch (clearError) {
      toaster.error({ title: clearError instanceof Error ? clearError.message : 'ล้างรายการไม่สำเร็จ' })
    }
  }

  async function saveSlideSeconds(page: CmsPage, value: number) {
    const slideSeconds = Math.min(60, Math.max(1, value || 5))
    try {
      await patch({ type: 'page', id: page.id, slideSeconds })
    } catch {
      toaster.error({ title: 'บันทึกไม่สำเร็จ' })
    }
  }

  function changeSlideSeconds(value: number) {
    if (!data) return
    const page = { ...data, slideSeconds: value }
    setData(page)
    if (slideTimer.current) window.clearTimeout(slideTimer.current)
    if (value >= 1 && value <= 60) slideTimer.current = window.setTimeout(() => void saveSlideSeconds(page, value), 300)
  }

  async function setMode(target: Section, mode: CmsAutoMode, group?: string) {
    const current = asSectionConfig(target.config)
    const config = group ? { ...current, groupModes: { ...current.groupModes, [group]: mode } } : { ...current, mode }
    if (mode === 'manual') {
      await saveSectionConfig(target, config)
      return
    }
    await generate(target, mode, group)
  }

  async function generate(target: Section, mode: Exclude<CmsAutoMode, 'manual'>, group?: string) {
    const generatingKey = `${target.id}:${group ?? ''}`
    setGenerating(generatingKey)
    try {
      const response = await fetch('/api/cms/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sectionId: target.id, mode, group }) })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'สร้างรายการไม่สำเร็จ')
      await load(true)
      showSaved()
    } catch (generateError) {
      toaster.error({ title: generateError instanceof Error ? generateError.message : 'สร้างรายการไม่สำเร็จ' })
    } finally {
      setGenerating(null)
    }
  }

  function groupItems(target: Section, variant: string, column = 0, slot?: number, group?: string) {
    return target.items.filter((item) => itemVariant(target.key, item) === variant && itemColumn(item) === column && (slot === undefined || itemSlot(item) === slot) && itemGroup(item) === group).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  }

  function ItemCard({ target, definition, item, editable = true, deleteOnly = false }: { target: Section; definition: CmsSectionDefinition; item: Item; editable?: boolean; deleteOnly?: boolean }) {
    return <article className={styles.item}><div className={`${styles.thumb} ${!item.imageUrl ? styles.noImage : ''}`} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} /> <div className={styles.itemBody}><b>{item.title}</b><span>{item.subtitle || item.linkUrl || ''}</span></div>{editable && <div className={styles.itemActions}>{!deleteOnly && <button type="button" onClick={() => open(target, definition, { item, variant: itemVariant(target.key, item), column: itemColumn(item), slot: itemSlot(item), group: itemGroup(item) })}>แก้ไข</button>}<button type="button" className={styles.delete} disabled={target.key === 'hero' && target.items.length <= 1} onClick={() => void remove(item)}>ลบ</button></div>}</article>
  }

  function ItemList({ target, definition, variant = 'default', column = 0, slot, groupKey, items, editable = true, deleteOnly = false }: { target: Section; definition: CmsSectionDefinition; variant?: string; column?: number; slot?: number; groupKey?: string; items?: Item[]; editable?: boolean; deleteOnly?: boolean }) {
    const group = items ?? groupItems(target, variant, column, slot, groupKey)
    return <div className={`${styles.itemList} ${variant === 'book' ? styles.bookGrid : ''}`}>{group.length === 0 && <div className={styles.empty}>ยังไม่มีรายการ กดปุ่มเพิ่มด้านบน</div>}{group.map((item) => <ItemCard key={item.id} target={target} definition={definition} item={item} editable={editable} deleteOnly={deleteOnly} />)}</div>
  }

  function ModeControl({ target, definition, group }: { target: Section; definition: CmsSectionDefinition; group?: string }) {
    const config = asSectionConfig(target.config)
    const mode = group ? config.groupModes?.[group] ?? 'manual' : config.mode ?? 'manual'
    const options = definition.modeOptions ?? ['manual', 'views', 'votes', 'random']
    const effectiveMode = options.includes(mode) ? mode : mode === 'views' && options.includes('popular') ? 'popular' : mode
    return <div className={styles.modeBlock}><div className={styles.modeChoices}>{options.map((value) => <label key={value}><input type="radio" checked={effectiveMode === value} onChange={() => void setMode(target, value, group)} /><span>{value === 'manual' ? 'เลือกเอง' : value === 'popular' ? 'อัตโนมัติ - คนอ่านมากสุด' : value === 'views' ? 'ยอดวิวสูงสุด' : value === 'votes' ? 'โหวตสูงสุด' : definition.key === 'web-books' ? 'อัตโนมัติ - สุ่ม' : 'สุ่ม'}</span></label>)}</div></div>
  }

  function PanelHead({ target, definition, action }: { target: Section; definition: CmsSectionDefinition; action?: ReactNode }) {
    return <div className={styles.panelHead}><h2>{definition.title}</h2><div className={styles.panelActions}>{action}{definition.toggleable && <SectionToggle enabled={target.enabled} showLabel={definition.toggleLabel !== false} onChange={() => void toggleSection(target)} />}</div></div>
  }

  function renderVisualPanel(target: Section, definition: CmsSectionDefinition) {
    if (definition.kind === 'fixed') {
      const sectionConfig = asSectionConfig(target.config)
      const slotEnabled = sectionConfig.slotEnabled ?? {}
      return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} /><div className={styles.fixedGrid}>{Array.from({ length: 4 }, (_, slot) => { const item = groupItems(target, 'default', slot, slot)[0]; const enabled = slotEnabled[String(slot)] !== false; return <div className={styles.fixedSlot} key={slot}><div className={styles.columnHead}><span>ช่อง {slot + 1} · 276×130</span></div><div className={styles.slotActions}>{item ? <button type="button" className={styles.smallButton} onClick={() => open(target, definition, { item, column: slot, slot })}>✎ แก้ไข</button> : <button type="button" className={styles.smallButton} onClick={() => open(target, definition, { column: slot, slot })}>✎ แก้ไข</button>}<SectionToggle enabled={enabled} onChange={() => void saveSectionConfig(target, { ...sectionConfig, slotEnabled: { ...slotEnabled, [slot]: !enabled } })} /></div></div> })}</div><div className={styles.empty}>els ลากวางอิสระ ช่องละ 276×130 · กดปิดได้รายช่อง หรือปิดทั้งแถว · ปิด/ว่างทุกช่อง = ซ่อนทั้งแถว</div></section>
    }
    const maxItems = definition.maxItems ?? 10
    const first = groupItems(target, 'default')[0]
    const searchHero = slug === 'search' && definition.key === 'hero'
    const compactEditor = ['category', 'writer-banner'].includes(definition.key)
    const baseAction = definition.columns === 1
      ? definition.key === 'category'
        ? <button type="button" className={styles.smallButton} onClick={() => open(target, definition, first ? { item: first } : undefined)}>✎ {definition.addLabel}</button>
        : searchHero && first
        ? <button type="button" className={styles.smallButton} onClick={() => open(target, definition, { item: first })}>✎ แก้ไข Hero</button>
        : <button type="button" className={compactEditor ? styles.smallButton : styles.addButton} disabled={groupItems(target, 'default').length >= maxItems} title={groupItems(target, 'default').length >= maxItems ? `ครบ ${maxItems} รายการแล้ว` : undefined} onClick={() => open(target, definition)}>＋ {definition.addLabel}</button>
      : undefined
    const action = <>{baseAction}{definition.clearable && groupItems(target, 'default').length > 0 && <button type="button" className={`${styles.smallButton} ${styles.dangerButton}`} onClick={() => void clearItems(groupItems(target, 'default'))}>ล้างทั้งหมด</button>}</>
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} action={action} />{definition.hint && ['row-3', 'narrator', 'category'].includes(definition.key) && <div className={styles.sectionNotice}>{definition.hint}</div>}{definition.key !== 'category' && <div className={definition.columns > 1 ? `${styles.columns} ${styles[`columns${definition.columns}`]}` : ''}>{Array.from({ length: definition.columns }, (_, column) => { const full = groupItems(target, 'default', column).length >= maxItems; return <div key={column}>{definition.columns > 1 && <div className={styles.columnHead}><span>{definition.columnLabels?.[column] ?? columnLabels[column]}</span><button type="button" className={styles.smallButton} disabled={full} title={full ? `ครบ ${maxItems} รายการแล้ว` : undefined} onClick={() => open(target, definition, { column })}>＋ เพิ่ม</button></div>}<ItemList target={target} definition={definition} column={column} /></div> })}</div>}{definition.hint && !['row-3', 'narrator', 'category'].includes(definition.key) && <div className={definition.key === 'web-sides' ? styles.sectionNotice : styles.hint}>{definition.hint}</div>}</section>
  }

  function renderBookPanel(target: Section, definition: CmsSectionDefinition) {
    const mode = definition.key === 'web-books' ? asSectionConfig(target.config).mode ?? 'manual' : 'manual'
    const items = groupItems(target, 'book').filter((item) => sourceMatches(item, mode))
    const generationMode = mode === 'manual' ? null : mode === 'popular' ? 'popular' : mode === 'random' ? 'random' : 'views'
    const action = mode === 'manual'
      ? <button type="button" className={styles.smallButton} onClick={() => open(target, definition, { variant: 'book' })}>＋ เพิ่มเรื่อง</button>
      : generationMode && <button type="button" className={styles.smallButton} disabled={generating === `${target.id}:`} onClick={() => void generate(target, generationMode)}>{generating === `${target.id}:` ? 'กำลังสร้าง…' : generationMode === 'random' ? '⇄ สุ่มใหม่' : '↻ ดึงใหม่'}</button>
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} action={action} />{definition.key === 'web-books' && <ModeControl target={target} definition={definition} />}<ItemList target={target} definition={definition} variant="book" items={items} /></section>
  }

  function renderRecommendPanel(target: Section, definition: CmsSectionDefinition) {
    const mode = asSectionConfig(target.config).mode ?? 'manual'
    const books = groupItems(target, 'book').filter((item) => sourceMatches(item, mode))
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} /><div className={styles.columnHead}><span>แบนเนอร์ (ซ้าย / กลาง / ขวา)</span></div><div className={`${styles.columns} ${styles.columns3}`}>{Array.from({ length: 3 }, (_, column) => <div key={column}><div className={styles.columnHead}><span>{columnLabels[column]}</span><button type="button" className={styles.smallButton} onClick={() => open(target, definition, { variant: 'banner', column })}>＋ เพิ่ม</button></div><ItemList target={target} definition={definition} variant="banner" column={column} /></div>)}</div><div className={styles.divider} /><div className={styles.columnHead}><span>รายการแนะนำ</span>{mode === 'manual' && <button type="button" className={styles.addButton} onClick={() => open(target, definition, { variant: 'book' })}>＋ เพิ่มเรื่อง</button>}</div><ModeControl target={target} definition={definition} /><ItemList target={target} definition={definition} variant="book" items={books} editable={mode === 'manual'} /></section>
  }

  function renderCoverflowPanel(target: Section, definition: CmsSectionDefinition) {
    const main = groupItems(target, 'main')[0]
    const covers = groupItems(target, 'cover')
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} action={<button type="button" className={styles.smallButton} onClick={() => open(target, definition, { variant: 'cover' })}>＋ เพิ่มปก</button>} /><div className={styles.coverflowEdit}><button type="button" className={styles.smallButton} onClick={() => open(target, definition, { item: main, variant: 'main' })}>✎ แก้ไขข้อความแบนเนอร์ (ลากวางอิสระ)</button><span>วางหัวข้อ/คำโปรย/ปุ่ม เองได้ทุกตำแหน่ง เปลี่ยนสี-ขนาดได้ เหมือนแบนเนอร์อื่น</span></div><div className={styles.columnHead}><span>ปกในแบนเนอร์ (เลื่อนวนอัตโนมัติ · แต่ละปกใส่คำโปรยได้)</span></div><ItemList target={target} definition={definition} variant="cover" items={covers} /></section>
  }

  function renderGroupedBooksPanel(target: Section, definition: CmsSectionDefinition) {
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} />
      <div className={`${styles.columns} ${styles[`columns${definition.columns}`]}`}>
        {(definition.groupKeys ?? []).map((group, column) => {
          const config = asSectionConfig(target.config)
          const mode = config.groupModes?.[group] ?? 'manual'
          const items = groupItems(target, 'book', column, undefined, group).filter((item) => sourceMatches(item, mode))
          const limit = definition.groupLimits?.[group] ?? 21
          return <div key={group} className={styles.groupColumn}>
            <div className={styles.columnHead}><span>{definition.columnLabels?.[column] ?? group}</span>{mode === 'manual' ? <button type="button" className={styles.smallButton} disabled={items.length >= limit} onClick={() => setPicker({ section: target, definition, column, group })}>＋ เพิ่มเรื่อง</button> : <button type="button" className={styles.smallButton} disabled={generating === `${target.id}:${group}`} onClick={() => void generate(target, mode === 'popular' ? 'popular' : mode as Exclude<CmsAutoMode, 'manual'>, group)}>{generating === `${target.id}:${group}` ? 'กำลังสร้าง…' : 'ดึงรายการใหม่'}</button>}</div>
            <ModeControl target={target} definition={definition} group={group} />
            <ItemList target={target} definition={definition} variant="book" column={column} groupKey={group} items={items} deleteOnly />
          </div>
        })}
      </div>{definition.hint && <div className={styles.hint}>{definition.hint}</div>}
    </section>
  }

  function renderPromoGrid(target: Section, definition: CmsSectionDefinition) {
    const maxItems = definition.maxItems ?? 10
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} />
      <div className={`${styles.columns} ${styles.columns4}`}>{Array.from({ length: 4 }, (_, column) => {
        const items = groupItems(target, 'default', column)
        return <div key={column} className={styles.promoColumn}><div className={styles.columnHead}><span>{definition.columnLabels?.[column]}</span><button type="button" className={styles.smallButton} disabled={items.length >= maxItems} onClick={() => open(target, definition, { column })}>＋ เพิ่ม</button></div><ItemList target={target} definition={definition} column={column} items={items} /></div>
      })}</div>{definition.hint && <div className={styles.hint}>{definition.hint}</div>}
    </section>
  }

  function renderImageGrid(target: Section, definition: CmsSectionDefinition) {
    return <section className={styles.panel} key={target.id}><PanelHead target={target} definition={definition} />
      <div className={styles.categoryGrid}>{(definition.groupKeys ?? []).map((group, column) => {
        const item = groupItems(target, 'image', column, undefined, group)[0]
        return <article className={styles.categoryCard} key={group}>
          <div className={styles.categoryPreview} style={item?.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}><b>{definition.columnLabels?.[column]}</b></div>
          <div className={styles.categoryActions}><label className={styles.uploadButton}>{uploading ? 'กำลังอัปโหลด…' : 'อัปโหลดรูป'}<input type="file" accept="image/*" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void saveCategoryImage(target, definition, group, column, file); event.currentTarget.value = '' }} /></label><button type="button" className={styles.deleteCategory} disabled={!item} onClick={() => item && void remove(item)}>ลบ</button></div>
        </article>
      })}</div>{definition.hint && <div className={styles.hint}>{definition.hint}</div>}
    </section>
  }

  function editorTitle() {
    if (!editor) return 'เพิ่มรายการ'
    const editing = !!editor.item
    if (editor.section.key === 'web-coverflow' && editor.variant === 'main') return 'แก้ไขข้อความแบนเนอร์ (ลากวางอิสระ)'
    if (editor.section.key === 'web-coverflow' && editor.variant === 'cover') return `${editing ? 'แก้ไขปก' : 'เพิ่มปก'} + คำโปรย`
    if (editor.section.key === 'writer-banner') return `${editing ? 'แก้ไขแบนเนอร์' : 'เพิ่มแบนเนอร์'} “มาเป็นนักเขียนกับเรา” (ลากวางอิสระ)`
    if (editor.section.key === 'category') return 'แก้ไขแบนเนอร์ “เติมเต็มทุกอารมณ์” (ลากวางอิสระ)'
    if (editor.section.key === 'row-3') return 'แก้ไขแบนเนอร์แถว 3 (ใต้อันดับรวม · ลากวางอิสระ)'
    if (editor.section.key === 'narrator') return 'แก้ไขแบนเนอร์เชิญชวนนักพากย์ (ลากวางอิสระ)'
    if (editor.section.key === 'web-sides') return `แก้ไขแบนเนอร์ “แนะนำโดยเว็บ” ${editor.column === 1 ? 'ใบขวา' : 'ใบซ้าย'} (ลากวางอิสระ)`
    if (editor.section.key === 'bottom-cta') return `แก้ไขแบนเนอร์ CTA ล่างสุด ช่อง ${editor.column + 1} (ลากวางอิสระ)`
    return editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'
  }

  function imageFieldCopy() {
    if (!editor) return { label: 'รูปพื้นหลัง', hint: 'แนวนอน' }
    if (editor.section.key === 'hero' && slug === 'home') return { label: 'รูปพื้นหลังแบนเนอร์ (เว้นว่าง = ใช้พื้นไล่สี)', hint: 'ขนาดแนะนำ 1608 × 592 px (~2.7:1 ตามกล่อง Hero หน้าหลักใหม่)' }
    if (editor.section.key === 'hero' && slug === 'search') return { label: 'รูปพื้นหลังแบนเนอร์ (เว้นว่าง = ใช้พื้นไล่สี)', hint: 'ขนาดแนะนำ 1486 × 276 px (สัดส่วน ~5.4:1 ตามแบนเนอร์หน้าค้นหา)' }
    if (editor.section.key === 'hero') return { label: 'รูปพื้นหลังแบนเนอร์ (เว้นว่าง = ใช้พื้นไล่สี)', hint: 'ขนาดแนะนำ 1280 × 320 px (เต็มกว้าง · แนวนอน ~4:1)' }
    if (editor.section.key === 'side') return { label: 'รูปพื้นหลัง (เว้นว่าง = ใช้พื้นไล่สี)', hint: 'ขนาดแนะนำ 660 × 592 px (~1.1:1 ตามกล่องข้าง Hero)' }
    if (editor.section.key === 'editors-choice') return { label: 'รูปพื้นหลัง (เว้นว่าง = ใช้พื้นไล่สีม่วง)', hint: 'ขนาดแนะนำ 904 × 344 px (~2.6:1 ตามกล่อง Editor’s Choice)' }
    if (editor.section.key === 'promo-4') return { label: 'รูปพื้นหลัง (เว้นว่าง = ใช้พื้นขาว)', hint: `ขนาดแนะนำตามช่อง ${editor.column + 1} · สัดส่วน ${editor.definition.aspect}` }
    return { label: 'รูปพื้นหลัง (เว้นว่าง = ใช้พื้นไล่สีเริ่มต้น)', hint: `แนวนอน · สัดส่วน ${editor.definition.aspect}` }
  }

  const pickerItems = picker ? data?.sections.find((section) => section.id === picker.section.id)?.items.filter((item) => itemGroup(item) === picker.group).map((item) => String(asItemConfig(item.config).bookId ?? '')) ?? [] : []
  const pageNote = slug === 'rank' ? 'หน้าจัดอันดับ แบนเนอร์ใหญ่ (Hero) + แบนเนอร์ใต้เมนูข้าง' : slug === 'home' ? 'หน้าหลักชุดใหม่ เชื่อมครบ: Hero + กล่องข้าง + 3 คอลัมน์แนะนำ + คัดสรรพิเศษ + แถวโปรโม' : slug === 'search' ? 'หน้าค้นหา Hero ปรับได้ทั้งหมด (ตำแหน่งช่องค้นหาตรึงไว้ในหน้า) + รูปพื้นช่องหมวดหมู่ 7 ช่อง' : 'หน้านี้มีเฉพาะแบนเนอร์ใหญ่ (Hero)'

  return <div className={styles.cms}>
    <header className={styles.pageHead}><h1>แบนเนอร์ &amp; โปรโมชัน</h1><p>จัดการแบนเนอร์ของแต่ละหน้าแยกกัน เลือกหน้าด้านล่าง · บันทึกอัตโนมัติ (รีเฟรชหน้านั้นเพื่อดูผล)</p></header>
    <nav className={styles.pageBar} aria-label="เลือกหน้าที่ต้องการจัดการ">
      <b>เลือกหน้า:</b>
      <div className={styles.pageTabs}>{pages.map((page) => <button type="button" key={page.slug} aria-current={slug === page.slug ? 'page' : undefined} className={slug === page.slug ? styles.activeTab : ''} onClick={() => { setEditor(null); setForm(null); setPicker(null); setSlug(page.slug) }}>{page.label}</button>)}</div>
      <span className={styles.pageNote}>{pageNote}</span>
    </nav>
    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลได้ <button type="button" onClick={() => void load()}>ลองใหม่</button></div>}
    {loading && <div className={styles.loading}>กำลังโหลดข้อมูล…</div>}
    {data && !loading && <>
      {slug !== 'search' && <section className={styles.panel}><div className={styles.panelHead}><h2>ความเร็วสไลด์แบนเนอร์ (เมื่อมีมากกว่า 1 อันในแถว)</h2></div><div className={styles.slideControl}><span>เปลี่ยนอัตโนมัติทุก</span><input aria-label="ความเร็วสไลด์เป็นวินาที" type="number" min={1} max={60} step={1} value={data.slideSeconds} onChange={(event) => changeSlideSeconds(Number(event.target.value))} /><span>วินาที (มีผลกับแบนเนอร์ใหญ่ + แถว 2/3/4)</span></div></section>}
      {sections.map(({ section: target, definition }) => definition.kind === 'book' ? renderBookPanel(target, definition) : definition.kind === 'recommend' ? renderRecommendPanel(target, definition) : definition.kind === 'coverflow' ? renderCoverflowPanel(target, definition) : definition.kind === 'grouped-books' ? renderGroupedBooksPanel(target, definition) : definition.kind === 'promo-grid' ? renderPromoGrid(target, definition) : definition.kind === 'image-grid' ? renderImageGrid(target, definition) : renderVisualPanel(target, definition))}
    </>}

    <Dialog.Root open={!!editor && !!form} onOpenChange={(event) => { if (!event.open) close() }}><Dialog.Backdrop className={styles.modalBackdrop} /><Dialog.Positioner className={styles.modalPositioner}><Dialog.Content className={`${styles.dialog} ${editorKind() === 'visual' ? styles.wideDialog : ''}`}><Dialog.Header className={styles.dialogHeader}><Dialog.Title>{editorTitle()}</Dialog.Title><Dialog.CloseTrigger className={styles.modalClose}>×</Dialog.CloseTrigger></Dialog.Header><Dialog.Body className={styles.dialogBody}>{editor && form && <div className={styles.form}>
      {editorKind() === 'book' && <><BookPicker page={slug} selectedId={typeof form.config.bookId === 'string' ? form.config.bookId : undefined} onSelect={selectBook} />{form.config.bookId && <><div className={styles.previewLabel}>เรื่องที่เลือก</div><div className={styles.selectedBookPreview}><Image src={form.imageUrl} alt="" /><span><b>{form.title}</b><small>{form.subtitle}</small></span></div></>}{editor.section.key === 'sale' && <><label>ประเภท (กำหนดไอคอน: ตา/หูฟัง)<select value={typeof form.config.workType === 'string' ? form.config.workType : slug === 'audio' ? 'audiobook' : slug === 'manga' ? 'manga' : 'novel'} onChange={(event) => setForm({ ...form, config: { ...form.config, workType: event.target.value } })}><option value="novel">นิยาย</option><option value="manga">เว็บตูน</option><option value="audiobook">หนังสือเสียง</option></select></label><div className={styles.configGrid}><label>ส่วนลด (เช่น -45%)<input value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value.slice(0, 20) })} placeholder="-30%" /></label><label>นับถอยหลัง (วัน)<input type="number" min={0} value={form.countdownDays} onChange={(event) => setForm({ ...form, countdownDays: Number(event.target.value) })} /></label><label>ชั่วโมง<input type="number" min={0} max={23} value={form.countdownHours} onChange={(event) => setForm({ ...form, countdownHours: Number(event.target.value) })} /></label></div></>} {editor.section.key !== 'sale' && <label>ป้าย (เว้นว่างได้ เช่น ใหม่/ฮิต/จบแล้ว)<input value={typeof form.config.badge === 'string' ? form.config.badge : ''} onChange={(event) => setForm({ ...form, config: { ...form.config, badge: event.target.value.slice(0, 80) } })} /></label>}</>}
      {editorKind() === 'cover' && <><label>รูปปกนิยาย (เว้นว่าง = กล่องเทา)<input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value.slice(0, 2000) })} placeholder="วางลิงก์รูป (URL)" /><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], 'desktop')} />{form.imageUrl && <Image className={styles.imagePreview} src={form.imageUrl} alt="" />}</label><label>คำโปรย (แสดงใต้ปกตอนเลื่อนมาตรงกลาง)<input value={form.subtitle} onChange={(event) => setForm({ ...form, title: event.target.value || '(ปกไม่มีคำโปรย)', subtitle: event.target.value })} /></label><label>ลิงก์ (กดปกแล้วไปหน้าเรื่องนี้ · เว้นว่าง = ไม่ลิงก์)<input value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} /></label></>}
      {editorKind() === 'visual' && <><label>{imageFieldCopy().label} <small>{imageFieldCopy().hint}</small><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value.slice(0, 2000) })} placeholder="วางลิงก์รูป (URL)" /><input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], 'desktop')} />{form.imageUrl && <Image className={styles.imagePreview} src={form.imageUrl} alt="" />}</label><CmsVisualEditor config={form.config} imageUrl={form.imageUrl} aspect={editor.definition.aspect} allowSpecial={editor.definition.allowSpecial} showSearchMock={slug === 'search' && editor.section.key === 'hero'} onChange={visualChange} /></>}
    </div>}</Dialog.Body><Dialog.Footer className={styles.dialogFooter}><button type="button" className={styles.cancelButton} disabled={saving || uploading} onClick={close}>ยกเลิก</button><button type="button" className={styles.saveButton} disabled={saving || uploading || !form?.title.trim() || (editorKind() === 'book' && typeof form?.config.bookId !== 'string')} onClick={() => void save()}>{uploading ? 'กำลังอัปโหลด…' : saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root>

    <Dialog.Root open={!!picker} onOpenChange={(event) => { if (!event.open && !saving) setPicker(null) }}><Dialog.Backdrop className={styles.modalBackdrop} /><Dialog.Positioner className={styles.modalPositioner}><Dialog.Content className={`${styles.dialog} ${styles.pickerDialog}`}><Dialog.Header className={styles.pickerHeader}><Dialog.Title>{picker ? `เลือกเรื่อง ${picker.definition.columnLabels?.[picker.column] ?? ''}` : 'เลือกเรื่อง'}</Dialog.Title><button type="button" className={styles.smallButton} disabled={saving} onClick={() => setPicker(null)}>ปิด</button></Dialog.Header><Dialog.Body className={styles.pickerBody}>{picker && <BookPicker page={slug} forcedType={picker.section.key === 'recommend-columns' ? picker.group === 'audio' ? 'audiobook' : picker.group : undefined} selectedIds={pickerItems} continuous onSelect={(work) => void addPickedBook(work)} />}</Dialog.Body></Dialog.Content></Dialog.Positioner></Dialog.Root>
    <div className={`${styles.cmsToast} ${savedToast ? styles.toastVisible : ''}`}>บันทึกแล้ว</div>
  </div>
}
