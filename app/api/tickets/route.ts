import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('exp'); if (!auth.ok) return auth.response
  const prisma=getPrisma(), now=new Date(), today=new Date(now);today.setHours(0,0,0,0);const month=new Date(now.getFullYear(),now.getMonth(),1)
  const userId=request.nextUrl.searchParams.get('userId')||undefined,type=request.nextUrl.searchParams.get('type')||undefined
  const [rows,free,votes,monthly,tips]=await Promise.all([
    prisma.ticketLedger.findMany({where:{userId,type},include:{user:true},orderBy:{createdAt:'desc'},take:300}),
    prisma.ticketLedger.aggregate({where:{type:'free',amount:{gt:0},createdAt:{gte:today}},_sum:{amount:true}}),
    prisma.ticketLedger.aggregate({where:{type:{in:['vote_free','vote_month']},createdAt:{gte:today}},_sum:{amount:true}}),
    prisma.ticketLedger.aggregate({where:{type:'month',amount:{gt:0},createdAt:{gte:month}},_sum:{amount:true}}),
    prisma.ticketLedger.aggregate({where:{type:'tip',createdAt:{gte:month}},_sum:{amount:true}}),
  ])
  return NextResponse.json({rows,stats:{freeToday:free._sum.amount??0,votesToday:Math.abs(votes._sum.amount??0),monthCreated:monthly._sum.amount??0,tipMonth:tips._sum.amount??0}})
}
