export const dynamic = 'force-dynamic'

import { FinanceOverview } from '@/components/finance/FinanceOverview'
import { getMonthlyIncome, getWithdrawalRequests } from '@/lib/db/finance'
import { requireAdmin } from '@/lib/auth'

export default async function FinancePage() {
  await requireAdmin('finance')
  const [income, withdrawals] = await Promise.all([getMonthlyIncome(), getWithdrawalRequests()])

  return <FinanceOverview
    income={income.map((row) => ({
      id: row.id,
      month: row.month,
      income: Number(row.income),
      transactions: row.transactions,
      creators: row.creators,
    }))}
    initialWithdrawals={withdrawals.map((row) => ({
      id: row.id,
      creator: row.creator,
      bank: row.bank,
      bankAccount: row.bankAccount,
      amount: Number(row.amount),
      requestedAt: row.requestedAt.toISOString(),
      status: row.status,
      slipUrl: row.slipUrl,
      reviewerName: row.reviewerName,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    }))}
  />
}
