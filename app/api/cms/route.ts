import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import {
  asItemConfig,
  clamp,
  cmsItemLimit,
  getSectionDefinition,
  isCmsPageSlug,
  isRecord,
  normalizeElements,
  normalizeFocal,
  safeBackground,
  safeColor,
  safeUrl,
  type CmsItemConfig,
  type CmsSectionConfig,
} from '@/lib/cms-config'
import { ensureCmsPage } from '@/lib/cms-bootstrap'
import { cmsGenerationWorkType } from '@/lib/cms-generation'
import { Prisma } from '@/lib/generated/prisma/client'
import { getPrisma } from '@/lib/prisma'

const variants = new Set(['default', 'banner', 'book', 'main', 'cover', 'image'])

function cleanItemConfig(value: unknown): CmsItemConfig | null {
  if (!isRecord(value) || JSON.stringify(value).length > 60_000) return null
  if (value.variant !== undefined && (typeof value.variant !== 'string' || !variants.has(value.variant))) return null
  if (value.column !== undefined && (!Number.isInteger(value.column) || Number(value.column) < 0 || Number(value.column) > 6)) return null
  if (value.slot !== undefined && (!Number.isInteger(value.slot) || Number(value.slot) < 0 || Number(value.slot) > 6)) return null
  if (value.group !== undefined && (typeof value.group !== 'string' || !/^[a-z0-9_-]{1,30}$/i.test(value.group))) return null
  if (value.source !== undefined && value.source !== 'manual' && value.source !== 'generated') return null

  const config: CmsItemConfig = {
    variant: typeof value.variant === 'string' ? value.variant : 'default',
    column: Number.isInteger(value.column) ? Number(value.column) : 0,
    source: value.source === 'generated' ? 'generated' : 'manual',
  }
  if (Number.isInteger(value.slot)) config.slot = Number(value.slot)
  if (typeof value.group === 'string') config.group = value.group
  if (typeof value.bookId === 'string') config.bookId = value.bookId.trim().slice(0, 100)
  if (typeof value.workType === 'string' && ['novel', 'manga', 'audiobook'].includes(value.workType)) config.workType = value.workType
  if (typeof value.creatorName === 'string') config.creatorName = value.creatorName.trim().slice(0, 200)
  if (value.views !== undefined) config.views = Math.round(clamp(value.views, 0, 0, Number.MAX_SAFE_INTEGER))
  if (typeof value.badge === 'string') config.badge = value.badge.trim().slice(0, 80)
  if (typeof value.ctaLabel === 'string') config.ctaLabel = value.ctaLabel.trim().slice(0, 80)
  if (typeof value.discount === 'string') config.discount = value.discount.trim().slice(0, 20)
  if (value.countdownSeconds !== undefined) config.countdownSeconds = Math.round(clamp(value.countdownSeconds, 0, 0, 31_536_000))
  if (value.mobileImageUrl !== undefined) config.mobileImageUrl = safeUrl(value.mobileImageUrl)
  if (value.background !== undefined) config.background = safeBackground(value.background)
  if (value.focal !== undefined) config.focal = normalizeFocal(value.focal)
  if (value.elements !== undefined) config.elements = normalizeElements(value.elements)
  if (value.x !== undefined) config.x = clamp(value.x, 8, 0, 90)
  if (value.y !== undefined) config.y = clamp(value.y, 55, 0, 90)
  if (value.size !== undefined) config.size = Math.round(clamp(value.size, 100, 50, 240))
  if (value.color !== undefined) config.color = safeColor(value.color)
  return config
}

function cleanSectionConfig(value: unknown): CmsSectionConfig | null {
  if (!isRecord(value) || JSON.stringify(value).length > 10_000) return null
  const modes = new Set(['manual', 'popular', 'views', 'votes', 'random'])
  if (value.mode !== undefined && !modes.has(String(value.mode))) return null
  const config: CmsSectionConfig = {}
  if (typeof value.mode === 'string' && modes.has(value.mode)) config.mode = value.mode as CmsSectionConfig['mode']
  if (isRecord(value.groupModes)) {
    config.groupModes = Object.fromEntries(Object.entries(value.groupModes).filter(([key, mode]) => /^[a-z0-9_-]{1,30}$/i.test(key) && typeof mode === 'string' && modes.has(mode))) as NonNullable<CmsSectionConfig['groupModes']>
  }
  if (isRecord(value.slotEnabled)) {
    config.slotEnabled = Object.fromEntries(Object.entries(value.slotEnabled).filter(([key, enabled]) => /^[0-6]$/.test(key) && typeof enabled === 'boolean')) as Record<string, boolean>
  }
  return config
}

