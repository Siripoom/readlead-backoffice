export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserById, updateUserName, updateUserStatus } from '@/lib/db/users'
import type { UserStatus } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const { id } = await params
  const user = await getUserById(id)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const { id } = await params
  const target = await getPrisma().user.findUnique({ where: { id }, include: { adminProfile: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.adminProfile) {
    if (!auth.admin.isOwner && !auth.admin.permissions.includes('admins')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (target.adminProfile.isOwner && target.adminProfile.id !== auth.admin.id) return NextResponse.json({ error: 'ไม่สามารถแก้ไขเจ้าของระบบ' }, { status: 403 })
  }
  const body = await request.json() as { status?: UserStatus; name?: string; role?: string; permissions?: string[] }
  if (target.adminProfile?.isOwner && body.status && body.status !== 'active') return NextResponse.json({ error: 'เจ้าของระบบต้องคงสถานะใช้งาน' }, { status: 403 })
  if (body.status) await updateUserStatus(id, body.status)
  if (body.name) await updateUserName(id, body.name)
  if (target.adminProfile && !target.adminProfile.isOwner && (body.role || body.permissions)) {
    await getPrisma().adminProfile.update({ where: { id: target.adminProfile.id }, data: { role: body.role, permissions: body.permissions } })
  }
  const user = await getUserById(id)
  return NextResponse.json(user)
}
