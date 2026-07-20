import 'server-only'

import { randomUUID } from 'node:crypto'
import { getPrisma } from '@/lib/prisma'
import { deleteReportAttachment, uploadReportAttachment } from '@/lib/storage/backblaze'

export const SUPPORT_REPORT_TYPES = ['account_security', 'payment', 'content', 'feedback', 'other'] as const
export type SupportReportType = (typeof SUPPORT_REPORT_TYPES)[number]
export type MemberReportStatus = 'pending' | 'reply' | 'resolved'

const MAX_FILES = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_MESSAGE_LENGTH = 1000

type UploadedAttachment = {
  id: string
  objectKey: string
  url: string
  contentType: string
  sizeBytes: number
  originalName: string
}

export class MemberReportError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'MemberReportError'
  }
}

function referenceCode(id: string) {
  return `#RP-${id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()}`
}

function memberStatus(status: string, latestSender?: string | null): MemberReportStatus {
  if (status === 'resolved') return 'resolved'
  return status === 'in_progress' && latestSender === 'admin' ? 'reply' : 'pending'
}

function attachmentDto(attachment: { id: string; url: string; contentType: string; sizeBytes: number; originalName: string }) {
  return {
    id: attachment.id,
    url: attachment.url,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    name: attachment.originalName,
  }
}

function reportSummary(report: {
  id: string
  subject: string
  type: string
  status: string
  date: Date
  messages: { senderType: string }[]
}) {
  const latestSender = report.messages[0]?.senderType
  return {
    id: report.id,
    reference: referenceCode(report.id),
    subject: report.subject,
    type: report.type,
    createdAt: report.date.toISOString(),
    status: memberStatus(report.status, latestSender),
  }
}

function reportDetail(report: {
  id: string
  senderName: string
  subject: string
  type: string
  status: string
  message: string
  date: Date
  attachments: { id: string; messageId: string | null; url: string; contentType: string; sizeBytes: number; originalName: string }[]
  messages: {
    id: string
    senderType: string
    senderName: string
    message: string
    createdAt: Date
    attachments: { id: string; url: string; contentType: string; sizeBytes: number; originalName: string }[]
  }[]
}) {
  const latestSender = report.messages.at(-1)?.senderType
  return {
    id: report.id,
    reference: referenceCode(report.id),
    subject: report.subject,
    type: report.type,
    createdAt: report.date.toISOString(),
    status: memberStatus(report.status, latestSender),
    canReply: report.status === 'in_progress' && latestSender === 'admin',
    messages: [
      {
        id: `${report.id}:initial`,
        senderType: 'member' as const,
        senderName: report.senderName,
        message: report.message,
        createdAt: report.date.toISOString(),
        attachments: report.attachments.filter((item) => !item.messageId).map(attachmentDto),
      },
      ...report.messages.map((message) => ({
        id: message.id,
        senderType: message.senderType === 'admin' ? 'admin' as const : 'member' as const,
        senderName: message.senderName,
        message: message.message,
        createdAt: message.createdAt.toISOString(),
        attachments: message.attachments.map(attachmentDto),
      })),
    ],
  }
}

function supportType(value: FormDataEntryValue | null): SupportReportType {
  if (typeof value !== 'string' || !SUPPORT_REPORT_TYPES.includes(value as SupportReportType)) {
    throw new MemberReportError(400, 'ประเภทปัญหาไม่ถูกต้อง')
  }
  return value as SupportReportType
}

function textField(value: FormDataEntryValue | null, label: string, min: number, max: number) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length < min || text.length > max) throw new MemberReportError(400, `${label}ต้องมีความยาว ${min}–${max} ตัวอักษร`)
  return text
}

async function validatedFiles(entries: FormDataEntryValue[]) {
  if (entries.length > MAX_FILES) throw new MemberReportError(400, `แนบรูปได้สูงสุด ${MAX_FILES} รูป`)
  return Promise.all(entries.map(async (entry) => {
    if (!(entry instanceof File) || (entry.type !== 'image/jpeg' && entry.type !== 'image/png')) {
      throw new MemberReportError(400, 'รองรับเฉพาะไฟล์ JPG และ PNG')
    }
    if (!entry.size || entry.size > MAX_FILE_SIZE) throw new MemberReportError(413, 'รูปแต่ละไฟล์ต้องมีขนาดไม่เกิน 5MB')
    const body = new Uint8Array(await entry.arrayBuffer())
    const jpeg = entry.type === 'image/jpeg' && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const png = entry.type === 'image/png' && pngSignature.every((value, index) => body[index] === value)
    if (!jpeg && !png) throw new MemberReportError(400, 'ชนิดไฟล์ไม่ตรงกับข้อมูลภายในไฟล์')
    return {
      body,
      contentType: entry.type as 'image/jpeg' | 'image/png',
      extension: entry.type === 'image/jpeg' ? 'jpg' as const : 'png' as const,
      size: entry.size,
      originalName: (entry.name || 'image').slice(0, 255),
    }
  }))
}