function jsonConfig(value: CmsItemConfig | CmsSectionConfig) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : undefined
}

function placement(configValue: unknown) {
  const config = asItemConfig(configValue)
  return `${typeof config.variant === 'string' ? config.variant : 'default'}:${Number(config.column) || 0}:${Number(config.slot) || 0}:${typeof config.group === 'string' ? config.group : ''}:${config.source === 'generated' ? 'generated' : 'manual'}`
}

function validPlacement(definition: NonNullable<ReturnType<typeof getSectionDefinition>>, config: CmsItemConfig) {
  const column = Number(config.column) || 0
  if (column < 0 || column >= Math.max(definition.columns, definition.kind === 'image-grid' ? 7 : 1)) return false
  if (definition.groupKeys?.length && (typeof config.group !== 'string' || !definition.groupKeys.includes(config.group))) return false
  if (!definition.groupKeys?.length && config.group !== undefined) return false
  if ((definition.kind === 'book' || definition.kind === 'grouped-books') && config.variant !== 'book') return false
  if (definition.kind === 'image-grid' && config.variant !== 'image') return false
  return true
}

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const slug = request.nextUrl.searchParams.get('page') ?? 'home'
  const prisma = getPrisma()
  if (!isCmsPageSlug(slug)) return NextResponse.json({ error: 'ไม่พบหน้า CMS' }, { status: 404 })
  await ensureCmsPage(slug)
  const page = await prisma.cmsPage.findUnique({
    where: { slug },
    include: { sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } } },
  })
  return NextResponse.json(page)
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const body = await request.json() as { sectionId?: string; title?: string; subtitle?: string; imageUrl?: string; linkUrl?: string; enabled?: boolean; config?: unknown }
  const title = cleanText(body.title, 200)
  const config = cleanItemConfig(body.config ?? {})
  if (!body.sectionId || !title || !config) return NextResponse.json({ error: 'ข้อมูลไม่ครบหรือ config ไม่ถูกต้อง' }, { status: 400 })

  const prisma = getPrisma()
  const section = await prisma.cmsSection.findUnique({ where: { id: body.sectionId }, include: { items: true, page: true } })
  if (!section) return NextResponse.json({ error: 'ไม่พบ section' }, { status: 404 })
  if (!isCmsPageSlug(section.page.slug)) return NextResponse.json({ error: 'หน้า CMS ไม่ถูกต้อง' }, { status: 400 })
  const definition = getSectionDefinition(section.page.slug, section.key)
  if (!definition || !validPlacement(definition, config)) return NextResponse.json({ error: 'ตำแหน่งรายการไม่ถูกต้อง' }, { status: 400 })
  if (section.page.slug === 'search' && section.key === 'hero') return NextResponse.json({ error: 'Hero หน้าค้นหามีหนึ่งรายการคงที่' }, { status: 409 })
  if (config.variant === 'book') {
    if (typeof config.bookId !== 'string' || !config.bookId) return NextResponse.json({ error: 'กรุณาเลือกเรื่อง' }, { status: 400 })
    const expectedType = cmsGenerationWorkType(section.page.slug, section.key, config.group)
    const work = await prisma.creatorWork.findFirst({ where: { id: config.bookId, status: 'published', episodes: { some: { status: 'published' } }, ...(expectedType ? { type: expectedType } : {}) }, select: { id: true } })
    if (!work) return NextResponse.json({ error: 'ไม่พบผลงานที่เผยแพร่หรือประเภทไม่ตรงกับกลุ่ม' }, { status: 400 })
    if (section.items.some((item) => placement(item.config) === placement(config) && asItemConfig(item.config).bookId === config.bookId)) return NextResponse.json({ error: 'เรื่องนี้อยู่ในกลุ่มแล้ว' }, { status: 409 })
  }
  const signature = placement(config)
  const groupCount = section.items.filter((item) => placement(item.config) === signature).length
  const limit = cmsItemLimit(definition, config)
  if (groupCount >= limit) return NextResponse.json({ error: `เพิ่มได้สูงสุด ${limit} รายการต่อกลุ่ม` }, { status: 409 })

  const item = await prisma.cmsItem.create({
    data: {
      sectionId: body.sectionId,
      title,
      subtitle: cleanText(body.subtitle, 1000),
      imageUrl: safeUrl(body.imageUrl),
      linkUrl: safeUrl(body.linkUrl),
      enabled: body.enabled ?? true,
      config: jsonConfig(config),
      sortOrder: groupCount,
    },
  })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.create', entity: 'CmsItem', entityId: item.id } })
  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const body = await request.json() as {
    type?: 'page' | 'section' | 'item' | 'items-order'
    id?: string
    slideSeconds?: number
    enabled?: boolean
    title?: string
    subtitle?: string
    imageUrl?: string
    linkUrl?: string
    sortOrder?: number
    config?: unknown
    orders?: Array<{ id: string; sortOrder: number }>
  }
  if (!body.type || !['page', 'section', 'item', 'items-order'].includes(body.type)) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const prisma = getPrisma()

  if (body.type === 'items-order') {
    if (!Array.isArray(body.orders) || body.orders.length < 2 || body.orders.length > 100 || body.orders.some((item) => !item.id || !Number.isInteger(item.sortOrder) || item.sortOrder < 0)) {
      return NextResponse.json({ error: 'ลำดับไม่ถูกต้อง' }, { status: 400 })
    }
    const ids = body.orders.map((item) => item.id)
    if (new Set(ids).size !== ids.length || new Set(body.orders.map((item) => item.sortOrder)).size !== body.orders.length) return NextResponse.json({ error: 'ลำดับซ้ำกัน' }, { status: 400 })
    const items = await prisma.cmsItem.findMany({ where: { id: { in: ids } }, select: { id: true, sectionId: true, config: true } })
    const signatures = new Set(items.map((item) => `${item.sectionId}:${placement(item.config)}`))
    if (items.length !== ids.length || signatures.size !== 1) return NextResponse.json({ error: 'จัดลำดับได้เฉพาะรายการในกลุ่มเดียวกัน' }, { status: 400 })
    await prisma.$transaction(body.orders.map((item) => prisma.cmsItem.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })))
    await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.reorder', entity: 'CmsItem', entityId: body.orders.map((item) => item.id).join(',').slice(0, 500) } })
    return NextResponse.json({ ok: true })
  }

  if (!body.id) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const itemConfig = body.type === 'item' && body.config !== undefined ? cleanItemConfig(body.config) : undefined
  const sectionConfig = body.type === 'section' && body.config !== undefined ? cleanSectionConfig(body.config) : undefined
  if ((body.type === 'item' && body.config !== undefined && !itemConfig) || (body.type === 'section' && body.config !== undefined && !sectionConfig)) return NextResponse.json({ error: 'config ไม่ถูกต้อง' }, { status: 400 })
  if (body.type === 'item' && body.title !== undefined && !cleanText(body.title, 200)) return NextResponse.json({ error: 'กรุณาระบุชื่อรายการ' }, { status: 400 })

  if (body.type === 'page') {
    const slideSeconds = Math.min(60, Math.max(1, Number(body.slideSeconds) || 5))
    await prisma.cmsPage.update({ where: { id: body.id }, data: { slideSeconds } })
  }
  if (body.type === 'section') {
    if (sectionConfig?.groupModes) {
      const existing = await prisma.cmsSection.findUnique({ where: { id: body.id }, include: { page: true } })
      if (!existing || !isCmsPageSlug(existing.page.slug)) return NextResponse.json({ error: 'ไม่พบ section' }, { status: 404 })
      const definition = getSectionDefinition(existing.page.slug, existing.key)
      if (!definition?.groupKeys || Object.keys(sectionConfig.groupModes).some((key) => !definition.groupKeys!.includes(key))) return NextResponse.json({ error: 'โหมดของกลุ่มไม่ถูกต้อง' }, { status: 400 })
    }
    await prisma.cmsSection.update({ where: { id: body.id }, data: { enabled: body.enabled, sortOrder: body.sortOrder, config: sectionConfig ? jsonConfig(sectionConfig) : undefined } })
  }
  if (body.type === 'item') {
    const existing = await prisma.cmsItem.findUnique({ where: { id: body.id }, include: { section: { include: { page: true } } } })
    if (!existing) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    if (existing.section.page.slug === 'search' && existing.section.key === 'hero' && body.enabled === false) return NextResponse.json({ error: 'Hero หน้าค้นหาต้องเปิดใช้งานเสมอ' }, { status: 409 })
    if (itemConfig) {
      if (!isCmsPageSlug(existing.section.page.slug)) return NextResponse.json({ error: 'หน้า CMS ไม่ถูกต้อง' }, { status: 400 })
      const definition = getSectionDefinition(existing.section.page.slug, existing.section.key)
      if (!definition || !validPlacement(definition, itemConfig)) return NextResponse.json({ error: 'ตำแหน่งรายการไม่ถูกต้อง' }, { status: 400 })
      const siblings = await prisma.cmsItem.findMany({ where: { sectionId: existing.sectionId, id: { not: existing.id } }, select: { config: true } })
      if (siblings.filter((item) => placement(item.config) === placement(itemConfig)).length >= cmsItemLimit(definition, itemConfig)) return NextResponse.json({ error: 'กลุ่มปลายทางเต็มแล้ว' }, { status: 409 })
      if (itemConfig.variant === 'book') {
        if (typeof itemConfig.bookId !== 'string' || !itemConfig.bookId) return NextResponse.json({ error: 'กรุณาเลือกเรื่อง' }, { status: 400 })
        const expectedType = cmsGenerationWorkType(existing.section.page.slug, existing.section.key, itemConfig.group)
        const work = await prisma.creatorWork.findFirst({ where: { id: itemConfig.bookId, status: 'published', episodes: { some: { status: 'published' } }, ...(expectedType ? { type: expectedType } : {}) }, select: { id: true } })
        if (!work) return NextResponse.json({ error: 'ไม่พบผลงานที่เผยแพร่หรือประเภทไม่ตรงกับกลุ่ม' }, { status: 400 })
        if (siblings.some((item) => placement(item.config) === placement(itemConfig) && asItemConfig(item.config).bookId === itemConfig.bookId)) return NextResponse.json({ error: 'เรื่องนี้อยู่ในกลุ่มแล้ว' }, { status: 409 })
      }
    }
    await prisma.cmsItem.update({
      where: { id: body.id },
      data: {
        title: body.title === undefined ? undefined : cleanText(body.title, 200),
        subtitle: body.subtitle === undefined ? undefined : cleanText(body.subtitle, 1000),
        imageUrl: body.imageUrl === undefined ? undefined : safeUrl(body.imageUrl),
        linkUrl: body.linkUrl === undefined ? undefined : safeUrl(body.linkUrl),
        enabled: body.enabled,
        sortOrder: body.sortOrder,
        config: itemConfig ? jsonConfig(itemConfig) : undefined,
      },
    })
  }
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.update', entity: body.type, entityId: body.id } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const prisma = getPrisma()
  const item = await prisma.cmsItem.findUnique({ where: { id }, include: { section: true } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const page = await prisma.cmsPage.findUnique({ where: { id: item.section.pageId }, select: { slug: true } })
  if (page?.slug === 'search' && item.section.key === 'hero') return NextResponse.json({ error: 'Hero หน้าค้นหาไม่สามารถลบได้' }, { status: 409 })
  if (item.section.key === 'hero') {
    const count = await prisma.cmsItem.count({ where: { sectionId: item.sectionId } })
    if (count <= 1) return NextResponse.json({ error: 'ต้องเหลือ Hero อย่างน้อย 1 รายการ' }, { status: 409 })
  }
  await prisma.cmsItem.delete({ where: { id } })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.delete', entity: 'CmsItem', entityId: id } })
  return NextResponse.json({ ok: true })
}
