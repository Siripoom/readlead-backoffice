import { NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function incomePeriod(monthLabel: string, fallback: Date) {
  const month = thaiMonths.findIndex((name) => monthLabel.includes(name))
  const yearMatch = monthLabel.match(/\d{4}/)
  if (month < 0 || !yearMatch) return fallback
  const writtenYear = Number(yearMatch[0])
  const year = writtenYear > 2400 ? writtenYear - 543 : writtenYear
  return new Date(Date.UTC(year, month, 1))
}

export async function GET() {
  const auth = await authorizeApi('dashboard')
  if (!auth.ok) return auth.response

  const prisma = getPrisma()
  const [users, content, income, active] = await Promise.all([
    prisma.user.findMany({ select: { joinedAt: true, userType: true } }),
    prisma.content.findMany({ select: { submittedAt: true, category: true } }),
    prisma.monthlyIncome.findMany({ orderBy: { recordedAt: 'asc' } }),
    prisma.user.count({ where: { status: 'active', userType: { not: 'admin' } } }),
  ])

  const userBreakdown = users.reduce<Record<string, number>>((result, user) => {
    result[user.userType] = (result[user.userType] ?? 0) + 1
    return result
  }, {})
  const workBreakdown = content.reduce<Record<string, number>>((result, work) => {
    result[work.category] = (result[work.category] ?? 0) + 1
    return result
  }, {})
  const currentYear = new Date().getFullYear()
  const years = new Set<number>([currentYear, currentYear - 1])
  users.forEach((user) => years.add(user.joinedAt.getFullYear()))
  content.forEach((work) => years.add(work.submittedAt.getFullYear()))
  income.forEach((row) => years.add(incomePeriod(row.month, row.recordedAt).getUTCFullYear()))

  return NextResponse.json({
    totals: {
      users: (userBreakdown.user ?? 0) + (userBreakdown.creator ?? 0),
      works: content.length,
      revenue: income.reduce((total, row) => total + Number(row.income), 0),
      online: active,
    },
    breakdown: { users: userBreakdown, works: workBreakdown },
    series: {
      users: users.filter((user) => user.userType !== 'admin').map((user) => user.joinedAt),
      works: content.map((work) => work.submittedAt),
      revenue: income.map((row) => ({ date: incomePeriod(row.month, row.recordedAt), value: Number(row.income) })),
    },
    income: income.map((row) => ({ ...row, income: Number(row.income) })),
    years: [...years].sort((a, b) => b - a),
  })
}
