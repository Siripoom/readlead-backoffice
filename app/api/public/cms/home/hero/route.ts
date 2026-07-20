import { getPrisma } from '@/lib/prisma'

const cacheHeaders = {
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
}

const defaultVisual = { x: 8, y: 55, size: 100, color: '#ffffff' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

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
        if (!desktopImageUrl || !title) return []
        const config = isRecord(item.config) ? item.config : {}
        return [{
          id: item.id,
          badge: text(config.badge),
          title,
          description: item.subtitle?.trim() ?? '',
          ctaLabel: text(config.ctaLabel, 'อ่านเลย'),
          href: href(item.linkUrl),
          desktopImageUrl,
          mobileImageUrl: mediaUrl(config.mobileImageUrl) ?? desktopImageUrl,
          visual: {
            x: clamp(config.x, defaultVisual.x, 0, 90),
            y: clamp(config.y, defaultVisual.y, 10, 90),
            size: clamp(config.size, defaultVisual.size, 50, 240),
            color: color(config.color),
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
