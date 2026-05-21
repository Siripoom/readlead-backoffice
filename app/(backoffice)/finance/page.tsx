export const dynamic = 'force-dynamic'

import { Box, Heading, Text } from '@chakra-ui/react'
import { Suspense } from 'react'
import { FinancePanel } from '@/components/finance/FinancePanel'
import { FinanceStats } from '@/components/finance/FinanceStats'
import { getMonthlyIncome, getWithdrawalRequests } from '@/lib/db/finance'
import type { FinanceStat } from '@/lib/mock-data/finance'

export default async function FinancePage() {
  const [incomeRows, withdrawals] = await Promise.all([
    getMonthlyIncome(),
    getWithdrawalRequests(),
  ])

  const latestIncome = incomeRows.at(-1)
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length
  const pendingTotal = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0)
  const approvedTotal = withdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + Number(w.amount), 0)

  const stats: FinanceStat[] = [
    {
      label: 'Total Income This Month',
      value: `฿${Number(latestIncome?.income ?? 0).toLocaleString()}`,
      sublabel: latestIncome?.month ?? '-',
      colorPalette: 'teal',
    },
    {
      label: 'Pending Withdrawal',
      value: `฿${pendingTotal.toLocaleString()}`,
      sublabel: `${pendingCount} รายการรอดำเนินการ`,
      colorPalette: 'orange',
    },
    {
      label: 'Completed',
      value: `฿${approvedTotal.toLocaleString()}`,
      sublabel: 'ยอดถอนสำเร็จเดือนนี้',
      colorPalette: 'green',
    },
  ]

  return (
    <Box>
      <Box mb={6}>
        <Heading size="lg" color="gray.800">Finance</Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>ภาพรวมรายได้และจัดการคำขอถอนเงิน</Text>
      </Box>

      <FinanceStats stats={stats} />

      <Box mt={6}>
        <Suspense>
          <FinancePanel />
        </Suspense>
      </Box>
    </Box>
  )
}
