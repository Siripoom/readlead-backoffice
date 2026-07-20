import { NextResponse } from 'next/server'
import { destroyMemberSession } from '@/lib/member-auth'

export async function POST() {
  try {
    await destroyMemberSession()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Member logout failed', error)
    return NextResponse.json({ error: 'ออกจากระบบไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
