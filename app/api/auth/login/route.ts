import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrisma()
    const body = await request.json().catch(() => null) as { email?: string; password?: string } | null
    if (!body?.email || !body.password) return NextResponse.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 })
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }, include: { adminProfile: true } })
    if (!user?.adminProfile || user.status !== 'active' || !verifyPassword(body.password, user.adminProfile.passwordHash)) {
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }
    await createSession(user.adminProfile.id)
    await prisma.adminProfile.update({ where: { id: user.adminProfile.id }, data: { lastLogin: new Date() } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin login failed', error)
    return NextResponse.json({ error: 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
