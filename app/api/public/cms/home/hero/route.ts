import { getPrisma } from '@/lib/prisma'
import { modernizeItemConfig, normalizeElements, normalizeFocal, safeBackground, safeUrl } from '@/lib/cms-config'
import { ensureCmsPage } from '@/lib/cms-bootstrap'

const cacheHeaders = {
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
}

const defaultVisual = { x: 8, y: 55, size: 100, color: '#ffffff' }

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback
}

function clamp(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

function color(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : defaultVisual.color
}

function mediaUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const candidate = value.trim()
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function href(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '/discover'
  const candidate = value.trim()
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '/discover'
  } catch {
    return '/discover'
  }
}

export async function GET() {
  await ensureCmsPage('home')
  const prisma = getPrisma()
  const page = await prisma.cmsPage.findUnique({
    where: { slug: 'home' },
    select: {
      slideSeconds: true,
      sections: {
        where: { key: 'hero' },
        take: 1,
        select: {
          enabled: true,
          items: {
            where: { enabled: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, title: true, subtitle: true, imageUrl: true, linkUrl: true, config: true },
          },
        },
      },
    },
  })

  const section = page?.sections[0]
  const enabled = section?.enabled ?? true
  const items = enabled
    ? (section?.items ?? []).flatMap((item) => {
        const desktopImageUrl = mediaUrl(item.imageUrl)
        const title = item.title.trim()
        if (!title) return []
        const config = modernizeItemConfig(item.config, item)
        const elements = normalizeElements(config.elements)
        const titleElement = elements.find((element) => element.type === 'title')
        const badgeElement = elements.find((element) => element.type === 'badge')
        const textElement = elements.find((element) => element.type === 'text')
        const buttonElement = elements.find((element) => element.type === 'button')
        return [{
          id: item.id,
          badge: badgeElement?.text || text(config.badge),
          title: titleElement?.text || title,
          description: textElement?.text || item.subtitle?.trim() || '',
          ctaLabel: buttonElement?.text || text(config.ctaLabel, 'อ่านเลย'),
          href: href(buttonElement?.link || item.linkUrl),
          desktopImageUrl: desktopImageUrl ?? '',
          mobileImageUrl: mediaUrl(safeUrl(config.mobileImageUrl)) ?? desktopImageUrl ?? '',
          background: safeBackground(config.background),
          focal: normalizeFocal(config.focal),
          visual: {
            x: clamp(titleElement?.x ?? config.x, defaultVisual.x, 0, 90),
            y: clamp(titleElement?.y ?? config.y, defaultVisual.y, 10, 90),
            size: clamp((titleElement?.scale ?? 0) * 100 || config.size, defaultVisual.size, 50, 240),
            color: color(titleElement?.color ?? config.color),
          },
        }]
      })
    : []

  return Response.json({
    enabled,
    slideSeconds: clamp(page?.slideSeconds, 5, 1, 60),
    items,
  }, { headers: cacheHeaders })
}
