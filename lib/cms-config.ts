export const CMS_PAGE_SLUGS = ['home', 'novel', 'manga', 'audio', 'rank', 'search'] as const
export type CmsPageSlug = (typeof CMS_PAGE_SLUGS)[number]

export const CMS_PAGE_LABELS: Record<CmsPageSlug, string> = {
  home: 'หน้าหลัก',
  novel: 'นิยาย',
  manga: 'เว็บตูน',
  audio: 'หนังสือเสียง',
  rank: 'จัดอันดับ',
  search: 'ค้นหา',
}

export type CmsAutoMode = 'manual' | 'popular' | 'views' | 'votes' | 'random'

export type CmsElementType = 'badge' | 'title' | 'text' | 'button' | 'votes' | 'countdown'

export type CmsVisualElement = {
  id: string
  type: CmsElementType
  text: string
  x: number
  y: number
  scale: number
  color: string
  backgroundColor?: string
  bold?: boolean
  shadow?: boolean
  link?: string
  width?: number
  height?: number
  offsetSeconds?: number
}

export type CmsFocalPoint = { x: number; y: number; zoom: number }

export type CmsItemConfig = {
  variant?: string
  column?: number
  slot?: number
  group?: string
  source?: 'manual' | 'generated'
  bookId?: string
  badge?: string
  ctaLabel?: string
  mobileImageUrl?: string
  background?: string
  discount?: string
  countdownSeconds?: number
  focal?: CmsFocalPoint
  elements?: CmsVisualElement[]
  x?: number
  y?: number
  size?: number
  color?: string
  [key: string]: unknown
}

export type CmsSectionConfig = {
  mode?: CmsAutoMode
  groupModes?: Record<string, CmsAutoMode>
  slotEnabled?: Record<string, boolean>
  [key: string]: unknown
}

export type CmsSectionKind = 'visual' | 'book' | 'recommend' | 'coverflow' | 'fixed' | 'grouped-books' | 'image-grid' | 'promo-grid'

export type CmsSectionDefinition = {
  key: string
  title: string
  kind: CmsSectionKind
  columns: number
  aspect: string
  addLabel: string
  hint?: string
  allowSpecial?: boolean
  toggleable?: boolean
  maxItems?: number
  groupKeys?: string[]
  groupLimits?: Record<string, number>
  columnLabels?: string[]
  slotAspects?: string[]
  adminVisible?: boolean
  toggleLabel?: boolean
  clearable?: boolean
  modeOptions?: CmsAutoMode[]
}

