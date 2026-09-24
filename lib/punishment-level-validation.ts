type ValidationSuccess<T> = { ok: true; data: T }
type ValidationFailure = { ok: false; error: string }
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

export type CreatePunishmentLevelInput = {
  level: number
  name: string
  threshold: number
  duration: number
}

export type UpdatePunishmentLevelInput = {
  id: string
  data: {
    name?: string
    threshold?: number
    duration?: number
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntegerAtLeast(value: unknown, minimum: number) {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= minimum
}

function normalizedName(value: unknown) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name.length > 0 && name.length <= 100 ? name : null
}

export function validateCreatePunishmentLevel(input: unknown): ValidationResult<CreatePunishmentLevelInput> {
  if (!isObject(input)) return { ok: false, error: 'ข้อมูลระดับโทษไม่ถูกต้อง' }
  const name = normalizedName(input.name)
  if (
    !isIntegerAtLeast(input.level, 1)
    || !name
    || !isIntegerAtLeast(input.threshold, 1)
    || !isIntegerAtLeast(input.duration, 0)
  ) {
    return { ok: false, error: 'level และ threshold ต้องเป็นจำนวนเต็มตั้งแต่ 1, duration ต้องเป็นจำนวนเต็มตั้งแต่ 0 และ name ต้องไม่ว่าง' }
  }
  return {
    ok: true,
    data: {
      level: input.level as number,
      name,
      threshold: input.threshold as number,
      duration: input.duration as number,
    },
  }
}

export function validateUpdatePunishmentLevel(input: unknown): ValidationResult<UpdatePunishmentLevelInput> {
  if (!isObject(input) || typeof input.id !== 'string' || !input.id.trim()) {
    return { ok: false, error: 'กรุณาระบุ id ของระดับโทษ' }
  }

  const data: UpdatePunishmentLevelInput['data'] = {}
  if (input.name !== undefined) {
    const name = normalizedName(input.name)
    if (!name) return { ok: false, error: 'name ต้องเป็นข้อความที่ไม่ว่างและยาวไม่เกิน 100 ตัวอักษร' }
    data.name = name
  }
  if (input.threshold !== undefined) {
    if (!isIntegerAtLeast(input.threshold, 1)) return { ok: false, error: 'threshold ต้องเป็นจำนวนเต็มตั้งแต่ 1' }
    data.threshold = input.threshold as number
  }
  if (input.duration !== undefined) {
    if (!isIntegerAtLeast(input.duration, 0)) return { ok: false, error: 'duration ต้องเป็นจำนวนเต็มตั้งแต่ 0' }
    data.duration = input.duration as number
  }
  if (Object.keys(data).length === 0) return { ok: false, error: 'ไม่มีข้อมูลระดับโทษที่ต้องการแก้ไข' }

  return { ok: true, data: { id: input.id.trim(), data } }
}
