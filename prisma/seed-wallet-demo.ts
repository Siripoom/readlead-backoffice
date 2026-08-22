import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../lib/generated/prisma/client'
import { WALLET_PACKAGES } from '../lib/wallet-packages'

// Demo rows for reviewing how the wallet history table renders each payment
// channel and status, on a test account.
//
//   * they are NOT evidence that a channel works — Google Pay and Apple Pay
//     have never completed a real payment (see progress.md)
//   * approved rows also credit coins so the balance matches the history
//     (an approved top-up that didn't move the balance looks broken in a
//     demo). Ledger rows carry balanceAfter, which populates that column.
//   * every row is keyed `demo-wallet:` / `demo-wallet-credit:` so they are
//     easy to tell apart from real transactions and to remove with --remove
//
// Intended for local/test databases only.
//
// Usage:
//   npx tsx prisma/seed-wallet-demo.ts [email]
//   npx tsx prisma/seed-wallet-demo.ts [email] --remove

const DEMO_KEY_PREFIX = 'demo-wallet:'
const DEMO_CREDIT_PREFIX = 'demo-wallet-credit:'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const pkg = (id: string) => {
  const found = WALLET_PACKAGES.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown wallet package: ${id}`)
  return found
}

type DemoRow = {
  slug: string
  packageId: string
  paymentMethod: string
  status: 'approved' | 'pending' | 'rejected' | 'authorizing' | 'failed' | 'expired'
  daysAgo: number
  rejectionReason?: string
}

// One row per channel so each logo/label renders, plus the non-approved
// statuses so their badges are visible too.
const DEMO_ROWS: DemoRow[] = [
  { slug: 'credit-card-approved', packageId: '1000', paymentMethod: 'credit-card', status: 'approved', daysAgo: 1 },
  { slug: 'promptpay-approved', packageId: '300', paymentMethod: 'promptpay', status: 'approved', daysAgo: 2 },
  { slug: 'truemoney-approved', packageId: '100', paymentMethod: 'truemoney', status: 'approved', daysAgo: 3 },
  { slug: 'shopeepay-approved', packageId: '500', paymentMethod: 'shopeepay', status: 'approved', daysAgo: 4 },
  { slug: 'google-pay-approved', packageId: '300', paymentMethod: 'google-pay', status: 'approved', daysAgo: 5 },
  { slug: 'apple-pay-approved', packageId: '2000', paymentMethod: 'apple-pay', status: 'approved', daysAgo: 6 },
  { slug: 'proof-upload-approved', packageId: '50', paymentMethod: 'proof-upload', status: 'approved', daysAgo: 7 },
  { slug: 'proof-upload-pending', packageId: '100', paymentMethod: 'proof-upload', status: 'pending', daysAgo: 8 },
  {
    slug: 'proof-upload-rejected',
    packageId: '300',
    paymentMethod: 'proof-upload',
    status: 'rejected',
    daysAgo: 9,
    rejectionReason: 'สลิปไม่ชัดเจน กรุณาอัปโหลดใหม่อีกครั้ง',
  },
  { slug: 'promptpay-authorizing', packageId: '500', paymentMethod: 'promptpay', status: 'authorizing', daysAgo: 10 },
  { slug: 'truemoney-failed', packageId: '100', paymentMethod: 'truemoney', status: 'failed', daysAgo: 11 },
  { slug: 'promptpay-expired', packageId: '50', paymentMethod: 'promptpay', status: 'expired', daysAgo: 12 },
]

// Demo rows are backdated, so their ledger entries interleave with any real
// ones and the stored balanceAfter values no longer read as a running total
// (a newer row can show a smaller balance than an older one, which looks
// broken in a demo). Recompute them in chronological order.
async function reconcileBalanceAfter(userId: string) {
  const entries = await prisma.coinLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, amount: true, balanceAfter: true },
  })
  let running = 0
  for (const entry of entries) {
    running += entry.amount
    if (entry.balanceAfter !== running) {
      await prisma.coinLedger.update({ where: { id: entry.id }, data: { balanceAfter: running } })
    }
  }
  const account = await prisma.coinAccount.findUnique({ where: { userId }, select: { balance: true } })
  if (account && account.balance !== running) {
    console.warn(`Warning: ledger total (${running}) does not match account balance (${account.balance}); leaving the balance alone.`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const remove = args.includes('--remove')
  const email = args.find((arg) => !arg.startsWith('--')) ?? 'artorsiriratpoom@gmail.com'

  const user = await prisma.user.findFirst({ where: { email }, select: { id: true, email: true } })
  if (!user) throw new Error(`No user found with email ${email}`)

  if (remove) {
    // Reverse exactly what was credited rather than recomputing the balance,
    // so any real transactions on the account are left untouched.
    const demoLedger = await prisma.coinLedger.findMany({
      where: { userId: user.id, idempotencyKey: { startsWith: `${DEMO_CREDIT_PREFIX}${email}:` } },
      select: { id: true, amount: true },
    })
    const credited = demoLedger.reduce((sum, entry) => sum + entry.amount, 0)
    await prisma.$transaction(async (tx) => {
      await tx.coinLedger.deleteMany({ where: { id: { in: demoLedger.map((entry) => entry.id) } } })
      if (credited > 0) {
        await tx.coinAccount.update({ where: { userId: user.id }, data: { balance: { decrement: credited } } })
      }
      await tx.coinTopUpRequest.deleteMany({
        where: { userId: user.id, idempotencyKey: { startsWith: `${DEMO_KEY_PREFIX}${email}:` } },
      })
    })
    console.log(`Removed demo wallet rows for ${email} and reversed ${credited} demo coin(s)`)
    return
  }

  const now = Date.now()
  // Oldest first so each ledger row's balanceAfter reads as a sensible
  // running total in the history table.
  const ordered = [...DEMO_ROWS].sort((a, b) => b.daysAgo - a.daysAgo)
  let credited = 0

  for (const row of ordered) {
    const walletPackage = pkg(row.packageId)
    const submittedAt = new Date(now - row.daysAgo * 24 * 60 * 60 * 1000)
    const idempotencyKey = `${DEMO_KEY_PREFIX}${email}:${row.slug}`
    const totalCoins = walletPackage.coins + walletPackage.bonus
    const data = {
      userId: user.id,
      packageId: walletPackage.id,
      baseCoins: walletPackage.coins,
      bonusCoins: walletPackage.bonus,
      totalCoins,
      amountSatang: walletPackage.price * 100,
      paymentMethod: row.paymentMethod,
      status: row.status,
      rejectionReason: row.rejectionReason ?? null,
      reviewedAt: row.status === 'approved' || row.status === 'rejected' ? submittedAt : null,
      submittedAt,
    }
    const request = await prisma.coinTopUpRequest.upsert({
      where: { idempotencyKey },
      update: data,
      create: { ...data, idempotencyKey },
    })

    if (row.status !== 'approved') continue

    // Mirrors creditTopUp() in lib/db/coin-topups.ts — that function is the
    // single real credit path, but it is marked `server-only` and so cannot
    // be imported from a standalone script. Keep the ledger shape in sync.
    const creditKey = `${DEMO_CREDIT_PREFIX}${email}:${row.slug}`
    const already = await prisma.coinLedger.findUnique({ where: { idempotencyKey: creditKey }, select: { id: true } })
    if (already) continue

    await prisma.$transaction(async (tx) => {
      const account = await tx.coinAccount.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: totalCoins },
        update: { balance: { increment: totalCoins } },
      })
      await tx.coinLedger.create({
        data: {
          userId: user.id,
          kind: 'topup',
          amount: totalCoins,
          balanceAfter: account.balance,
          referenceId: request.id,
          idempotencyKey: creditKey,
          createdAt: submittedAt,
          metadata: {
            packageId: walletPackage.id,
            baseCoins: walletPackage.coins,
            bonusCoins: walletPackage.bonus,
            paidAmountBaht: walletPackage.price,
            paymentMethod: row.paymentMethod,
            demo: true,
          },
        },
      })
    })
    credited += totalCoins
  }

  await reconcileBalanceAfter(user.id)

  const account = await prisma.coinAccount.findUnique({ where: { userId: user.id }, select: { balance: true } })
  console.log(`Seeded ${DEMO_ROWS.length} demo wallet row(s) for ${email}`)
  console.log(`Credited ${credited} demo coin(s) — balance is now ${account?.balance ?? 0}`)
  console.log(`Remove them with: npx tsx prisma/seed-wallet-demo.ts ${email} --remove`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