const shared = {
  hero: { key: 'hero', title: 'แบนเนอร์ใหญ่ (Hero)', kind: 'visual', columns: 1, aspect: '1280 / 318', addLabel: 'เพิ่มแบนเนอร์', maxItems: 10 },
  sale: { key: 'sale', title: 'ลดราคาพิเศษ', kind: 'book', columns: 1, aspect: '3 / 4', addLabel: 'เพิ่มเรื่อง', toggleable: true, toggleLabel: false },
  'writer-banner': { key: 'writer-banner', title: 'แบนเนอร์แถว 5 “มาเป็นนักเขียนกับเรา” (หลายแบนเนอร์ + ไข่ปลา)', kind: 'visual', columns: 1, aspect: '1152 / 244', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, maxItems: 10 },
  'row-3': { key: 'row-3', title: 'แบนเนอร์แถว 3 (ใต้อันดับรวมยอดนิยม)', kind: 'visual', columns: 1, aspect: '1152 / 138', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, maxItems: 10, hint: 'แบนเนอร์เต็มกว้างใต้อันดับ · เพิ่มได้หลายอัน (มีไข่ปลาสลับอัตโนมัติ) · ปิด หรือ ไม่มีแบนเนอร์ = ซ่อนทั้งแถบ' },
  narrator: { key: 'narrator', title: 'แบนเนอร์เชิญชวนนักพากย์', kind: 'visual', columns: 1, aspect: '1152 / 138', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, maxItems: 10, hint: 'แบนเนอร์เต็มกว้าง (ระหว่างเปิดตัวใหม่กับเปิดตัวพากย์) · เพิ่มได้หลายอัน (มีไข่ปลาสลับอัตโนมัติ) · ปิด หรือ ไม่มีแบนเนอร์ = ซ่อนทั้งแถบ' },
  'web-coverflow': { key: 'web-coverflow', title: 'แบนเนอร์แถว 4 (แนะนำโดยเว็บ) แบนเนอร์ม่วง (คอเวอร์โฟลว์)', kind: 'coverflow', columns: 1, aspect: '1152 / 280', addLabel: 'เพิ่มปก', toggleable: true },
  'web-sides': { key: 'web-sides', title: 'แบนเนอร์ “แนะนำโดยเว็บ” ซ้าย/ขวา (เพิ่มได้หลายอัน + ไข่ปลา)', kind: 'visual', columns: 2, aspect: '567 / 135', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, maxItems: 10, columnLabels: ['ใบซ้าย (ใบละ 567×135)', 'ใบขวา (ใบละ 567×135)'], hint: 'ปิด หรือ ทั้งสองข้างว่าง = ซ่อนทั้งแถว · หลายอันต่อข้าง = มีไข่ปลาสลับอัตโนมัติ' },
  'web-books': { key: 'web-books', title: 'แนะนำโดยเว็บ แถวการ์ดหนังสือ (เลือกเอง/ยอดนิยม/สุ่ม · ว่าง=ซ่อนแถว)', kind: 'book', columns: 1, aspect: '3 / 4', addLabel: 'เพิ่มเรื่อง', toggleable: true, modeOptions: ['manual', 'popular', 'random'] },
  category: { key: 'category', title: 'แบนเนอร์ “เติมเต็มทุกอารมณ์” (เลือกหมวด)', kind: 'visual', columns: 1, aspect: '1152 / 228', addLabel: 'แก้ไขแบนเนอร์ (ลากวางอิสระ)', toggleable: true, hint: 'ปิด = ซ่อนเฉพาะแบนเนอร์ม่วง เหลือแถบฟิลเตอร์หมวด · วางข้อความ/ใส่รูปพื้นหลังได้เหมือนแบนเนอร์อื่น (ฟิลเตอร์หมวดคงเดิม ไม่อยู่ในตัวแก้นี้)' },
  'bottom-cta': { key: 'bottom-cta', title: 'แบนเนอร์ CTA 4 ช่อง (ล่างสุด · ก่อน Footer)', kind: 'fixed', columns: 4, aspect: '276 / 130', addLabel: 'แก้ไข', toggleable: true },
  'web-recommend': { key: 'web-recommend', title: 'แนะนำโดยเว็บ', kind: 'visual', columns: 2, aspect: '567 / 169', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, adminVisible: false },
  launch: { key: 'launch', title: 'แบนเนอร์เปิดตัวใหม่ยอดฮิต', kind: 'visual', columns: 2, aspect: '1140 / 400', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, adminVisible: false },
} satisfies Record<string, CmsSectionDefinition>

