import { NextResponse } from 'next/server'
import {
  asItemConfig,
  asSectionConfig,
  CMS_PAGE_SECTIONS,
  isCmsPageSlug,
  modernizeItemConfig,
  normalizeElements,
  normalizeFocal,
  safeBackground,
  safeUrl,
} from '@/lib/cms-config'
import { getPrisma } from '@/lib/prisma'

type Params = { params: Promise<{ page: string }> }

const cacheHeaders = { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' }

export async function GET(_request: Request, { params }: Params) {
  const { page: slug } = await params
  if (!isCmsPageSlug(slug)) return NextResponse.json({ error: 'ไม่พบหน้า CMS' }, { status: 404, headers: cacheHeaders })
  const page = await getPrisma().cmsPage.findUnique({
    where: { slug },
    include: { sections: { orderBy: { sortOrder: 'asc' }, include: { items: { where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } } },
  })
  if (!page) return NextResponse.json({ error: 'ไม่พบหน้า CMS' }, { status: 404, headers: cacheHeaders })

  const definitions = CMS_PAGE_SECTIONS[slug]
  const expectedWorkType = slug === 'novel'
    ? 'novel' as const
    : slug === 'manga'
      ? 'manga' as const
      : slug === 'audio'
        ? 'audiobook' as const
        : null
  const bookIds = [...new Set(page.sections.flatMap((section) => section.items.flatMap((item) => {
    const config = asItemConfig(item.config)
    return item.enabled && typeof config.bookId === 'string' && config.bookId ? [config.bookId] : []
  })))]
  const works = bookIds.length ? await getPrisma().creatorWork.findMany({
    where: {
      id: { in: bookIds },
      status: 'published',
      episodes: { some: { status: 'published' } },
      ...(expectedWorkType ? { type: expectedWorkType } : {}),
    },
    select: {
      id: true,
      type: true,
      title: true,
      category: true,
      origin: true,
      narrationType: true,
      tagline: true,
      synopsis: true,
      views: true,
      coverObjectKey: true,
      coverIsPublic: true,
      creator: { select: { name: true, writerApplication: { select: { penName: true } } } },
      _count: { select: { episodes: { where: { status: 'published' } } } },
    },
  }) : []
  const workById = new Map(works.map((work) => [work.id, work]))
  const sectionByKey = new Map(page.sections.map((section) => [section.key, section]))
  const sections = definitions.flatMap((definition) => {
    const section = sectionByKey.get(definition.key)
    if (!section) return []
    const sectionConfig = asSectionConfig(section.config)
    const mode = sectionConfig.mode ?? 'manual'
    const items = section.enabled ? section.items.filter((item) => {
      const config = asItemConfig(item.config)
      const inferredVariant = typeof config.variant === 'string' ? config.variant : ['sale', 'recommend', 'web-books'].includes(section.key) ? 'book' : 'default'
      const isBookGroup = ['recommend', 'web-books'].includes(section.key) && inferredVariant === 'book'
      if (!isBookGroup) return true
      return mode === 'manual' ? config.source !== 'generated' : config.source === 'generated'
    }).flatMap((item) => {
      const config = modernizeItemConfig(item.config, item)
      const inferredVariant = typeof config.variant === 'string' ? config.variant : ['sale', 'recommend', 'web-books'].includes(section.key) ? 'book' : 'default'
      const book = typeof config.bookId === 'string' ? workById.get(config.bookId) : undefined
      const requiresPublishedBook = ['sale', 'recommend', 'web-books'].includes(section.key) && inferredVariant === 'book'
      if (requiresPublishedBook && !book) return []
      return [{
        id: item.id,
        title: item.title,
        subtitle: item.subtitle ?? '',
        imageUrl: safeUrl(item.imageUrl),
        mobileImageUrl: safeUrl(config.mobileImageUrl, safeUrl(item.imageUrl)),
        linkUrl: safeUrl(item.linkUrl),
        placement: {
          variant: inferredVariant,
          column: Number.isInteger(config.column) ? config.column : 0,
          slot: Number.isInteger(config.slot) ? config.slot : null,
        },
        source: config.source === 'generated' ? 'generated' : 'manual',
        book: book ? {
          id: book.id,
          type: book.type,
          title: book.title,
          author: book.creator.writerApplication?.penName || book.creator.name,
          category: book.category,
          origin: book.origin,
          narrationType: book.narrationType,
          tagline: book.tagline,
          synopsis: book.synopsis,
          views: book.views,
          episodeCount: book._count.episodes,
          hasCover: Boolean(book.coverObjectKey) && book.coverIsPublic,
        } : null,
        promotion: {
          badge: typeof config.badge === 'string' ? config.badge : '',
          discount: typeof config.discount === 'string' ? config.discount : '',
          countdownSeconds: typeof config.countdownSeconds === 'number' ? Math.max(0, Math.round(config.countdownSeconds)) : 0,
        },
        visual: {
          background: safeBackground(config.background),
          focal: normalizeFocal(config.focal),
          elements: normalizeElements(config.elements),
        },
      }]
    }) : []
    return [{
      key: section.key,
      title: section.title,
      enabled: section.enabled,
      layout: { kind: definition.kind, columns: definition.columns, aspect: definition.aspect },
      config: { mode, slotEnabled: sectionConfig.slotEnabled ?? {} },
      items,
    }]
  })

  return NextResponse.json({
    page: { slug: page.slug, label: page.label, slideSeconds: Math.min(60, Math.max(1, page.slideSeconds)) },
    sections,
  }, { headers: cacheHeaders })
}
