export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUsers, getUsersByType } from '@/lib/db/users'
import type { UserStatus, UserType } from '@/lib/generated/prisma/enums'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') as UserType | null

  const users = type ? await getUsersByType(type) : await getUsers()
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string
    email: string
    userType?: UserType
    status?: UserStatus
    works?: number
    followers?: number
    role?: string
  }
  const { name, email, userType = 'user', status = 'active', works, followers, role } = body
  const user = await createUser({
    name,
    email,
    userType,
    status,
    creatorProfile: userType === 'creator' ? { works: works ?? 0, followers: followers ?? 0 } : undefined,
    adminProfile: userType === 'admin' && role ? { role } : undefined,
  })
  return NextResponse.json(user, { status: 201 })
}
