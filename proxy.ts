import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/member/', '/api/public/', '/api/cron/']

function hasValidCookie(request: NextRequest) {
  const token = request.cookies.get('rl_admin_session')?.value ?? ''
  const [value, signature] = token.split('.')
  if (!value || !signature) return false
  const expected = createHmac('sha256', process.env.SESSION_SECRET || 'readlead-local-development-secret').update(value).digest('base64url')
  const a = Buffer.from(signature), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (PUBLIC_PATHS.some((item) => path.startsWith(item))) return NextResponse.next()
  if (!hasValidCookie(request)) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads).*)'],
}
