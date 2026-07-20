import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { getPrisma } from '@/lib/prisma'
import type { UserType } from '@/lib/generated/prisma/enums'

export const MEMBER_SESSION_COOKIE = 'rl_user_session'
const MEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface AuthUser {
  id: string
  name: string
  email: string
  userType: Extract<UserType, 'user' | 'creator'>
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

function toAuthUser(user: { id: string; name: string; email: string; userType: UserType }): AuthUser | null {
  if (user.userType !== 'user' && user.userType !== 'creator') return null
  return { id: user.id, name: user.name, email: user.email, userType: user.userType }
}

export async function createMemberSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + MEMBER_SESSION_TTL_MS)

  await getPrisma().memberSession.create({
    data: { userId, tokenHash: tokenHash(token), expiresAt },
  })

  const jar = await cookies()
  jar.set(MEMBER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroyMemberSession() {
  const jar = await cookies()
  const token = jar.get(MEMBER_SESSION_COOKIE)?.value

  if (token) {
    await getPrisma().memberSession.deleteMany({
      where: { tokenHash: tokenHash(token) },
    })
  }

  jar.delete(MEMBER_SESSION_COOKIE)
}

export async function getMemberSessionUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(MEMBER_SESSION_COOKIE)?.value
  if (!token) return null

  const session = await getPrisma().memberSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  })

  if (!session || session.expiresAt <= new Date() || session.user.status !== 'active') return null
  return toAuthUser(session.user)
}

export function serializeAuthUser(user: { id: string; name: string; email: string; userType: UserType }) {
  return toAuthUser(user)
}
