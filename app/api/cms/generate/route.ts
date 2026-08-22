import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { asSectionConfig, cmsItemLimit, getSectionDefinition, isCmsPageSlug, type CmsAutoMode, type CmsPageSlug } from '@/lib/cms-config'
import { cmsGenerationSort, cmsGenerationWorkType, generatedItemMatchesGroup } from '@/lib/cms-generation'
import { getPrisma } from '@/lib/prisma'

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
  const body = await request.json() as { sectionId?: string; mode?: CmsAutoMode; group?: string }
  if (!body.sectionId || !['popular', 'views', 'votes', 'random'].includes(body.mode ?? '')) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const mode = body.mode as Exclude<CmsAutoMode, 'manual'>
  const prisma = getPrisma()
  const section = await prisma.cmsSection.findUnique({ where: { id: body.sectionId }, include: { page: true, items: true } })
  if (!section || !isCmsPageSlug(section.page.slug)) return NextResponse.json({ error: 'ไม่พบ section' }, { status: 404 })
  const definition = getSectionDefinition(section.page.slug, section.key)
  if (!definition || !['recommend', 'web-books'].includes(section.key) && definition.kind !== 'grouped-books') return NextResponse.json({ error: 'section นี้ไม่รองรับโหมดอัตโนมัติ' }, { status: 400 })
  const group = body.group?.trim() || undefined
  if (definition.groupKeys?.length && (!group || !definition.groupKeys.includes(group))) return NextResponse.json({ error: 'กลุ่มรายการไม่ถูกต้อง' }, { status: 400 })
  if (!definition.groupKeys?.length && group) return NextResponse.json({ error: 'section นี้ไม่มีกลุ่มย่อย' }, { status: 400 })

  const type = cmsGenerationWorkType(section.page.slug as CmsPageSlug, section.key, group)
  const sort = cmsGenerationSort(mode)
  const configForLimit = { variant: 'book', group }
  const limit = cmsItemLimit(definition, configForLimit)
  const candidates = await prisma.creatorWork.findMany({
    where: { status: 'published', episodes: { some: { status: 'published' } }, ...(type ? { type } : {}) },
    select: {
      id: true, type: true, title: true, category: true, tagline: true, views: true, dailyVotes: true, updatedAt: true,
      creator: { select: { name: true, writerApplication: { select: { penName: true } } } },
      _count: { select: { episodes: { where: { status: 'published' } } } },
    },
    orderBy: sort === 'dailyVotes'
      ? [{ dailyVotes: 'desc' }, { views: 'desc' }, { updatedAt: 'desc' }]
      : sort === 'views'
        ? [{ views: 'desc' }, { updatedAt: 'desc' }]
        : [{ updatedAt: 'desc' }],
    take: mode === 'random' ? 200 : limit,
  })
  const chosen = (mode === 'random' ? shuffle(candidates) : candidates).slice(0, limit)
  const generatedIds = section.items.filter((item) => generatedItemMatchesGroup(item.config, group)).map((item) => item.id)
  const currentSectionConfig = asSectionConfig(section.config)
  const sectionConfig = group
    ? { ...currentSectionConfig, groupModes: { ...currentSectionConfig.groupModes, [group]: mode } }
    : { ...currentSectionConfig, mode }

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
          subtitle: work.tagline || `${creatorName} · ${work.category} · ${work._count.episodes} ตอน`,
          imageUrl: `/api/public/catalog/works/${work.id}/cover`,
          enabled: true,
          sortOrder: index,
          config: { variant: 'book', source: 'generated', ...(group ? { group } : {}), column: definition.groupKeys?.indexOf(group ?? '') ?? 0, bookId: work.id, workType: work.type, views: work.views, dailyVotes: work.dailyVotes, creatorName },
        },
      })
    }
    await tx.auditLog.create({ data: { adminId: auth.admin.id, action: `cms.generate.${mode}`, entity: 'CmsSection', entityId: `${section.id}${group ? `:${group}` : ''}` } })
  })

  const result = await prisma.cmsSection.findUnique({ where: { id: section.id }, include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } })
  return NextResponse.json(result)
}
