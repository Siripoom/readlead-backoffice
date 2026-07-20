import 'server-only'

import { resolveThaiAddress } from '@/lib/thai-addresses'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PREFIXES = new Set(['นาย', 'นาง', 'นางสาว', 'ห้างหุ้นส่วนสามัญ'])
const BANKS: Record<string, string> = {
  kbank: 'ธนาคารกสิกรไทย',
  scb: 'ธนาคารไทยพาณิชย์',
  bbl: 'ธนาคารกรุงเทพ',
  ktb: 'ธนาคารกรุงไทย',
  bay: 'ธนาคารกรุงศรีอยุธยา',
  ttb: 'ธนาคารทหารไทยธนชาต (ttb)',
  gsb: 'ธนาคารออมสิน',
  baac: 'ธนาคารเพื่อการเกษตรฯ (ธ.ก.ส.)',
  cimb: 'ธนาคารซีไอเอ็มบีไทย',
}

type FieldErrors = Record<string, string>

interface ValidatedFile {
  body: Uint8Array
  contentType: 'image/jpeg' | 'image/png'
}

export interface ValidatedWriterApplication {
  applicantType: 'person' | 'company'
  penName: string
  payload: Record<string, string>
  identityFile: ValidatedFile
  bankFile: ValidatedFile
}

function text(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function digits(value: string) {
  return value.replace(/\D/g, '')
}

function hasThaiIdChecksum(value: string) {
  if (!/^\d{13}$/.test(value)) return false
  const sum = value.slice(0, 12).split('').reduce((total, digit, index) => total + Number(digit) * (13 - index), 0)
  return (11 - (sum % 11)) % 10 === Number(value[12])
}

function required(fields: FieldErrors, name: string, value: string, label: string, maxLength: number) {
  if (!value) fields[name] = `กรุณากรอก${label}`
  else if (value.length > maxLength) fields[name] = `${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`
}

async function validateImage(form: FormData, name: string, label: string, fields: FieldErrors): Promise<ValidatedFile | null> {
  const value = form.get(name)
  if (!(value instanceof File) || value.size === 0) {
    fields[name] = `กรุณาแนบ${label}`
    return null
  }
  if (value.size > MAX_FILE_SIZE) {
    fields[name] = `${label}ต้องมีขนาดไม่เกิน 5 MB`
    return null
  }

  const body = new Uint8Array(await value.arrayBuffer())
  const isJpeg = body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
  const isPng = body.length >= 8
    && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47
    && body[4] === 0x0d && body[5] === 0x0a && body[6] === 0x1a && body[7] === 0x0a

  if (!isJpeg && !isPng) {
    fields[name] = `${label}ต้องเป็นไฟล์ JPG หรือ PNG เท่านั้น`
    return null
  }
  return { body, contentType: isJpeg ? 'image/jpeg' : 'image/png' }
}

export async function validateWriterApplicationForm(form: FormData): Promise<
  | { success: true; data: ValidatedWriterApplication }
  | { success: false; fields: FieldErrors }
> {
  const fields: FieldErrors = {}
  const applicantType = text(form, 'applicantType')
  const companyName = text(form, 'companyName')
  const taxId = digits(text(form, 'taxId'))
  const penName = text(form, 'penName')
  const nationalId = digits(text(form, 'nationalId'))
  const prefix = text(form, 'prefix')
  const firstName = text(form, 'firstName')
  const lastName = text(form, 'lastName')
  const phone = digits(text(form, 'phone'))
  const email = text(form, 'email').toLowerCase()
  const address = text(form, 'address')
  const provinceCode = text(form, 'provinceCode')
  const districtCode = text(form, 'districtCode')
  const subdistrictCode = text(form, 'subdistrictCode')
  const postalCode = digits(text(form, 'postalCode'))
  const accountName = text(form, 'accountName')
  const bankCode = text(form, 'bankCode')
  const accountNumber = digits(text(form, 'accountNumber'))

  if (applicantType !== 'person' && applicantType !== 'company') fields.applicantType = 'กรุณาเลือกประเภทผู้สมัคร'
  if (applicantType === 'company') {
    required(fields, 'companyName', companyName, 'ชื่อนิติบุคคล', 200)
    if (!hasThaiIdChecksum(taxId)) fields.taxId = 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง'
  }
  required(fields, 'penName', penName, 'นามปากกา', 60)
  if (!hasThaiIdChecksum(nationalId)) fields.nationalId = 'เลขบัตรประชาชนไม่ถูกต้อง'
  if (!PREFIXES.has(prefix)) fields.prefix = 'กรุณาเลือกคำนำหน้า'
  required(fields, 'firstName', firstName, 'ชื่อจริง', 100)
  required(fields, 'lastName', lastName, 'นามสกุล', 100)
  if (!/^0\d{8,9}$/.test(phone)) fields.phone = 'เบอร์โทรศัพท์ไม่ถูกต้อง'
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) fields.email = 'รูปแบบอีเมลไม่ถูกต้อง'
  required(fields, 'address', address, 'ที่อยู่', 500)
  required(fields, 'accountName', accountName, 'ชื่อบัญชี', 200)
  if (!BANKS[bankCode]) fields.bankCode = 'กรุณาเลือกธนาคาร'
  if (!/^\d{10,12}$/.test(accountNumber)) fields.accountNumber = 'เลขที่บัญชีต้องมี 10–12 หลัก'
  if (text(form, 'termsAccepted') !== 'true') fields.termsAccepted = 'กรุณายอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว'

  const resolvedAddress = resolveThaiAddress(provinceCode, districtCode, subdistrictCode)
  if (!resolvedAddress) {
    fields.provinceCode = 'กรุณาเลือกจังหวัด อำเภอ และตำบลให้ถูกต้อง'
  } else if (postalCode !== resolvedAddress.postalCode) {
    fields.postalCode = 'รหัสไปรษณีย์ไม่ตรงกับพื้นที่ที่เลือก'
  }

  const [identityFile, bankFile] = await Promise.all([
    validateImage(form, 'identityFile', 'รูปบัตรประชาชน', fields),
    validateImage(form, 'bankFile', 'รูปหน้าสมุดบัญชี', fields),
  ])

  if (Object.keys(fields).length || !identityFile || !bankFile || !resolvedAddress || (applicantType !== 'person' && applicantType !== 'company')) {
    return { success: false, fields }
  }

  return {
    success: true,
    data: {
      applicantType,
      penName,
      identityFile,
      bankFile,
      payload: {
        companyName: applicantType === 'company' ? companyName : '',
        taxId: applicantType === 'company' ? taxId : '',
        nationalId,
        prefix,
        firstName,
        lastName,
        phone,
        email,
        address,
        ...resolvedAddress,
        accountName,
        bankCode,
        bankName: BANKS[bankCode],
        accountNumber,
      },
    },
  }
}
