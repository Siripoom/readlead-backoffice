import { getPrisma } from '@/lib/prisma'
import { memberTopUpDto } from '@/lib/member-topups'
import { getWalletPackage, WALLET_PACKAGES } from '@/lib/wallet-packages'
import { WALLET_CHANNELS } from '@/lib/wallet-channels'

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function integer(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

export async function getMemberWallet(userId: string) {
  const prisma = getPrisma()
  const [account, requests, ledger] = await Promise.all([
    prisma.coinAccount.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.coinTopUpRequest.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    }),
    prisma.coinLedger.findMany({
      where: { userId, kind: 'topup' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, amount: true, balanceAfter: true, referenceId: true, metadata: true, createdAt: true },
    }),
  ])

  const balancesByRequest = new Map(ledger.flatMap((entry) => entry.referenceId ? [[entry.referenceId, entry.balanceAfter] as const] : []))
  const requestIds = new Set(requests.map((item) => item.id))
  const requestTransactions = requests.map((request) => memberTopUpDto(request, balancesByRequest.get(request.id) ?? null))
  const legacyTransactions = ledger.filter((entry) => !entry.referenceId || !requestIds.has(entry.referenceId)).map((entry) => {
    const metadata = record(entry.metadata)
    const packageId = typeof metadata.packageId === 'string' ? metadata.packageId : null
    const walletPackage = packageId ? getWalletPackage(packageId) : undefined
    return {
      id: entry.id,
      reference: null,
      createdAt: entry.createdAt,
      coins: entry.amount,
      baseCoins: integer(metadata.baseCoins) ?? walletPackage?.coins ?? entry.amount,
      bonusCoins: integer(metadata.bonusCoins) ?? walletPackage?.bonus ?? 0,
      paidAmountBaht: integer(metadata.paidAmountBaht) ?? walletPackage?.price ?? null,
      paymentMethod: typeof metadata.paymentMethod === 'string' ? metadata.paymentMethod : null,
      status: 'approved' as const,
      rejectionReason: null,
      reviewedAt: null,
      balanceAfter: entry.balanceAfter,
    }
  })
  const transactions = [...requestTransactions, ...legacyTransactions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100)

  return {
    balance: account?.balance ?? 0,
    topUpEnabled: WALLET_CHANNELS.some((channel) => channel.enabled),
    packages: WALLET_PACKAGES,
    channels: WALLET_CHANNELS,
    transactions,
  }
}
