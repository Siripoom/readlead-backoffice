import { NextRequest, NextResponse } from 'next/server'
import { createMemberSession, getMemberSessionUser, serializeAuthUser } from '@/lib/member-auth'
import {
  authenticateGoogleMember,
  GoogleMemberAuthError,
  verifyGoogleIdToken,
} from '@/lib/google-member-auth'
import { FirebaseAdminConfigurationError } from '@/lib/firebase-admin'

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { idToken?: unknown } | null
    const idToken = typeof body?.idToken === 'string' ? body.idToken.trim() : ''
    if (!idToken || idToken.length > 16_384) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลยืนยันตัวตนจาก Google' }, { status: 400 })
    }

    const currentUser = await getMemberSessionUser()
    const identity = await verifyGoogleIdToken(idToken, Boolean(currentUser))
    const user = await authenticateGoogleMember(identity, currentUser?.id ?? null)

    if (!currentUser) await createMemberSession(user.id)
    return NextResponse.json({ ok: true, user: serializeAuthUser(user) })
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError) {
      console.error('Firebase Admin SDK is not configured', { issue: error.issue })
      return NextResponse.json({ error: 'ระบบเข้าสู่ระบบด้วย Google ยังไม่พร้อมใช้งาน' }, { status: 503 })
    }
    if (error instanceof GoogleMemberAuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: 'บัญชี Google หรืออีเมลนี้ถูกเชื่อมกับบัญชีอื่นแล้ว' }, { status: 409 })
    }
    console.error('Member Google authentication failed', error)
    return NextResponse.json({ error: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }
}