export const CMS_PAGE_SECTIONS: Record<CmsPageSlug, CmsSectionDefinition[]> = {
  home: [
    { ...shared.hero, aspect: '804 / 296' },
    { key: 'side', title: 'แบนเนอร์กล่องข้าง Hero (ขวา · 330×296)', kind: 'visual', columns: 1, aspect: '330 / 296', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, toggleLabel: false, maxItems: 10, hint: 'ระบบเดียวกับแบนเนอร์ใหญ่ จัดวางข้อความ/ป้าย/ปุ่มอิสระ · มีมากกว่า 1 อันจะสไลด์อัตโนมัติ + ไข่ปลาใต้กล่อง · ปิดสวิตช์หรือไม่มีแบนเนอร์ = ซ่อนกล่อง แล้ว Hero ขยายเต็มแถว' },
    { key: 'recommend-columns', title: 'แนะนำ 3 คอลัมน์ (นิยาย / เว็บตูน / หนังสือเสียง) สูงสุดคอลัมน์ละ 15 เรื่อง', kind: 'grouped-books', columns: 3, aspect: '3 / 4', addLabel: 'เพิ่มเรื่อง', groupKeys: ['novel', 'manga', 'audio'], groupLimits: { novel: 15, manga: 15, audio: 15 }, columnLabels: ['แนะนำนิยาย', 'แนะนำเว็บตูน', 'แนะนำหนังสือเสียง'], hint: 'หน้าเว็บโชว์ทีละ 3 เรื่องแล้วเลื่อนทีละเรื่องวนครบทั้งลิสต์ (1-2-3 → 2-3-4 … → 15-1-2) ตามความเร็วสไลด์ด้านบน · โหมดอัตโนมัติกด “ดึงรายการใหม่” เพื่ออัปเดตจากคะแนนล่าสุด · ไม่มีเรื่อง = ซ่อนคอลัมน์', modeOptions: ['manual', 'views', 'votes', 'random'] },
    { key: 'editors-choice', title: "แบนเนอร์ Editor's Choice (ซ้ายแถวคัดสรร · 452×172 · สูงสุด 5)", kind: 'visual', columns: 1, aspect: '452 / 172', addLabel: 'เพิ่มแบนเนอร์', maxItems: 5, hint: 'มีมากกว่า 1 อันจะสไลด์พร้อมไข่ปลา · ไม่มีแบนเนอร์ = ซ่อนกล่อง แล้วแถวเรื่องขยายเต็ม' },
    { key: 'curated-picks', title: 'คัดสรรพิเศษสำหรับคุณ (เรื่องคละประเภท · เลื่อนทีละเรื่องวนลูป)', kind: 'grouped-books', columns: 2, aspect: '3 / 4', addLabel: 'เพิ่มเรื่อง', groupKeys: ['top', 'bottom'], groupLimits: { top: 15, bottom: 30 }, columnLabels: ['แถวบน (โชว์ 3 · สูงสุด 15 เรื่อง)', 'แถวล่าง (โชว์ 5 · สูงสุด 30 เรื่อง)'], hint: 'ไม่มีเรื่อง = ซ่อนแถวนั้นบนหน้าเว็บ · ไข่ปลาใต้แถวตามจำนวนหน้าอัตโนมัติ', modeOptions: ['manual', 'views', 'votes', 'random'] },
    { key: 'promo-4', title: 'แบนเนอร์แถวโปรโม (ใต้คัดสรรพิเศษ · 4 ช่อง)', kind: 'promo-grid', columns: 4, aspect: '369 / 171', slotAspects: ['369 / 171', '250 / 171', '228 / 171', '250 / 171'], columnLabels: ['ช่อง 1 · 369×171', 'ช่อง 2 · 250×171', 'ช่อง 3 · 228×171', 'ช่อง 4 · 250×171'], addLabel: 'เพิ่ม', maxItems: 10, hint: 'ช่องละสูงสุด 10 อัน · มีมากกว่า 1 อันจะสไลด์พร้อมไข่ปลา · ว่างทั้ง 4 ช่อง = ซ่อนทั้งแถว' },
    { key: 'activity', title: 'แบนเนอร์แถว 2 (กิจกรรม)', kind: 'visual', columns: 3, aspect: '370 / 169', addLabel: 'เพิ่ม', toggleable: true, adminVisible: false },
    { ...shared.sale, adminVisible: false },
    { key: 'act3', title: 'แบนเนอร์แถว 3 (กิจกรรม) — เหนือจัดอันดับรวม', kind: 'visual', columns: 1, aspect: '1180 / 247', addLabel: 'เพิ่มแบนเนอร์', allowSpecial: true, toggleable: true, adminVisible: false },
    { key: 'act4', title: 'แบนเนอร์แถว 4 (กิจกรรม) — ใต้จัดอันดับรวม', kind: 'visual', columns: 1, aspect: '1180 / 247', addLabel: 'เพิ่มแบนเนอร์', allowSpecial: true, toggleable: true, adminVisible: false },
    { key: 'recommend', title: 'แนะนำสำหรับคุณ', kind: 'recommend', columns: 3, aspect: '372 / 174', addLabel: 'เพิ่ม', toggleable: true, adminVisible: false },
  ],
  novel: [
    shared.hero,
    { key: 'activity', title: 'แบนเนอร์แถว 2 (ใต้แบนเนอร์ใหญ่)', kind: 'visual', columns: 2, aspect: '566 / 169', addLabel: 'เพิ่ม', toggleable: true, maxItems: 10 },
    shared.sale,
    { key: 'act3', title: 'แบนเนอร์แถว 3 (กิจกรรม) เหนือจัดอันดับรวม', kind: 'visual', columns: 1, aspect: '1180 / 247', addLabel: 'เพิ่มแบนเนอร์', allowSpecial: true, toggleable: true, clearable: true, maxItems: 10 },
    shared['web-coverflow'], shared['web-books'], shared['writer-banner'], shared.category, shared['web-recommend'], shared.launch,
  ],
  manga: [
    shared.hero,
    { key: 'activity', title: 'แบนเนอร์แถว 2 (ใต้แบนเนอร์ใหญ่)', kind: 'visual', columns: 2, aspect: '566 / 169', addLabel: 'เพิ่ม', toggleable: true, maxItems: 10 },
    shared.sale,
    shared['row-3'], shared['web-sides'], shared['web-books'], shared.category, shared['bottom-cta'], shared['web-recommend'], shared.launch,
  ],
  audio: [
    shared.hero,
    { key: 'activity', title: 'แบนเนอร์แถว 2 (ใต้แบนเนอร์ใหญ่)', kind: 'visual', columns: 2, aspect: '566 / 169', addLabel: 'เพิ่ม', toggleable: true, maxItems: 10 },
    shared.sale,
    shared['row-3'], shared.narrator, shared['web-sides'], shared['web-books'], shared.category, shared['bottom-cta'], shared['web-recommend'], shared.launch,
  ],
  rank: [
    { ...shared.hero, aspect: '1280 / 320' },
    { key: 'side', title: 'แบนเนอร์ใต้เมนูข้าง (หน้าจัดอันดับ)', kind: 'visual', columns: 1, aspect: '330 / 296', addLabel: 'เพิ่มแบนเนอร์', toggleable: true, toggleLabel: false, maxItems: 10, hint: 'มีมากกว่า 1 อันจะสไลด์อัตโนมัติพร้อมไข่ปลา · ปิดหรือไม่มีรายการ = ซ่อนพื้นที่นี้' },
  ],
  search: [
    { ...shared.hero, aspect: '1486 / 276', maxItems: 1, toggleable: false, hint: 'Hero หน้าค้นหามีหนึ่งรายการคงที่ · ตำแหน่งช่องค้นหาบนหน้าจริงถูกตรึงไว้' },
    { key: 'search-categories', title: 'รูปพื้นช่องหมวดหมู่ยอดนิยม (หน้าค้นหา · ใส่ได้เฉพาะรูป)', kind: 'image-grid', columns: 4, aspect: '2 / 1', addLabel: 'อัปโหลดรูป', maxItems: 1, groupKeys: ['0', '1', '2', '3', '4', '5', '6'], columnLabels: ['กำลังภายใน', 'แฟนตาซี', 'แอ็กชัน', 'ผจญภัย', 'ต่างโลก', 'ระบบ', 'ทั้งหมด'], hint: 'ขนาดแนะนำ 760 × 380px (สัดส่วน 2:1 · ขั้นต่ำ 380 × 190px) ชื่อหมวดและจำนวนเรื่องมาจากระบบ' },
  ],
}

