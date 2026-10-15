import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getMemberSessionUser } from '@/lib/member-auth'
import { getPrisma } from '@/lib/prisma'
import { encryptWriterApplicationPayload, WriterApplicationEncryptionConfigError } from '@/lib/writer-application-crypto'
import { validateWriterApplicationForm } from '@/lib/writer-application-validation'
import { deleteWriterDocument, uploadWriterDocument, WriterDocumentStorageConfigError } from '@/lib/storage/writer-documents'

const TERMS_VERSION = 'readify-2026-07-18'
const MAX_MULTIPART_SIZE = 11 * 1024 * 1024

class MultipartTooLargeError extends Error {}
class ApplicationSubmissionConflict extends Error {}

async function boundedFormData(request: Request) {
  if (!request.body) throw new Error('Multipart body is missing')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_MULTIPART_SIZE) {
      await reader.cancel()
      throw new MultipartTooLargeError()
    }
    chunks.push(value)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  return new Request(request.url, { method: 'POST', headers: request.headers, body }).formData()
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function serializeApplication(application: {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  penName: string
  submittedAt: Date
  rejectionReason: string | null
}) {
  return {
    id: application.id,
    status: application.status,
    penName: application.penName,
    submittedAt: application.submittedAt.toISOString(),
    rejectionReason: application.rejectionReason,
  }
}

