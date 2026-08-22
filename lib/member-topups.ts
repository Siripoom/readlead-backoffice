import 'server-only'

import { randomUUID } from 'node:crypto'
import { getPrisma } from '@/lib/prisma'
import { deleteTopUpProof, uploadTopUpProof } from '@/lib/storage/backblaze'
import { getWalletPackage } from '@/lib/wallet-packages'

const MAX_SLIP_SIZE = 5 * 1024 * 1024
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9:_-]{8,160}$/

export class MemberTopUpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'MemberTopUpError'
  }
}

export function topUpReference(id: string) {
  return `#TU-${id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()}`
}

export function memberTopUpDto(request: {
  id: string
  packageId: string
  baseCoins: number
  bonusCoins: number
  totalCoins: number
  amountSatang: number
  paymentMethod: string
  status: 'pending' | 'approved' | 'rejected' | 'authorizing' | 'failed' | 'expired'
  rejectionReason: string | null
  reviewedAt: Date | null
  submittedAt: Date
}, balanceAfter: number | null = null) {
  return {
    id: request.id,
    reference: topUpReference(request.id),
    createdAt: request.submittedAt.toISOString(),
    packageId: request.packageId,
    coins: request.totalCoins,
    baseCoins: request.baseCoins,
    bonusCoins: request.bonusCoins,
    paidAmountBaht: request.amountSatang / 100,
    paymentMethod: request.paymentMethod,
    status: request.status,
    rejectionReason: request.rejectionReason,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    balanceAfter,
  }
}

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new MemberTopUpError(400, `กรุณาระบุ${label}`)
  return text
}

async function validatedSlip(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || (value.type !== 'image/jpeg' && value.type !== 'image/png')) {
    throw new MemberTopUpError(400, 'รองรับเฉพาะสลิปไฟล์ JPG และ PNG')
  }
  if (!value.size || value.size > MAX_SLIP_SIZE) {
    throw new MemberTopUpError(413, 'ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB')
  }
  const body = new Uint8Array(await value.arrayBuffer())
  const jpeg = value.type === 'image/jpeg' && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const png = value.type === 'image/png' && pngSignature.every((byte, index) => body[index] === byte)
  if (!jpeg && !png) throw new MemberTopUpError(400, 'ชนิดไฟล์ไม่ตรงกับข้อมูลภายในไฟล์')
  return {
    body,
    contentType: value.type as 'image/jpeg' | 'image/png',
    extension: value.type === 'image/png' ? 'png' as const : 'jpg' as const,
    size: value.size,
    originalName: (value.name || 'slip').slice(0, 255),
  }
}

export async function createMemberTopUp(userId: string, form: FormData) {
  const packageId = requiredText(form.get('packageId'), 'แพ็กเกจ')
  const walletPackage = getWalletPackage(packageId)
  if (!walletPackage) throw new MemberTopUpError(400, 'แพ็กเกจเติมเหรียญไม่ถูกต้อง')

  const clientKey = requiredText(form.get('idempotencyKey'), 'รหัสรายการ')
  if (!IDEMPOTENCY_PATTERN.test(clientKey)) throw new MemberTopUpError(400, 'รหัสรายการไม่ถูกต้อง')
  const idempotencyKey = `member-topup:${userId}:${clientKey}`
  const prisma = getPrisma()
  const existing = await prisma.coinTopUpRequest.findUnique({ where: { idempotencyKey } })
  if (existing) return { request: memberTopUpDto(existing), idempotent: true }

  const slip = await validatedSlip(form.get('slip'))
  const requestId = randomUUID()
  const stored = await uploadTopUpProof({ ...slip, id: randomUUID(), requestId })
  try {
    const request = await prisma.coinTopUpRequest.create({
      data: {
        id: requestId,
        userId,
        packageId: walletPackage.id,
        baseCoins: walletPackage.coins,
        bonusCoins: walletPackage.bonus,
        totalCoins: walletPackage.coins + walletPackage.bonus,
        amountSatang: walletPackage.price * 100,
        idempotencyKey,
        paymentMethod: 'proof-upload',
        slipObjectKey: stored.key,
        slipUrl: stored.url,
        slipContentType: slip.contentType,
        slipSizeBytes: slip.size,
        slipOriginalName: slip.originalName,
      },
    })
    return { request: memberTopUpDto(request), idempotent: false }
  } catch (error) {
    await deleteTopUpProof(stored.key).catch(() => undefined)
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const duplicate = await prisma.coinTopUpRequest.findUnique({ where: { idempotencyKey } })
      if (duplicate) return { request: memberTopUpDto(duplicate), idempotent: true }
    }
    throw error
  }
}
