export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { ApplePayError, createApplePayMerchantSession } from '@/lib/apple-pay'

// Called from ApplePaySession.onvalidatemerchant in the browser. Member-only
// (authorizeMember) so an anonymous caller can't burn our merchant identity
// certificate against Apple.
export async function POST(request: Request) {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response

  let body: { validationURL?: unknown }
  try {
    body = (await request.json()) as { validationURL?: unknown }
  } catch {
    return privateJson({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400)
  }

  try {
    const merchantSession = await createApplePayMerchantSession(body.validationURL)
    return privateJson({ merchantSession })
  } catch (error) {
    if (error instanceof ApplePayError) return privateJson({ error: error.message }, error.status)
    console.error('Apple Pay merchant session failed', error)
    return privateJson({ error: 'ยืนยันร้านค้ากับ Apple ไม่สำเร็จ' }, 500)
  }
}
