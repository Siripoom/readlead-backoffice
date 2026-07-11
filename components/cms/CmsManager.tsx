'use client'

import { Dialog } from '@chakra-ui/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './CmsManager.module.css'

type VisualConfig = { x: number; y: number; size: number; color: string }
type Item = { id: string; title: string; subtitle?: string; imageUrl?: string; linkUrl?: string; enabled: boolean; config?: VisualConfig }
type Section = { id: string; key: string; title: string; enabled: boolean; items: Item[] }
type CmsPage = { id: string; slug: string; label: string; slideSeconds: number; sections: Section[] }
type FormState = { title: string; subtitle: string; imageUrl: string; linkUrl: string; enabled: boolean; config: VisualConfig }

const pages = [{ slug: 'home', label: 'หน้าหลัก' }, { slug: 'novel', label: 'นิยาย' }, { slug: 'manga', label: 'เว็บตูน' }, { slug: 'audio', label: 'หนังสือเสียง' }]
const visibleSections: Record<string, string[]> = {
  home: ['hero', 'activity', 'sale', 'recommend'],
  novel: ['hero', 'activity', 'sale', 'writer-banner', 'web-coverflow', 'web-books', 'category', 'web-recommend', 'launch'],
  manga: ['hero', 'activity', 'sale', 'row-3', 'web-sides', 'web-books', 'category', 'bottom-cta', 'web-recommend', 'launch'],
  audio: ['hero', 'activity', 'sale', 'row-3', 'narrator', 'web-sides', 'web-books', 'category', 'bottom-cta', 'web-recommend', 'launch'],
}
const emptyForm: FormState = { title: '', subtitle: '', imageUrl: '', linkUrl: '', enabled: true, config: { x: 8, y: 55, size: 100, color: '#ffffff' } }

