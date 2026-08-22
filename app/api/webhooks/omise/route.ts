export const dynamic = 'force-dynamic'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { settleMemberChargeFromWebhook } from '@/lib/member-topup-charges'

// Omise signs webhooks with HMAC-SHA256 over "<timestamp>.<raw body>" using a
// base64-decoded secret configured in the dashboard's Webhooks Settings
// (docs.omise.co/api-webhooks). Signing is opt-in on Omise's side, so this
// verifies when OMISE_WEBHOOK_SECRET is configured and otherwise falls back
// to the re-fetch-by-id trust model in settleMemberChargeFromWebhook, which
// runs regardless — the webhook body's own claims are never trusted for the
// charge's actual state either way.
function verifySignature(rawBody: string, timestamp: string | null, signatureHeader: string | null) {
  const secret = process.env.OMISE_WEBHOOK_SECRET
  if (!secret) return true
  if (!timestamp || !signatureHeader) return false
  const decodedSecret = Buffer.from(secret, 'base64')
  const expected = createHmac('sha256', decodedSecret).update(`${timestamp}.${rawBody}`).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  // During secret rotation Omise sends old and new signatures comma-separated.
  return signatureHeader.split(',').some((candidate) => {
    const candidateBuffer = Buffer.from(candidate.trim(), 'hex')
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer)
  })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const verified = verifySignature(
    rawBody,
    request.headers.get('omise-signature-timestamp'),
    request.headers.get('omise-signature'),
  )
  if (!verified) {
    console.error('Omise webhook signature verification failed')
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event: { key?: string; data?: { object?: string; id?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const chargeId = event.data?.object === 'charge' ? event.data.id : undefined
  if (!chargeId) return NextResponse.json({ ok: true, ignored: true })

  try {
    await settleMemberChargeFromWebhook(chargeId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Omise webhook settlement failed', { chargeId, error })
    return NextResponse.json({ error: 'settlement failed' }, { status: 500 })
  }
}
