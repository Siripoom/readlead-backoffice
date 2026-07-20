import { getPrisma } from '@/lib/prisma'

export const WALLET_PACKAGES = [
  { id: '50', coins: 50, bonus: 0, price: 50 },
  { id: '100', coins: 100, bonus: 5, price: 100 },
  { id: '300', coins: 300, bonus: 20, price: 300, popular: true },
  { id: '500', coins: 500, bonus: 50, price: 500 },
  { id: '1000', coins: 1_000, bonus: 150, price: 1_000 },
  { id: '2000', coins: 2_000, bonus: 400, price: 2_000 },
] as const

export const WALLET_PAYMENT_METHODS = ['promptpay', 'credit-card', 'truemoney', 'counter-service'] as const

export type WalletPaymentMethod = (typeof WALLET_PAYMENT_METHODS)[number]

export function getWalletPackage(packageId: string) {
  return WALLET_PACKAGES.find((item) => item.id === packageId)
}

export function isWalletPaymentMethod(value: string): value is WalletPaymentMethod {
  return WALLET_PAYMENT_METHODS.some((method) => method === value)
}

export function simulatedTopUpEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_SIMULATED_TOPUP === 'true'
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function integer(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

export async function getMemberWallet(userId: string) {
  const prisma = getPrisma()
  const [account, ledger] = await Promise.all([
    prisma.coinAccount.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.coinLedger.findMany({
      where: { userId, kind: 'topup' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, amount: true, balanceAfter: true, metadata: true, createdAt: true },
    }),
  ])

  const transactions = ledger.map((entry) => {
    const metadata = record(entry.metadata)
    const packageId = typeof metadata.packageId === 'string' ? metadata.packageId : null
    const walletPackage = packageId ? getWalletPackage(packageId) : undefined
    const method = typeof metadata.paymentMethod === 'string' && isWalletPaymentMethod(metadata.paymentMethod) ? metadata.paymentMethod : null
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      coins: entry.amount,
      baseCoins: integer(metadata.baseCoins) ?? walletPackage?.coins ?? entry.amount,
      bonusCoins: integer(metadata.bonusCoins) ?? walletPackage?.bonus ?? 0,
      paidAmountBaht: integer(metadata.paidAmountBaht) ?? walletPackage?.price ?? null,
      paymentMethod: method,
      status: 'success' as const,
      balanceAfter: entry.balanceAfter,
    }
  })

  return {
    balance: account?.balance ?? 0,
    topUpEnabled: simulatedTopUpEnabled(),
    packages: WALLET_PACKAGES,
    transactions,
  }
}
