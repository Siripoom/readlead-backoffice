import 'server-only'

import { randomUUID } from 'node:crypto'
import Omise from 'omise'
import { getPrisma } from '@/lib/prisma'
import { getWalletPackage } from '@/lib/wallet-packages'
import { getWalletChannel } from '@/lib/wallet-channels'
import { creditTopUp } from '@/lib/db/coin-topups'
import { topUpReference } from '@/lib/member-topups'
import type { CoinTopUpStatus } from '@/lib/generated/prisma/enums'

const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9:_-]{8,160}$/

export class MemberChargeError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'MemberChargeError'
  }
}

function omiseClient() {
  const secretKey = process.env.OMISE_SECRET_KEY
  if (!secretKey) throw new MemberChargeError(503, 'ระบบชำระเงินยังไม่พร้อมใช้งาน')
  return Omise({ secretKey })
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new MemberChargeError(400, `กรุณาระบุ${label}`)
  return text
}

// Terminal statuses never transition further — once here, the webhook and
// the create-charge idempotent-replay path both skip re-crediting/re-fetching.
function isTerminalStatus(status: CoinTopUpStatus) {
  return status === 'approved' || status === 'failed' || status === 'expired' || status === 'rejected'
}

// Omise's ChargeStatus ("failed" | "reversed" | "expired" | "pending" |
// "successful") maps onto our broader CoinTopUpStatus enum, which is shared
// with the manual slip-review flow.
function mapOmiseStatus(omiseStatus: string): CoinTopUpStatus {
  if (omiseStatus === 'successful') return 'approved'
  if (omiseStatus === 'expired') return 'expired'
  if (omiseStatus === 'pending') return 'authorizing'
  return 'failed' // failed, reversed, or any status this integration doesn't recognize
}

type CoinTopUpRequestRow = {
  id: string
  status: CoinTopUpStatus
  omiseChargeId: string | null
  omiseChargeStatus: string | null
}

export type MemberChargeDto = {
  chargeId: string
  status: 'pending' | 'authorizing' | 'approved' | 'failed' | 'expired'
  flow: 'redirect' | 'qr' | 'completed'
  authorizeUri?: string
  qrImageUri?: string
  expiresAt?: string
  reference: string | null
}

function chargeDto(request: CoinTopUpRequestRow, omiseCharge?: Omise.Charges.ICharge): MemberChargeDto {
  const status = omiseCharge ? mapOmiseStatus(omiseCharge.status) : request.status
  const qrImageUri = omiseCharge?.source?.scannable_code?.image?.download_uri || undefined
  const authorizeUri = omiseCharge?.authorize_uri || undefined
  const flow: MemberChargeDto['flow'] =
    status === 'approved' || status === 'failed' || status === 'expired' || status === 'rejected'
      ? 'completed'
      : qrImageUri
        ? 'qr'
        : authorizeUri
          ? 'redirect'
          : 'completed'
  return {
    chargeId: request.omiseChargeId ?? request.id,
    status: status === 'rejected' ? 'failed' : status,
    flow,
    authorizeUri,
    qrImageUri,
    expiresAt: omiseCharge?.expires_at || undefined,
    reference: topUpReference(request.id),
  }
}

// Persists a charge's terminal state and credits the coins, shared by both
// the webhook handler and the polling path below. Without this, polling
// would report Omise's live "successful" status to the client (making the
// dialog show success) while the DB — and the user's balance — never
// actually updated, since a localhost dev server can never receive Omise's
// webhook call. Idempotent: the optimistic `updateMany` compare-and-swap
// plus creditTopUp's unique CoinLedger.idempotencyKey mean this is safe to
// call concurrently from both the webhook and a poll for the same charge.
async function settleFromOmiseCharge(
  request: CoinTopUpRequestRow,
  omiseCharge: Omise.Charges.ICharge,
): Promise<CoinTopUpRequestRow> {
  const status = mapOmiseStatus(omiseCharge.status)
  if (isTerminalStatus(request.status) || status === request.status) return request

  const prisma = getPrisma()
  try {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.coinTopUpRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: { status, omiseChargeStatus: omiseCharge.status },
      })
      if (!claimed.count) return request
      const fresh = await tx.coinTopUpRequest.findUniqueOrThrow({ where: { id: request.id } })
      if (status === 'approved') {
        await creditTopUp(tx, fresh, `topup-gateway:${omiseCharge.id}`)
      }
      return fresh
    })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      return (await prisma.coinTopUpRequest.findUnique({ where: { id: request.id } })) ?? request
    }
    throw error
  }
}