async function uploadFiles(reportId: string, files: Awaited<ReturnType<typeof validatedFiles>>) {
  const uploaded: UploadedAttachment[] = []
  try {
    for (const file of files) {
      const id = randomUUID()
      const object = await uploadReportAttachment({ ...file, id, reportId })
      uploaded.push({
        id,
        objectKey: object.key,
        url: object.url,
        contentType: file.contentType,
        sizeBytes: file.size,
        originalName: file.originalName,
      })
    }
    return uploaded
  } catch (error) {
    await cleanupUploads(uploaded)
    throw error
  }
}

async function cleanupUploads(files: UploadedAttachment[]) {
  await Promise.allSettled(files.map((file) => deleteReportAttachment(file.objectKey)))
}

export async function listMemberReports(userId: string) {
  const reports = await getPrisma().report.findMany({
    where: { senderId: userId, isSupport: true },
    orderBy: { date: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { senderType: true } } },
  })
  return reports.map(reportSummary)
}

export async function getMemberReport(userId: string, reportId: string) {
  const report = await getPrisma().report.findFirst({
    where: { id: reportId, senderId: userId, isSupport: true },
    include: {
      attachments: { orderBy: { createdAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' }, include: { attachments: { orderBy: { createdAt: 'asc' } } } },
    },
  })
  if (!report) throw new MemberReportError(404, 'ไม่พบรายการแจ้งปัญหา')
  return reportDetail(report)
}

export async function createMemberReport(user: { id: string; name: string }, form: FormData) {
  const subject = textField(form.get('subject'), 'หัวข้อปัญหา', 5, 120)
  const type = supportType(form.get('type'))
  const message = textField(form.get('message'), 'รายละเอียด', 10, MAX_MESSAGE_LENGTH)
  const files = await validatedFiles(form.getAll('attachments'))
  const prisma = getPrisma()
  const report = await prisma.report.create({ data: { senderId: user.id, senderName: user.name, subject, type, message, isSupport: true } })
  let uploaded: UploadedAttachment[] = []
  try {
    uploaded = await uploadFiles(report.id, files)
    if (uploaded.length) await prisma.reportAttachment.createMany({ data: uploaded.map((file) => ({ ...file, reportId: report.id })) })
    return getMemberReport(user.id, report.id)
  } catch (error) {
    await Promise.allSettled([prisma.report.delete({ where: { id: report.id } }), cleanupUploads(uploaded)])
    throw error
  }
}

export async function replyToMemberReport(user: { id: string; name: string }, reportId: string, form: FormData) {
  const messageValue = form.get('message')
  const message = typeof messageValue === 'string' ? messageValue.trim() : ''
  if (message.length > MAX_MESSAGE_LENGTH) throw new MemberReportError(400, `ข้อความต้องไม่เกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`)
  const files = await validatedFiles(form.getAll('attachments'))
  if (!message && !files.length) throw new MemberReportError(400, 'กรุณาพิมพ์ข้อความหรือแนบรูปภาพ')

  const prisma = getPrisma()
  const report = await prisma.report.findFirst({
    where: { id: reportId, senderId: user.id, isSupport: true },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { senderType: true } } },
  })
  if (!report) throw new MemberReportError(404, 'ไม่พบรายการแจ้งปัญหา')
  if (report.status === 'resolved') throw new MemberReportError(409, 'รายการนี้ได้รับการแก้ไขแล้ว')
  if (report.status !== 'in_progress' || report.messages[0]?.senderType !== 'admin') {
    throw new MemberReportError(409, 'กรุณารอเจ้าหน้าที่ตอบกลับก่อนส่งข้อความเพิ่ม')
  }

  const uploaded = await uploadFiles(reportId, files)
  const messageId = randomUUID()
  try {
    await prisma.$transaction(async (tx) => {
      const gate = await tx.report.updateMany({
        where: { id: reportId, senderId: user.id, status: 'in_progress' },
        data: { status: 'open' },
      })
      if (!gate.count) throw new MemberReportError(409, 'สถานะรายการเปลี่ยนแปลงแล้ว กรุณาลองใหม่')
      await tx.reportMessage.create({ data: { id: messageId, reportId, senderType: 'member', senderName: user.name, message } })
      if (uploaded.length) {
        await tx.reportAttachment.createMany({ data: uploaded.map((file) => ({ ...file, reportId, messageId })) })
      }
    })
  } catch (error) {
    await cleanupUploads(uploaded)
    throw error
  }
  return getMemberReport(user.id, reportId)
}
