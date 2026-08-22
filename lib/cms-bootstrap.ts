import { CMS_PAGE_LABELS, CMS_PAGE_SECTIONS, type CmsPageSlug } from '@/lib/cms-config'
import { getPrisma } from '@/lib/prisma'

export async function ensureCmsPage(slug: CmsPageSlug) {
  const prisma = getPrisma()
  const currentPage = await prisma.cmsPage.findUnique({ where: { slug }, select: { id: true, label: true } })
  const page = currentPage
    ? currentPage.label === CMS_PAGE_LABELS[slug]
      ? currentPage
      : await prisma.cmsPage.update({ where: { id: currentPage.id }, data: { label: CMS_PAGE_LABELS[slug] }, select: { id: true, label: true } })
    : await prisma.cmsPage.upsert({
      where: { slug },
      update: { label: CMS_PAGE_LABELS[slug] },
      create: { slug, label: CMS_PAGE_LABELS[slug], slideSeconds: slug === 'rank' ? 10 : 5 },
      select: { id: true, label: true },
    })

  const definitions = CMS_PAGE_SECTIONS[slug]
  const existing = await prisma.cmsSection.findMany({ where: { pageId: page.id }, select: { key: true, title: true, sortOrder: true } })
  const keys = new Set(existing.map((section) => section.key))
  const existingByKey = new Map(existing.map((section) => [section.key, section]))
  const missing = definitions.flatMap((definition, sortOrder) => keys.has(definition.key) ? [] : [{
    pageId: page.id,
    key: definition.key,
    title: definition.title,
    sortOrder,
  }])
  if (missing.length) await prisma.cmsSection.createMany({ data: missing, skipDuplicates: true })

  await Promise.all(definitions.flatMap((definition, sortOrder) => {
    const section = existingByKey.get(definition.key)
    if (!section || section.title === definition.title && section.sortOrder === sortOrder) return []
    return [prisma.cmsSection.update({
    where: { pageId_key: { pageId: page.id, key: definition.key } },
    data: { title: definition.title, sortOrder },
    })]
  }))

  if (slug === 'search') {
    const hero = await prisma.cmsSection.findUnique({ where: { pageId_key: { pageId: page.id, key: 'hero' } }, select: { id: true } })
    if (hero && await prisma.cmsItem.count({ where: { sectionId: hero.id } }) === 0) {
      await prisma.cmsItem.create({
        data: {
          sectionId: hero.id,
          title: 'ค้นพบเรื่องที่ใช่ในแบบของคุณ',
          subtitle: 'ค้นหานิยาย เว็บตูน หนังสือเสียงที่คุณสนใจ',
          enabled: true,
          config: {
            variant: 'default',
            column: 0,
            source: 'manual',
            background: 'linear-gradient(135deg,#27312f,#0e8e80)',
            focal: { x: 50, y: 50, zoom: 100 },
            elements: [
              { id: 'title-1', type: 'title', text: 'ค้นพบเรื่องที่ใช่ในแบบของคุณ', x: 5, y: 25, scale: 1, color: '#ffffff', bold: true, shadow: true },
              { id: 'text-1', type: 'text', text: 'ค้นหานิยาย เว็บตูน หนังสือเสียงที่คุณสนใจ', x: 5, y: 55, scale: 1, color: '#ffffff', shadow: true },
            ],
          },
        },
      })
    }
  }

  return page.id
}
