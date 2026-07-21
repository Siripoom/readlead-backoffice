import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { asItemConfig, asSectionConfig, type CmsPageSlug } from '@/lib/cms-config'
import { getPrisma } from '@/lib/prisma'

const typeByPage: Partial<Record<CmsPageSlug, 'novel' | 'manga' | 'audiobook'>> = {
  novel: 'novel', manga: 'manga', audio: 'audiobook',
}

function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const body = await request.json() as { sectionId?: string; mode?: 'popular' | 'random' }
  if (!body.sectionId || !['popular', 'random'].includes(body.mode ?? '')) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const mode = body.mode as 'popular' | 'random'
  const prisma = getPrisma()
  const section = await prisma.cmsSection.findUnique({ where: { id: body.sectionId }, include: { page: true, items: true } })
  if (!section || !['recommend', 'web-books'].includes(section.key)) return NextResponse.json({ error: 'section นี้ไม่รองรับโหมดอัตโนมัติ' }, { status: 400 })

  const type = typeByPage[section.page.slug as CmsPageSlug]
  const candidates = await prisma.creatorWork.findMany({
    where: { status: 'published', episodes: { some: { status: 'published' } }, ...(type ? { type } : {}) },
    select: {
      id: true, type: true, title: true, tagline: true, views: true, updatedAt: true,
      creator: { select: { name: true, writerApplication: { select: { penName: true } } } },
      _count: { select: { episodes: { where: { status: 'published' } } } },
    },
    orderBy: mode === 'popular' ? [{ views: 'desc' }, { updatedAt: 'desc' }] : [{ updatedAt: 'desc' }],
    take: mode === 'popular' ? 21 : 200,
  })
  const chosen = (mode === 'random' ? shuffle(candidates) : candidates).slice(0, 21)
  const generatedIds = section.items.filter((item) => asItemConfig(item.config).source === 'generated').map((item) => item.id)
  const sectionConfig = { ...asSectionConfig(section.config), mode }

  await prisma.$transaction(async (tx) => {
    if (generatedIds.length) await tx.cmsItem.deleteMany({ where: { id: { in: generatedIds } } })
    await tx.cmsSection.update({ where: { id: section.id }, data: { config: sectionConfig } })
    for (let index = 0; index < chosen.length; index++) {
      const work = chosen[index]
      const creatorName = work.creator.writerApplication?.penName || work.creator.name
      await tx.cmsItem.create({
        data: {
          sectionId: section.id,
          title: work.title,
          subtitle: work.tagline || `${creatorName} · ${work._count.episodes} ตอน`,
          imageUrl: `/api/public/catalog/works/${work.id}/cover`,
          enabled: true,
          sortOrder: index,
          config: { variant: 'book', source: 'generated', bookId: work.id, workType: work.type, views: work.views, creatorName },
        },
      })
    }
    await tx.auditLog.create({ data: { adminId: auth.admin.id, action: `cms.generate.${mode}`, entity: 'CmsSection', entityId: section.id } })
  })

  const result = await prisma.cmsSection.findUnique({ where: { id: section.id }, include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } })
  return NextResponse.json(result)
}
