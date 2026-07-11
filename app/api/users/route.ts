export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUsers, getUsersByType } from '@/lib/db/users'
import type { UserStatus, UserType } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'
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
  const user = await createUser({
    name,
    email,
    userType,
    status,
    creatorProfile: userType === 'creator' ? { works: works ?? 0, followers: followers ?? 0 } : undefined,
    adminProfile: userType === 'admin' && role && password ? { role, adminCode: `AD-${Date.now().toString().slice(-6)}`, passwordHash: hashPassword(password), permissions: permissions ?? ['dashboard'] } : undefined,
  })
  return NextResponse.json(user, { status: 201 })
}
