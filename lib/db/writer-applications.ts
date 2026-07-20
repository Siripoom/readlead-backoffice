import { getPrisma } from '@/lib/prisma'
import { decryptWriterApplicationPayload } from '@/lib/writer-application-crypto'
import type { WriterApplicationStatus } from '@/lib/generated/prisma/enums'

export type WriterApplicationFilter = WriterApplicationStatus | 'all'
export type WriterApplicationDecision = 'approved' | 'rejected'

export class WriterApplicationReviewError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'INVALID_TRANSITION' | 'INACTIVE_USER') {
    super(code)
    this.name = 'WriterApplicationReviewError'
  }
}

const summarySelect = {
  id: true,
  applicantType: true,
  penName: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  user: { select: { id: true, name: true, email: true, status: true, userType: true } },
} as const

export async function listWriterApplications(input: {
  status: WriterApplicationFilter
  query: string
  page: number
  pageSize: number
}) {
  const prisma = getPrisma()
  const where = {
    ...(input.status === 'all' ? {} : { status: input.status }),
    ...(input.query ? {
      OR: [
        { penName: { contains: input.query, mode: 'insensitive' as const } },
        { user: { name: { contains: input.query, mode: 'insensitive' as const } } },
        { user: { email: { contains: input.query, mode: 'insensitive' as const } } },
      ],
    } : {}),
  }

  const [all, pending, approved, rejected, total, items] = await prisma.$transaction([
    prisma.writerApplication.count(),
    prisma.writerApplication.count({ where: { status: 'pending' } }),
    prisma.writerApplication.count({ where: { status: 'approved' } }),
    prisma.writerApplication.count({ where: { status: 'rejected' } }),
    prisma.writerApplication.count({ where }),
    prisma.writerApplication.findMany({
      where,
      select: summarySelect,
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ])
  const counts = { all, pending, approved, rejected }

  return { items, total, page: input.page, pageSize: input.pageSize, counts }
}

export async function getWriterApplicationDetail(id: string) {
  const application = await getPrisma().writerApplication.findUnique({
    where: { id },
    select: {
      ...summarySelect,
      encryptedPayload: true,
      termsVersion: true,
      termsAcceptedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!application) return null

  return {
    id: application.id,
    applicantType: application.applicantType,
    penName: application.penName,
    status: application.status,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    rejectionReason: application.rejectionReason,
    termsVersion: application.termsVersion,
    termsAcceptedAt: application.termsAcceptedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    user: application.user,
    details: decryptWriterApplicationPayload(application.encryptedPayload),
  }
}

export async function getWriterApplicationDocument(id: string, kind: 'identity' | 'bank') {
  const application = await getPrisma().writerApplication.findUnique({
    where: { id },
    select: {
      identityObjectKey: true,
      identityContentType: true,
      bankObjectKey: true,
      bankContentType: true,
    },
  })
  if (!application) return null
  return kind === 'identity'
    ? { key: application.identityObjectKey, contentType: application.identityContentType }
    : { key: application.bankObjectKey, contentType: application.bankContentType }
}

export async function recordWriterApplicationAudit(input: {
  adminId: string
  applicationId: string
  action: string
  detail?: Record<string, string | boolean>
}) {
  await getPrisma().auditLog.create({
    data: {
      adminId: input.adminId,
      entity: 'WriterApplication',
      entityId: input.applicationId,
      action: input.action,
      detail: input.detail,
    },
  })
}

export async function decideWriterApplication(input: {
  id: string
  decision: WriterApplicationDecision
  reason?: string
  adminId: string
}) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const application = await tx.writerApplication.findUnique({
      where: { id: input.id },
      select: { ...summarySelect, userId: true },
    })
    if (!application) throw new WriterApplicationReviewError('NOT_FOUND')
    if (application.status === input.decision) return { application, idempotent: true }
    if (application.status !== 'pending') throw new WriterApplicationReviewError('INVALID_TRANSITION')
    if (input.decision === 'approved' && application.user.status !== 'active') {
      throw new WriterApplicationReviewError('INACTIVE_USER')
    }

    const now = new Date()
    const claimed = await tx.writerApplication.updateMany({
      where: { id: input.id, status: 'pending' },
      data: {
        status: input.decision,
        reviewedAt: now,
        rejectionReason: input.decision === 'rejected' ? input.reason : null,
      },
    })
    if (!claimed.count) {
      const current = await tx.writerApplication.findUnique({ where: { id: input.id }, select: summarySelect })
      if (current?.status === input.decision) return { application: current, idempotent: true }
      throw new WriterApplicationReviewError('INVALID_TRANSITION')
    }

    if (input.decision === 'approved') {
      await tx.user.update({ where: { id: application.userId }, data: { userType: 'creator' } })
      await tx.creatorProfile.upsert({
        where: { userId: application.userId },
        create: { userId: application.userId },
        update: {},
      })
    }

    await tx.auditLog.create({
      data: {
        adminId: input.adminId,
        entity: 'WriterApplication',
        entityId: input.id,
        action: `writer_application.${input.decision}`,
        detail: { decision: input.decision, previousStatus: 'pending' },
      },
    })
    const updated = await tx.writerApplication.findUniqueOrThrow({ where: { id: input.id }, select: summarySelect })
    return { application: updated, idempotent: false }
  })
}
