export interface FinanceStat {
  label: string
  value: string
  sublabel: string
  colorPalette: string
}


export interface MonthlyIncome {
  id: string
  month: string
  income: number
  transactions: number
  creators: number
}


export type WithdrawalStatus = 'pending' | 'approved' | 'rejected'

export interface WithdrawalRequest {
  id: string
  creator: string
  bank: string
  bankAccount: string
  amount: number
  requestedAt: string
  status: WithdrawalStatus
}

