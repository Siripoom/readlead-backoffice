import 'server-only'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPrisma } from '@/lib/prisma'

export const SESSION_COOKIE = 'rl_admin_session'
export const ALL_PERMISSIONS = ['dashboard', 'users', 'admins', 'reports', 'finance', 'punishment', 'cms', 'exp']

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const signToken = (value: string) => createHmac('sha256', process.env.SESSION_SECRET || 'readlead-local-development-secret').update(value).digest('base64url')

export async function createSession(adminId: string) {
  const prisma = getPrisma()
  const value = randomBytes(32).toString('base64url')
  const token = `${value}.${signToken(value)}`
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  await prisma.adminSession.create({ data: { adminId, tokenHash: tokenHash(token), expiresAt } })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const prisma = getPrisma()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } })
  jar.delete(SESSION_COOKIE)
}

export async function getSessionAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const prisma = getPrisma()
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { admin: { include: { user: true } } },
  })
  if (!session || session.expiresAt <= new Date() || session.admin.user.status !== 'active') return null
  return session.admin
}

export async function requireAdmin(permission?: string) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/login')
  if (permission && !admin.isOwner && !admin.permissions.includes(permission)) redirect('/dashboard?denied=1')
  return admin
}

export async function authorizeApi(permission?: string) {
  const admin = await getSessionAdmin()
  if (!admin) return { ok: false as const, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (permission && !admin.isOwner && !admin.permissions.includes(permission)) {
    return { ok: false as const, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true as const, admin }
}