export async function GET() {
  try {
    const user = await getMemberSessionUser()
    if (!user) return json({ error: 'กรุณาเข้าสู่ระบบก่อนตรวจสอบใบสมัคร' }, 401)

    const application = await getPrisma().writerApplication.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true, penName: true, submittedAt: true, rejectionReason: true },
    })
    return json({ application: application ? serializeApplication(application) : null })
  } catch (error) {
    console.error('Writer application status lookup failed', error)
    return json({ error: 'ตรวจสอบสถานะใบสมัครไม่สำเร็จ' }, 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getMemberSessionUser()
    if (!user) return json({ error: 'กรุณาเข้าสู่ระบบก่อนส่งใบสมัคร' }, 401)
    if (user.userType === 'creator') return json({ error: 'บัญชีนี้เป็นนักเขียนอยู่แล้ว' }, 409)

    const contentType = request.headers.get('content-type') ?? ''
    const contentLengthHeader = request.headers.get('content-length')
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return json({ error: 'รูปแบบข้อมูลต้องเป็น multipart/form-data' }, 415)
    }
    if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) return json({ error: 'ขนาดข้อมูลไม่ถูกต้อง' }, 400)
    if (contentLength !== null && contentLength > MAX_MULTIPART_SIZE) return json({ error: 'ขนาดข้อมูลรวมเกินกำหนด' }, 413)

    const prisma = getPrisma()
    const existing = await prisma.writerApplication.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true, penName: true, submittedAt: true, rejectionReason: true },
    })
    if (existing && existing.status !== 'rejected') {
      return json({ error: 'บัญชีนี้ส่งใบสมัครแล้ว', application: serializeApplication(existing) }, 409)
    }

    let form: FormData
    try {
      form = await boundedFormData(request)
    } catch (error) {
      if (error instanceof MultipartTooLargeError) return json({ error: 'ขนาดข้อมูลรวมเกินกำหนด' }, 413)
      return json({ error: 'ไม่สามารถอ่านข้อมูลแบบฟอร์มได้' }, 400)
    }

    const validation = await validateWriterApplicationForm(form)
    if (!validation.success) {
      return json({ error: 'กรุณาตรวจสอบข้อมูลในแบบฟอร์ม', fieldErrors: validation.fields }, 400)
    }

    const { applicantType, penName, payload, identityFile, bankFile } = validation.data
    const applicationId = existing?.id ?? randomUUID()
    const encryptedPayload = encryptWriterApplicationPayload(payload, applicationId)
    const attemptId = randomUUID()
    const uploads = await Promise.allSettled([
      uploadWriterDocument({ userId: user.id, applicationId, kind: 'identity', attemptId, ...identityFile }),
      uploadWriterDocument({ userId: user.id, applicationId, kind: 'bank', attemptId, ...bankFile }),
    ])
    const uploadedKeys = uploads.flatMap((result) => result.status === 'fulfilled' ? [result.value.key] : [])
    const cleanup = async () => {
      await Promise.allSettled(uploadedKeys.map((key) => deleteWriterDocument(key)))
    }
    const failedUpload = uploads.find((result) => result.status === 'rejected')
    if (failedUpload?.status === 'rejected') {
      await cleanup()
      throw failedUpload.reason
    }
    const [identityUpload, bankUpload] = uploads.map((result) => {
      if (result.status !== 'fulfilled') throw new Error('Writer document upload failed')
      return result.value
    })
    const now = new Date()

    let application: {
      id: string
      status: 'pending' | 'approved' | 'rejected'
      penName: string
      submittedAt: Date
      rejectionReason: string | null
    }
    try {
      if (existing) {
        await prisma.$transaction(async (tx) => {
          const archived = await tx.writerApplication.findUnique({ where: { id: existing.id } })
          if (!archived || archived.status !== 'rejected') throw new ApplicationSubmissionConflict()
          const expiresAt = new Date(now)
          expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1)
          await tx.writerApplicationRevision.create({ data: {
            applicationId: archived.id,
            userId: archived.userId,
            applicantType: archived.applicantType,
            penName: archived.penName,
            status: archived.status,
            encryptedPayload: archived.encryptedPayload,
            identityObjectKey: archived.identityObjectKey,
            identityContentType: archived.identityContentType,
            bankObjectKey: archived.bankObjectKey,
            bankContentType: archived.bankContentType,
            termsVersion: archived.termsVersion,
            termsAcceptedAt: archived.termsAcceptedAt,
            submittedAt: archived.submittedAt,
            reviewedAt: archived.reviewedAt,
            rejectionReason: archived.rejectionReason,
            archivedAt: now,
            expiresAt,
          } })
          const updated = await tx.writerApplication.updateMany({
            where: { id: archived.id, userId: user.id, status: 'rejected' },
            data: {
              applicantType,
              penName,
              status: 'pending',
              encryptedPayload,
              identityObjectKey: identityUpload.key,
              identityContentType: identityFile.contentType,
              bankObjectKey: bankUpload.key,
              bankContentType: bankFile.contentType,
              termsVersion: TERMS_VERSION,
              termsAcceptedAt: now,
              submittedAt: now,
              reviewedAt: null,
              rejectionReason: null,
            },
          })
          if (updated.count !== 1) throw new ApplicationSubmissionConflict()
        }, { isolationLevel: 'Serializable' })
        application = {
          id: existing.id,
          status: 'pending',
          penName,
          submittedAt: now,
          rejectionReason: null,
        }
      } else {
        application = await prisma.writerApplication.create({
          data: {
            id: applicationId,
            userId: user.id,
            applicantType,
            penName,
            encryptedPayload,
            identityObjectKey: identityUpload.key,
            identityContentType: identityFile.contentType,
            bankObjectKey: bankUpload.key,
            bankContentType: bankFile.contentType,
            termsVersion: TERMS_VERSION,
            termsAcceptedAt: now,
          },
          select: { id: true, status: true, penName: true, submittedAt: true, rejectionReason: true },
        })
      }
    } catch (error) {
      await cleanup()
      if (error instanceof ApplicationSubmissionConflict || (error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) return json({ error: 'สถานะใบสมัครเปลี่ยนไป กรุณาตรวจสอบอีกครั้ง' }, 409)
      throw error
    }

    return json({ ok: true, application: serializeApplication(application) }, 201)
  } catch (error) {
    if (error instanceof WriterApplicationEncryptionConfigError) {
      console.error('Writer application secure storage is not configured', error.message)
      return json({
        error: process.env.NODE_ENV === 'production'
          ? 'ระบบจัดเก็บเอกสารยังไม่พร้อมใช้งาน'
          : 'ระบบจัดเก็บเอกสารยังไม่พร้อมใช้งาน: กรุณาตั้งค่า WRITER_APPLICATION_ENCRYPTION_KEY',
      }, 503)
    }
    if (error instanceof WriterDocumentStorageConfigError) {
      console.error('Writer application document storage is not configured', error.message)
      return json({
        error: process.env.NODE_ENV === 'production'
          ? 'ระบบจัดเก็บเอกสารยังไม่พร้อมใช้งาน'
          : `ระบบจัดเก็บเอกสารยังไม่พร้อมใช้งาน: กรุณาตั้งค่า ${error.missing.join(', ')}`,
      }, 503)
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return json({ error: 'บัญชีนี้ส่งใบสมัครแล้ว' }, 409)
    }
    console.error('Writer application submission failed', error)
    return json({ error: 'ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่' }, 500)
  }
}
