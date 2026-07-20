import { NextResponse } from 'next/server'
import { getMemberSessionUser } from '@/lib/member-auth'

export async function GET() {
  try {
    return NextResponse.json({ user: await getMemberSessionUser() })
  } catch (error) {
    console.error('Member session lookup failed', error)
    return NextResponse.json({ error: 'ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ' }, { status: 500 })
  }
}
