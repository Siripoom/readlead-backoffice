interface RegistrationInput {
  name: string
  email: string
  password: string
}

type FieldErrors = Record<string, string[]>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegistrationInput(body: unknown):
  | { success: true; data: RegistrationInput }
  | { success: false; fields: FieldErrors } {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const fields: FieldErrors = {}

  if (!name) fields.name = ['กรุณากรอกชื่อผู้ใช้']
  else if (name.length > 100) fields.name = ['ชื่อผู้ใช้ต้องไม่เกิน 100 ตัวอักษร']

  if (!email) fields.email = ['กรุณากรอกอีเมล']
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) fields.email = ['รูปแบบอีเมลไม่ถูกต้อง']

  if (!password) fields.password = ['กรุณากรอกรหัสผ่าน']
  else if (password.length < 8) fields.password = ['รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร']
  else if (password.length > 128) fields.password = ['รหัสผ่านต้องไม่เกิน 128 ตัวอักษร']

  if (Object.keys(fields).length > 0) return { success: false, fields }
  return { success: true, data: { name, email, password } }
}

export function validateLoginInput(body: unknown):
  | { success: true; data: Pick<RegistrationInput, 'email' | 'password'> }
  | { success: false; fields: FieldErrors } {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const fields: FieldErrors = {}

  if (!email) fields.email = ['กรุณากรอกอีเมล']
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) fields.email = ['รูปแบบอีเมลไม่ถูกต้อง']
  if (!password) fields.password = ['กรุณากรอกรหัสผ่าน']

  if (Object.keys(fields).length > 0) return { success: false, fields }
  return { success: true, data: { email, password } }
}
