export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUsers, getUsersByType } from '@/lib/db/users'
import type { UserStatus, UserType } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'
import { validatePermissionGrant } from '@/lib/admin-permissions'
import { hashPassword } from '@/lib/password'

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') as UserType | null

  const users = type ? await getUsersByType(type) : await getUsers()
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const body = await request.json() as {
    name: string
    email: string
    userType?: UserType
    status?: UserStatus
    works?: number
    followers?: number
    role?: string
    password?: string
    permissions?: string[]
  }
  const { name, email, userType = 'user', status = 'active', works, followers, role, password, permissions } = body
  if (userType === 'admin' && (!role || !password || password.length < 8)) return NextResponse.json({ error: 'แอดมินต้องมีบทบาทและรหัสผ่านอย่างน้อย 8 ตัว' }, { status: 400 })
  if (userType === 'admin' && !auth.admin.isOwner && !auth.admin.permissions.includes('admins')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const permissionGrant = userType === 'admin'
    ? validatePermissionGrant(permissions ?? ['dashboard'], auth.admin)
    : null
  if (permissionGrant && !permissionGrant.ok) {
    return NextResponse.json({ error: permissionGrant.error }, { status: permissionGrant.status })
  }
  const user = await createUser({
    name,
    email,
    userType,
    status,
    creatorProfile: userType === 'creator' ? { works: works ?? 0, followers: followers ?? 0 } : undefined,
    adminProfile: userType === 'admin' && role && password && permissionGrant?.ok ? { role, adminCode: `AD-${Date.now().toString().slice(-6)}`, passwordHash: hashPassword(password), permissions: permissionGrant.permissions } : undefined,
  })
  return NextResponse.json(user, { status: 201 })
}
