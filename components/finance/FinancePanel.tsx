'use client'
import { Card, Tabs } from '@chakra-ui/react'
import { useSearchParams } from 'next/navigation'
import { MonthlyIncomeTab } from './MonthlyIncomeTab'
import { WithdrawalRequestsTab } from './WithdrawalRequestsTab'

export function FinancePanel() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'income'

  return (
    <Card.Root bg="white" shadow="sm">
      <Card.Body p={0}>
        <Tabs.Root value={tab} variant="line">
          <Tabs.List px={4} pt={2} borderBottomWidth="1px" borderColor="gray.200">
            <Tabs.Trigger value="income" asChild>
              <a href="/finance?tab=income">Monthly Income</a>
            </Tabs.Trigger>
            <Tabs.Trigger value="withdrawals" asChild>
              <a href="/finance?tab=withdrawals">Withdrawal Requests</a>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="income" p={0}>
            <MonthlyIncomeTab />
          </Tabs.Content>
          <Tabs.Content value="withdrawals" p={0}>
            <WithdrawalRequestsTab />
          </Tabs.Content>
        </Tabs.Root>
      </Card.Body>
    </Card.Root>
  )
}