// Re-fetches the charge from Omise while it's still in flight (needed to
// reconstruct the QR image / 3DS redirect URL, which we never persist).
// Once terminal, serves the stored row instead of hitting Omise again.
async function refreshedChargeDto(request: CoinTopUpRequestRow): Promise<MemberChargeDto> {
  if (isTerminalStatus(request.status) || !request.omiseChargeId) return chargeDto(request)
  try {
    const omise = omiseClient()
    const omiseCharge = await omise.charges.retrieve(request.omiseChargeId)
    const settled = await settleFromOmiseCharge(request, omiseCharge)
    return chargeDto(settled, omiseCharge)
  } catch {
    return chargeDto(request)
  }
}

export async function createMemberCharge(
  userId: string,
  input: { packageId?: unknown; channelId?: unknown; omiseToken?: unknown; mobileNumber?: unknown },
  idempotencyKeyHeader: string | null,
): Promise<{ charge: MemberChargeDto; idempotent: boolean }> {
  const packageId = requiredText(input.packageId, 'แพ็กเกจ')
  const walletPackage = getWalletPackage(packageId)
  if (!walletPackage) throw new MemberChargeError(400, 'แพ็กเกจเติมเหรียญไม่ถูกต้อง')

  const channelId = requiredText(input.channelId, 'ช่องทางชำระเงิน')
  const channel = getWalletChannel(channelId)
  if (!channel || channel.kind !== 'gateway' || !channel.enabled) {
    throw new MemberChargeError(400, 'ช่องทางชำระเงินนี้ยังไม่เปิดใช้งาน')
  }

  const clientKey = requiredText(idempotencyKeyHeader, 'รหัสรายการ')
  if (!IDEMPOTENCY_PATTERN.test(clientKey)) throw new MemberChargeError(400, 'รหัสรายการไม่ถูกต้อง')
  const idempotencyKey = `member-topup-charge:${userId}:${clientKey}`

  const prisma = getPrisma()
  const existing = await prisma.coinTopUpRequest.findUnique({ where: { idempotencyKey } })
  if (existing) return { charge: await refreshedChargeDto(existing), idempotent: true }

  // Card, Apple Pay, and Google Pay all require a token minted client-side
  // via omise.js (card details / wallet tokens never touch this server —
  // for Google Pay, omise.js exchanges the Google Pay token for a regular
  // Omise card token before it ever reaches us). PromptPay/ShopeePay/
  // TrueMoney sources carry no sensitive data (TrueMoney needs only a phone
  // number), so the source is created inline here.
  //
  // Mobile contract (no separate endpoint needed): a future native app
  // authenticates via the existing POST /api/auth/member/login|google|
  // facebook|apple, stores the resulting rl_user_session cookie, then for
  // apple-pay/google-pay mints an Omise token itself using Omise's iOS/
  // Android SDK from a native PassKit/Google Pay payment (the mobile
  // equivalent of omise.js) and POSTs it here as `omiseToken` with
  // channelId 'apple-pay' or 'google-pay' — this function can't tell the
  // difference between a web-minted and a native-minted token, so none is
  // needed.
  const amountSatang = walletPackage.price * 100
  let card: string | undefined
  let source: { type: string; amount: number; currency: string; phone_number?: string } | undefined
  if (channel.instrument === 'card' || channel.instrument === 'apple-pay' || channel.instrument === 'google-pay') {
    card = requiredText(input.omiseToken, 'โทเคนบัตร')
  } else if (channel.instrument === 'promptpay') {
    source = { type: 'promptpay', amount: amountSatang, currency: 'thb' }
  } else if (channel.instrument === 'shopeepay') {
    source = { type: 'shopeepay', amount: amountSatang, currency: 'thb' }
  } else if (channel.instrument === 'truemoney') {
    const phoneNumber = requiredText(input.mobileNumber, 'เบอร์โทรศัพท์')
    if (!/^0\d{9}$/.test(phoneNumber)) throw new MemberChargeError(400, 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง')
    source = { type: 'truemoney', amount: amountSatang, currency: 'thb', phone_number: phoneNumber }
  } else {
    throw new MemberChargeError(400, 'ช่องทางชำระเงินนี้ยังไม่รองรับ')
  }

  const omise = omiseClient()
  const requestId = randomUUID()
  // Required by Omise for any flow that leaves the page (3DS challenge,
  // TrueMoney app switch) — omitted only for pure offline-QR sources
  // (PromptPay/ShopeePay), which Omise documents as having no return_uri.
  const returnUri = process.env.WEB_APP_URL
    ? `${process.env.WEB_APP_URL.replace(/\/$/, '')}/profile/${encodeURIComponent(userId)}?tab=wallet`
    : undefined

  let omiseCharge: Omise.Charges.ICharge
  try {
    omiseCharge = await omise.charges.create({
      amount: amountSatang,
      currency: 'thb',
      ...(card ? { card } : {}),
      ...(source ? { source } : {}),
      ...(returnUri ? { return_uri: returnUri } : {}),
      metadata: { userId, packageId: walletPackage.id, requestId },
    })
  } catch (error) {
    console.error('Omise charge creation failed', error)
    throw new MemberChargeError(502, 'เชื่อมต่อระบบชำระเงินไม่สำเร็จ กรุณาลองใหม่')
  }

  const status = mapOmiseStatus(omiseCharge.status)
  try {
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.coinTopUpRequest.create({
        data: {
          id: requestId,
          userId,
          packageId: walletPackage.id,
          baseCoins: walletPackage.coins,
          bonusCoins: walletPackage.bonus,
          totalCoins: walletPackage.coins + walletPackage.bonus,
          amountSatang,
          idempotencyKey,
          paymentMethod: channel.id,
          status,
          omiseChargeId: omiseCharge.id,
          omiseChargeStatus: omiseCharge.status,
          omiseSourceType: source?.type ?? (card ? channel.instrument : null),
        },
      })
      if (status === 'approved') {
        await creditTopUp(tx, created, `topup-gateway:${omiseCharge.id}`)
      }
      return created
    })
    return { charge: chargeDto(request, omiseCharge), idempotent: false }
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const duplicate = await prisma.coinTopUpRequest.findUnique({ where: { idempotencyKey } })
      if (duplicate) return { charge: await refreshedChargeDto(duplicate), idempotent: true }
    }
    throw error
  }
}

export async function getMemberCharge(userId: string, chargeId: string): Promise<MemberChargeDto | null> {
  const prisma = getPrisma()
  const request = await prisma.coinTopUpRequest.findFirst({ where: { userId, omiseChargeId: chargeId } })
  if (!request) return null
  return refreshedChargeDto(request)
}

// Called by the Omise webhook handler. Never trusts the webhook payload for
// the charge's actual state — always re-fetches by id from Omise's API, so
// signature verification is defense-in-depth rather than the only guard.
// Shares settleFromOmiseCharge with the polling path, so a retried webhook
// or a webhook racing a poll both credit the balance at most once.
export async function settleMemberChargeFromWebhook(omiseChargeId: string): Promise<void> {
  const omise = omiseClient()
  const omiseCharge = await omise.charges.retrieve(omiseChargeId)
  const prisma = getPrisma()
  const request = await prisma.coinTopUpRequest.findUnique({ where: { omiseChargeId } })
  if (!request) return
  await settleFromOmiseCharge(request, omiseCharge)
}
