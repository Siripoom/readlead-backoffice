import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('exp'); if (!auth.ok) return auth.response
  const prisma=getPrisma(), shifted=new Date(Date.now()+7*60*60*1000), todayKey=shifted.toISOString().slice(0,10), today=new Date(`${todayKey}T00:00:00+07:00`), month=new Date(`${todayKey.slice(0,7)}-01T00:00:00+07:00`)
  const userId=request.nextUrl.searchParams.get('userId')||undefined,type=request.nextUrl.searchParams.get('type')||undefined
  const [ledgerRows,free,votes,monthly,tips]=await Promise.all([
    prisma.ticketLedger.findMany({where:{userId,type},include:{user:{select:{name:true,email:true}}},orderBy:{createdAt:'desc'},take:300}),
    prisma.ticketLedger.aggregate({where:{type:'free',amount:{gt:0},createdAt:{gte:today}},_sum:{amount:true}}),
    prisma.ticketLedger.aggregate({where:{type:{in:['vote_free','vote_month']},createdAt:{gte:today}},_sum:{amount:true}}),
    prisma.ticketLedger.aggregate({where:{type:'month',amount:{gt:0},createdAt:{gte:month}},_sum:{amount:true}}),
    prisma.ticketLedger.aggregate({where:{type:'tip',createdAt:{gte:month}},_sum:{amount:true}}),
  ])
  const referenceIds=[...new Set(ledgerRows.map((row)=>row.referenceId).filter((id):id is string=>!!id))]
  const works=referenceIds.length ? await prisma.creatorWork.findMany({where:{id:{in:referenceIds}},select:{id:true,title:true}}) : []
  const workTitles=new Map(works.map((work)=>[work.id,work.title]))
  const rows=ledgerRows.map((row)=>({...row,referenceTitle:row.referenceId ? workTitles.get(row.referenceId) : undefined}))
  return NextResponse.json({rows,stats:{freeToday:free._sum.amount??0,votesToday:Math.abs(votes._sum.amount??0),monthCreated:monthly._sum.amount??0,tipMonth:tips._sum.amount??0}})
}
