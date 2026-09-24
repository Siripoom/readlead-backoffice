export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserById, updateUserName } from '@/lib/db/users'
import type { UserStatus } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'
import { validatePermissionGrant } from '@/lib/admin-permissions'
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
  let validatedPermissions = body.permissions
  if (body.permissions !== undefined) {
    const permissionGrant = validatePermissionGrant(body.permissions, auth.admin)
    if (!permissionGrant.ok) return NextResponse.json({ error: permissionGrant.error }, { status: permissionGrant.status })
    validatedPermissions = permissionGrant.permissions
  }
  const prisma = getPrisma()
  if (body.status && body.status !== target.status) {
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id }, data: { status: body.status } })
      await transaction.auditLog.create({
        data: {
          adminId: auth.admin.id,
          action: 'user.status_changed',
          entity: 'User',
          entityId: id,
          detail: { previousStatus: target.status, status: body.status },
        },
      })
    })
  }
  if (body.name) await updateUserName(id, body.name)
  if (target.adminProfile && !target.adminProfile.isOwner && (body.role || body.permissions)) {
    await prisma.adminProfile.update({ where: { id: target.adminProfile.id }, data: { role: body.role, permissions: validatedPermissions } })
  }
  const user = await getUserById(id)
  return NextResponse.json(user)
}
