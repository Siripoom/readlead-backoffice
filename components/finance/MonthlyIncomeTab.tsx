'use client'
import { Box, Table } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import type { MonthlyIncome } from '@/lib/mock-data/finance'

export function MonthlyIncomeTab() {
  const [data, setData] = useState<MonthlyIncome[]>([])

  useEffect(() => {
    fetch('/api/finance/income')
      .then(r => r.json())
      .then(rows => setData(rows.map((r: MonthlyIncome & { income: string }) => ({ ...r, income: Number(r.income) }))))
  }, [])

  return (
    <Box overflowX="auto">
      <Table.Root>
        <Table.Header>
          <Table.Row bg="gray.50">
            <Table.ColumnHeader>เดือน</Table.ColumnHeader>
            <Table.ColumnHeader>รายได้รวม</Table.ColumnHeader>
            <Table.ColumnHeader>จำนวน Transaction</Table.ColumnHeader>
            <Table.ColumnHeader>นักเขียนที่มีรายได้</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.map((row) => (
            <Table.Row key={row.id}>
              <Table.Cell fontWeight="medium">{row.month}</Table.Cell>
              <Table.Cell color="teal.600" fontWeight="semibold">
                ฿{row.income.toLocaleString()}
              </Table.Cell>
              <Table.Cell color="gray.600">{row.transactions.toLocaleString()}</Table.Cell>
              <Table.Cell color="gray.600">{row.creators}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