export function getSectionDefinition(page: CmsPageSlug, key: string) {
  return CMS_PAGE_SECTIONS[page].find((definition) => definition.key === key)
}

export function cmsItemLimit(definition: CmsSectionDefinition, configValue: unknown) {
  const config = asItemConfig(configValue)
  if (definition.groupLimits && typeof config.group === 'string') return definition.groupLimits[config.group] ?? definition.maxItems ?? 10
  if (definition.kind === 'book' || config.variant === 'book') return definition.maxItems ?? 21
  return definition.maxItems ?? 10
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function asItemConfig(value: unknown): CmsItemConfig {
  return isRecord(value) ? value as CmsItemConfig : {}
}

export function asSectionConfig(value: unknown): CmsSectionConfig {
  return isRecord(value) ? value as CmsSectionConfig : {}
}

export function clamp(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

export function safeColor(value: unknown, fallback = '#ffffff') {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

export function safeBackground(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback
  const background = value.trim().slice(0, 500)
  if (/^#[0-9a-f]{6}$/i.test(background)) return background
  if (/^(linear-gradient|radial-gradient)\(/i.test(background) && !/(url|expression|[;{}])/i.test(background)) return background
  return fallback
}

export function safeUrl(value: unknown, fallback = '') {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const candidate = value.trim()
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback
  } catch {
    return fallback
  }
}

function elementId(value: unknown, index: number) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : `element-${index + 1}`
}

export function normalizeElements(value: unknown): CmsVisualElement[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<CmsElementType>(['badge', 'title', 'text', 'button', 'votes', 'countdown'])
  return value.slice(0, 14).flatMap((raw, index) => {
    if (!isRecord(raw) || !allowed.has(raw.type as CmsElementType)) return []
    const type = raw.type as CmsElementType
    return [{
      id: elementId(raw.id, index),
      type,
      text: typeof raw.text === 'string' ? raw.text.slice(0, 500) : '',
      x: clamp(raw.x, 8, 0, 100),
      y: clamp(raw.y, 20, 0, 100),
      scale: clamp(raw.scale ?? raw.s, 1, .5, 2.4),
      color: safeColor(raw.color ?? raw.c),
      backgroundColor: safeColor(raw.backgroundColor ?? raw.bgc, type === 'button' ? '#14b8a6' : '#ffffff'),
      bold: raw.bold === true || raw.b === true,
      shadow: raw.shadow !== false && raw.sh !== false,
      link: safeUrl(raw.link),
      width: type === 'button' ? clamp(raw.width ?? raw.w, 18, 8, 100) : undefined,
      height: type === 'button' ? clamp(raw.height ?? raw.h, 12, 4, 100) : undefined,
      offsetSeconds: type === 'countdown' ? Math.round(clamp(raw.offsetSeconds ?? raw.off, 0, 0, 31536000)) : undefined,
    }]
  })
}

export function normalizeFocal(value: unknown): CmsFocalPoint {
  const focal = isRecord(value) ? value : {}
  return { x: clamp(focal.x, 50, 0, 100), y: clamp(focal.y, 50, 0, 100), zoom: clamp(focal.zoom, 100, 100, 240) }
}

export function starterElements(title = 'หัวข้อแบนเนอร์', subtitle = '', badge = '', cta = 'อ่านเลย'): CmsVisualElement[] {
  const result: CmsVisualElement[] = []
  if (badge) result.push({ id: 'badge-1', type: 'badge', text: badge, x: 8, y: 18, scale: 1, color: '#0e5f57', backgroundColor: '#ffffff', bold: true, shadow: false })
  result.push({ id: 'title-1', type: 'title', text: title || 'หัวข้อแบนเนอร์', x: 8, y: badge ? 36 : 28, scale: 1, color: '#ffffff', bold: true, shadow: true })
  if (subtitle) result.push({ id: 'text-1', type: 'text', text: subtitle, x: 8, y: badge ? 56 : 50, scale: 1, color: '#ffffff', shadow: true })
  if (cta) result.push({ id: 'button-1', type: 'button', text: cta, x: 8, y: 72, scale: 1, color: '#ffffff', backgroundColor: '#14b8a6', bold: true, shadow: false, width: 18, height: 12 })
  return result
}

export function modernizeItemConfig(configValue: unknown, item: { title: string; subtitle?: string | null; linkUrl?: string | null }): CmsItemConfig {
  const config = { ...asItemConfig(configValue) }
  if (config.background !== undefined) config.background = safeBackground(config.background)
  if (config.mobileImageUrl !== undefined) config.mobileImageUrl = safeUrl(config.mobileImageUrl)
  const elements = normalizeElements(config.elements)
  if (elements.length) return { ...config, elements, focal: normalizeFocal(config.focal) }
  if (config.variant === 'book' || config.variant === 'cover' || config.variant === 'image') return { ...config, elements: [], focal: normalizeFocal(config.focal) }
  const legacyTitle: CmsVisualElement = {
    id: 'title-1', type: 'title', text: item.title, x: clamp(config.x, 8, 0, 90), y: clamp(config.y, 55, 0, 90),
    scale: clamp(config.size, 100, 50, 240) / 100, color: safeColor(config.color), bold: true, shadow: true,
  }
  const result = starterElements(item.title, item.subtitle ?? '', typeof config.badge === 'string' ? config.badge : '', typeof config.ctaLabel === 'string' ? config.ctaLabel : '')
  const titleIndex = result.findIndex((element) => element.type === 'title')
  if (titleIndex >= 0) result[titleIndex] = legacyTitle
  const button = result.find((element) => element.type === 'button')
  if (button) button.link = safeUrl(item.linkUrl)
  return { ...config, elements: result, focal: normalizeFocal(config.focal) }
}

export function legacyProjection(configValue: CmsItemConfig) {
  const elements = normalizeElements(configValue.elements)
  const title = elements.find((element) => element.type === 'title')
  const badge = elements.find((element) => element.type === 'badge')
  const button = elements.find((element) => element.type === 'button')
  return {
    x: title?.x ?? 8,
    y: title?.y ?? 55,
    size: Math.round((title?.scale ?? 1) * 100),
    color: title?.color ?? '#ffffff',
    badge: badge?.text ?? '',
    ctaLabel: button?.text ?? 'อ่านเลย',
  }
}

export function isCmsPageSlug(value: string): value is CmsPageSlug {
  return (CMS_PAGE_SLUGS as readonly string[]).includes(value)
}
