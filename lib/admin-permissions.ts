export const ALL_PERMISSIONS = [
  'dashboard',
  'users',
  'admins',
  'reports',
  'finance',
  'punishment',
  'cms',
  'exp',
] as const

export type AdminPermission = (typeof ALL_PERMISSIONS)[number]

type PermissionActor = {
  isOwner: boolean
  permissions: readonly string[]
}

type PermissionGrantResult =
  | { ok: true; permissions: AdminPermission[] }
  | { ok: false; status: 400 | 403; error: string }

export function validatePermissionGrant(
  requested: unknown,
  actor: PermissionActor,
): PermissionGrantResult {
  if (!Array.isArray(requested) || requested.some((permission) => typeof permission !== 'string')) {
    return { ok: false, status: 400, error: 'รูปแบบสิทธิ์ไม่ถูกต้อง' }
  }

  const invalid = requested.filter(
    (permission): permission is string => !ALL_PERMISSIONS.includes(permission as AdminPermission),
  )
  if (invalid.length > 0) {
    return { ok: false, status: 400, error: `มีสิทธิ์ที่ระบบไม่รู้จัก: ${invalid.join(', ')}` }
  }

  const permissions = [...new Set(requested)] as AdminPermission[]
  if (!actor.isOwner && permissions.some((permission) => !actor.permissions.includes(permission))) {
    return { ok: false, status: 403, error: 'ไม่สามารถมอบสิทธิ์ที่คุณไม่มีได้' }
  }

  return { ok: true, permissions }
}
