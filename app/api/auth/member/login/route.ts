import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { createMemberSession, serializeAuthUser } from '@/lib/member-auth'
import { validateLoginInput } from '@/lib/member-auth-validation'

export async function POST(request: NextRequest) {
  try {
    const result = validateLoginInput(await request.json().catch(() => null))
    if (!result.success) {
      return NextResponse.json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fields: result.fields }, { status: 400 })
    }

    const { email, password } = result.data
    const user = await getPrisma().user.findUnique({ where: { email } })
    const isMember = user?.userType === 'user' || user?.userType === 'creator'
    const isValid = isMember && user.status === 'active' && user.passwordHash
      ? verifyPassword(password, user.passwordHash)
      : false

    if (!user || !isValid) {
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
    }

    await createMemberSession(user.id)
    return NextResponse.json({ ok: true, user: serializeAuthUser(user) })
  } catch (error) {
    console.error('Member login failed', error)
    return NextResponse.json({ error: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
