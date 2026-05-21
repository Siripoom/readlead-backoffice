import { NextRequest, NextResponse } from 'next/server'
import { getReportById, updateReportStatus } from '@/lib/db/reports'
import type { ReportStatus } from '@/lib/generated/prisma/enums'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const report = await getReportById(id)
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(report)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as { status: ReportStatus }
  const report = await updateReportStatus(id, body.status)
  return NextResponse.json(report)
}
