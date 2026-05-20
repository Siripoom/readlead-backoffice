import { NextRequest, NextResponse } from 'next/server'
import { getUsers, getUsersByType } from '@/lib/db/users'
import type { UserType } from '@/lib/generated/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type') as UserType | null

  const users = type ? await getUsersByType(type) : await getUsers()
  return NextResponse.json(users)
}
