import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  const prisma = getPrisma()
  const auth = await authorizeApi('exp'); if (!auth.ok) return auth.response
  const accounts = await prisma.expAccount.findMany({ include: { user: true }, orderBy: { balance: 'desc' } })
  const pending = await prisma.expLedger.findMany({ where: { status: 'pending' }, include: { user: true }, orderBy: { createdAt: 'desc' } })
  const ledger = await prisma.expLedger.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 1000 })
  const today = new Date(); today.setHours(0,0,0,0)
  const aggregate = await prisma.expLedger.aggregate({ where: { status: 'granted', createdAt: { gte: today }, amount: { gt: 0 } }, _sum: { amount: true } })
  const levelupsToday = await prisma.expLedger.count({ where: { action: '_levelup', createdAt: { gte: today } } })
  const sums=new Map<string,number>();for(const e of ledger)if(e.status==='granted')sums.set(e.userId,(sums.get(e.userId)??0)+e.amount)
  const alerts=accounts.filter(a=>(sums.get(a.userId)??0)!==a.balance).map(a=>({type:'mismatch',userId:a.userId,userName:a.user.name,detail:`ยอดบัญชี ${a.balance.toLocaleString()} EXP แต่สมุดรวมได้ ${(sums.get(a.userId)??0).toLocaleString()} EXP`}))
  return NextResponse.json({ accounts, pending, ledger, alerts, grantedToday: aggregate._sum.amount ?? 0, levelupsToday })
}

export async function POST(request: NextRequest) {
  const prisma = getPrisma()
  const auth = await authorizeApi('exp'); if (!auth.ok) return auth.response
  const body = await request.json() as { userId?: string; amount?: number; action?: string; source?: string; reason?: string; pending?: boolean }
  if (!body.userId || !Number.isInteger(body.amount) || body.amount === 0 || !body.action || !body.source) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const status = body.pending ? 'pending' : 'granted'
  const entry = await prisma.$transaction(async tx => {
    const row = await tx.expLedger.create({ data: { userId: body.userId!, amount: body.amount!, action: body.action!, source: body.source!, reason: body.reason, status } })
    if (status === 'granted') await tx.expAccount.update({ where: { userId: body.userId! }, data: { balance: { increment: body.amount! } } })
    await tx.auditLog.create({ data: { adminId: auth.admin.id, action: 'exp.create', entity: 'ExpLedger', entityId: row.id, detail: { amount: body.amount, status } } })
    return row
  })
  return NextResponse.json(entry, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const prisma = getPrisma()
  const auth = await authorizeApi('exp'); if (!auth.ok) return auth.response
  const body = await request.json() as { id?: string; decision?: 'approve'|'reject'|'revoke' }
  if (!body.id || !body.decision) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const result = await prisma.$transaction(async tx => {
    const entry = await tx.expLedger.findUnique({ where: { id: body.id } })
    if (!entry) throw new Error('NOT_FOUND')
    if (body.decision === 'approve' && entry.status === 'pending') {
      await tx.expAccount.update({ where: { userId: entry.userId }, data: { balance: { increment: entry.amount } } })
      return tx.expLedger.update({ where: { id: entry.id }, data: { status: 'granted', reviewedAt: new Date(), reviewerName: auth.admin.userId } })
    }
    if (body.decision === 'reject' && entry.status === 'pending') return tx.expLedger.update({ where: { id: entry.id }, data: { status: 'rejected', reviewedAt: new Date(), reviewerName: auth.admin.userId } })
    if (body.decision === 'revoke' && entry.status === 'granted') {
      await tx.expAccount.update({ where: { userId: entry.userId }, data: { balance: { decrement: entry.amount } } })
      return tx.expLedger.update({ where: { id: entry.id }, data: { status: 'revoked', reviewedAt: new Date(), reviewerName: auth.admin.userId } })
    }
    throw new Error('CONFLICT')
  }).catch(error => error instanceof Error && error.message === 'NOT_FOUND' ? null : Promise.reject(error))
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: `exp.${body.decision}`, entity: 'ExpLedger', entityId: body.id } })
  return NextResponse.json(result)
}