export function CmsManager() {
  const [slug, setSlug] = useState('home')
  const [data, setData] = useState<CmsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [section, setSection] = useState<Section | null>(null)
  const [edit, setEdit] = useState<Item | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const response = await fetch(`/api/cms?page=${slug}`)
      if (!response.ok) throw new Error()
      setData(await response.json())
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [slug])
  // Loading the selected page is the external synchronization owned by this component.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const sections = useMemo(() => {
    const visible = visibleSections[slug] ?? []
    return (data?.sections ?? []).filter((item) => visible.includes(item.key)).sort((a, b) => visible.indexOf(a.key) - visible.indexOf(b.key))
  }, [data, slug])

  async function patch(body: object) {
    const response = await fetch('/api/cms', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error()
  }
  async function toggle(target: Section) {
    const enabled = !target.enabled
    setData((page) => page ? { ...page, sections: page.sections.map((item) => item.id === target.id ? { ...item, enabled } : item) } : page)
    try { await patch({ type: 'section', id: target.id, enabled }); toaster.success({ title: 'บันทึกอัตโนมัติแล้ว' }) }
    catch { await load(); toaster.error({ title: 'บันทึกไม่สำเร็จ' }) }
  }
  function open(target: Section, item?: Item) {
    setSection(target); setEdit(item ?? null)
    setForm(item ? { title: item.title, subtitle: item.subtitle ?? '', imageUrl: item.imageUrl ?? '', linkUrl: item.linkUrl ?? '', enabled: item.enabled, config: item.config ?? emptyForm.config } : { ...emptyForm, config: { ...emptyForm.config } })
  }
  function close() { if (!saving && !uploading) { setSection(null); setEdit(null) } }
  async function upload(file: File) {
    setUploading(true)
    const body = new FormData(); body.append('file', file)
    try {
      const response = await fetch('/api/cms/upload', { method: 'POST', body })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setForm((value) => ({ ...value, imageUrl: result.url }))
    } catch (uploadError) { toaster.error({ title: uploadError instanceof Error ? uploadError.message : 'อัปโหลดไม่สำเร็จ' }) }
    finally { setUploading(false) }
  }
  async function save() {
    if (!section || !form.title.trim()) return
    setSaving(true)
    try {
      const response = await fetch('/api/cms', { method: edit ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edit ? { type: 'item', id: edit.id, ...form } : { sectionId: section.id, ...form }) })
      if (!response.ok) throw new Error()
      setSection(null); setEdit(null); await load(); toaster.success({ title: 'บันทึกแล้ว' })
    } catch { toaster.error({ title: 'บันทึกไม่สำเร็จ' }) }
    finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!window.confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return
    try { const response = await fetch(`/api/cms?id=${id}`, { method: 'DELETE' }); if (!response.ok) throw new Error(); await load(); toaster.success({ title: 'ลบแล้ว' }) }
    catch { toaster.error({ title: 'ลบไม่สำเร็จ' }) }
  }
  async function move(target: Section, index: number, delta: number) {
    const other = target.items[index + delta]
    if (!other) return
    try {
      await Promise.all([
        patch({ type: 'item', id: target.items[index].id, sortOrder: index + delta }),
        patch({ type: 'item', id: other.id, sortOrder: index }),
      ])
      await load()
    } catch { toaster.error({ title: 'จัดลำดับไม่สำเร็จ' }) }
  }
  async function saveSlideSeconds() {
    if (!data) return
    const slideSeconds = Math.min(60, Math.max(1, data.slideSeconds || 5))
    setData({ ...data, slideSeconds })
    try { await patch({ type: 'page', id: data.id, slideSeconds }); toaster.success({ title: 'บันทึกอัตโนมัติแล้ว' }) }
    catch { toaster.error({ title: 'บันทึกไม่สำเร็จ' }) }
  }

  return <div className={styles.cms}>
    <header className={styles.pageHead}><h1>แบนเนอร์ &amp; โปรโมชัน</h1><p>จัดการแบนเนอร์ของแต่ละหน้าแยกกัน — เลือกหน้าด้านล่าง · บันทึกอัตโนมัติ (รีเฟรชหน้านั้นเพื่อดูผล)</p></header>
    <nav className={styles.pageBar} aria-label="เลือกหน้าที่ต้องการจัดการ"><b>เลือกหน้า:</b>{pages.map((page) => <button type="button" key={page.slug} className={slug === page.slug ? styles.activeTab : ''} onClick={() => setSlug(page.slug)}>{page.label}</button>)}<span>{data ? `กำลังจัดการ: ${data.label}` : ''}</span></nav>
    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลได้ <button type="button" onClick={() => void load()}>ลองใหม่</button></div>}
    {loading && <div className={styles.loading}>กำลังโหลดข้อมูล...</div>}
    {data && !loading && <>
      <section className={styles.panel}><div className={styles.panelHead}><h2>ความเร็วสไลด์แบนเนอร์ (เมื่อมีมากกว่า 1 อันในแถว)</h2></div><div className={styles.slideControl}><span>เปลี่ยนอัตโนมัติทุก</span><input aria-label="ความเร็วสไลด์เป็นวินาที" type="number" min={1} max={60} value={data.slideSeconds} onChange={(event) => setData({ ...data, slideSeconds: Number(event.target.value) })} onBlur={saveSlideSeconds} /><span>วินาที (มีผลกับแบนเนอร์ทุกแถว)</span></div></section>
      {sections.map((target) => <section className={styles.panel} key={target.id}><div className={styles.panelHead}><div><h2>{target.title}</h2><small>{target.items.length} รายการ</small></div><div className={styles.panelActions}><button type="button" className={styles.addButton} onClick={() => open(target)}>＋ เพิ่ม{target.key === 'sale' || target.key === 'recommend' || target.key === 'web-books' ? 'เรื่อง' : 'แบนเนอร์'}</button><label className={styles.toggle}><span>{target.enabled ? 'เปิด' : 'ปิด'}</span><input type="checkbox" checked={target.enabled} onChange={() => toggle(target)} /><i /></label></div></div>
        <div className={`${styles.itemList} ${['sale', 'recommend', 'web-books'].includes(target.key) ? styles.bookGrid : ''}`}>
          {!target.items.length && <div className={styles.empty}>ยังไม่มีรายการในส่วนนี้</div>}
          {target.items.map((item, index) => <article className={styles.item} key={item.id}>{item.imageUrl ? <div className={styles.thumb} style={{ backgroundImage: `url(${item.imageUrl})` }} /> : <div className={`${styles.thumb} ${styles.noImage}`}>รูปภาพ</div>}<div className={styles.itemBody}><b>{item.title}</b><span>{item.subtitle || item.linkUrl || 'ไม่มีคำอธิบาย'}</span><em className={item.enabled ? styles.enabled : styles.disabled}>{item.enabled ? 'เปิด' : 'ปิด'}</em></div><div className={styles.itemActions}><button type="button" disabled={index === 0} aria-label="เลื่อนขึ้น" onClick={() => move(target, index, -1)}>↑</button><button type="button" disabled={index === target.items.length - 1} aria-label="เลื่อนลง" onClick={() => move(target, index, 1)}>↓</button><button type="button" onClick={() => open(target, item)}>แก้ไข</button><button type="button" className={styles.delete} onClick={() => remove(item.id)}>ลบ</button></div></article>)}
        </div>
      </section>)}
    </>}

    <Dialog.Root open={!!section} onOpenChange={(event) => { if (!event.open) close() }}><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content maxW="720px" className={styles.dialog}><Dialog.Header><Dialog.Title>{edit ? 'แก้ไข' : 'เพิ่ม'} {section?.title}</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header><Dialog.Body><div className={styles.form}>
      <label>ชื่อ<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="ชื่อแบนเนอร์หรือรายการ" /></label>
      <label>คำอธิบาย<input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></label>
      <label>ลิงก์<input value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} placeholder="https:// หรือ /path" /></label>
      <label>รูปภาพ (JPEG/PNG/WebP/GIF ไม่เกิน 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} /></label>
      <div className={styles.preview} style={form.imageUrl ? { backgroundImage: `url(${form.imageUrl})` } : undefined}><strong style={{ left: `${form.config.x}%`, top: `${form.config.y}%`, fontSize: `${form.config.size / 100}rem`, color: form.config.color }}>{form.title || 'ตัวอย่างหัวข้อ'}</strong></div>
      <div className={styles.configGrid}><label>ตำแหน่ง X (%)<input type="number" min={0} max={90} value={form.config.x} onChange={(event) => setForm({ ...form, config: { ...form.config, x: Number(event.target.value) } })} /></label><label>ตำแหน่ง Y (%)<input type="number" min={0} max={90} value={form.config.y} onChange={(event) => setForm({ ...form, config: { ...form.config, y: Number(event.target.value) } })} /></label><label>ขนาด (%)<input type="number" min={50} max={240} value={form.config.size} onChange={(event) => setForm({ ...form, config: { ...form.config, size: Number(event.target.value) } })} /></label><label>สีข้อความ<input type="color" value={form.config.color} onChange={(event) => setForm({ ...form, config: { ...form.config, color: event.target.value } })} /></label></div>
      {edit && <label className={styles.enabledCheck}><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> เปิดใช้งานรายการนี้</label>}
    </div></Dialog.Body><Dialog.Footer><button type="button" className={styles.cancelButton} disabled={saving || uploading} onClick={close}>ยกเลิก</button><button type="button" className={styles.saveButton} disabled={saving || uploading || !form.title.trim()} onClick={save}>{uploading ? 'กำลังอัปโหลด...' : saving ? 'กำลังบันทึก...' : 'บันทึก'}</button></Dialog.Footer></Dialog.Content></Dialog.Positioner></Dialog.Root>
  </div>
}
