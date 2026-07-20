import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { createMemberSession, serializeAuthUser } from '@/lib/member-auth'
import { validateRegistrationInput } from '@/lib/member-auth-validation'

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function POST(request: NextRequest) {
  try {
    const result = validateRegistrationInput(await request.json().catch(() => null))
    if (!result.success) {
      return NextResponse.json({ error: 'กรุณาตรวจสอบข้อมูลที่กรอก', fields: result.fields }, { status: 400 })
    }

    const { name, email, password } = result.data
    const prisma = getPrisma()
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 })

    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashPassword(password), userType: 'user' },
    })
    await createMemberSession(user.id)

    return NextResponse.json({ ok: true, user: serializeAuthUser(user) }, { status: 201 })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 })
    }
    console.error('Member registration failed', error)
    return NextResponse.json({ error: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
