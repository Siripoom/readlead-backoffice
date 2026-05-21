export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserById, updateUserStatus } from '@/lib/db/users'
import type { UserStatus } from '@/lib/generated/prisma/enums'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getUserById(id)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as { status: UserStatus }
  const user = await updateUserStatus(id, body.status)
  return NextResponse.json(user)
}
