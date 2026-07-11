import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const prisma = getPrisma()
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const slug = request.nextUrl.searchParams.get('page') ?? 'home'
  const page = await prisma.cmsPage.findUnique({ where: { slug }, include: { sections: { orderBy: { sortOrder: 'asc' }, include: { items: { orderBy: { sortOrder: 'asc' } } } } } })
  return NextResponse.json(page)
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma()
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const body = await request.json() as { sectionId?: string; title?: string; subtitle?: string; imageUrl?: string; linkUrl?: string; config?: object }
  if (!body.sectionId || !body.title?.trim()) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const count = await prisma.cmsItem.count({ where: { sectionId: body.sectionId } })
  const item = await prisma.cmsItem.create({ data: { sectionId: body.sectionId, title: body.title.trim(), subtitle: body.subtitle, imageUrl: body.imageUrl, linkUrl: body.linkUrl, config: body.config, sortOrder: count } })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.create', entity: 'CmsItem', entityId: item.id } })
  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const prisma = getPrisma()
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const body = await request.json() as { type?: 'page'|'section'|'item'; id?: string; slideSeconds?: number; enabled?: boolean; title?: string; subtitle?: string; imageUrl?: string; linkUrl?: string; sortOrder?: number; config?: object }
  if (!body.id || !body.type) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  if (body.type === 'page') await prisma.cmsPage.update({ where: { id: body.id }, data: { slideSeconds: body.slideSeconds } })
  if (body.type === 'section') await prisma.cmsSection.update({ where: { id: body.id }, data: { enabled: body.enabled, sortOrder: body.sortOrder } })
  if (body.type === 'item') await prisma.cmsItem.update({ where: { id: body.id }, data: { title: body.title, subtitle: body.subtitle, imageUrl: body.imageUrl, linkUrl: body.linkUrl, enabled: body.enabled, sortOrder: body.sortOrder, config: body.config } })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.update', entity: body.type, entityId: body.id } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const prisma = getPrisma()
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await prisma.cmsItem.delete({ where: { id } })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'cms.delete', entity: 'CmsItem', entityId: id } })
  return NextResponse.json({ ok: true })
}
