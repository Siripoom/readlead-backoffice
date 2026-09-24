import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePermissionGrant } from '../lib/admin-permissions'
import { activePunishmentWhere, hasActivePunishment } from '../lib/member-punishment'

test('non-owner cannot grant permissions they do not hold', () => {
  assert.deepEqual(
    validatePermissionGrant(['finance'], { isOwner: false, permissions: ['users', 'admins'] }),
    { ok: false, status: 403, error: 'ไม่สามารถมอบสิทธิ์ที่คุณไม่มีได้' },
  )
})

test('unknown permissions are rejected for every admin', () => {
  assert.deepEqual(
    validatePermissionGrant(['not-a-real-permission'], { isOwner: true, permissions: [] }),
    { ok: false, status: 400, error: 'มีสิทธิ์ที่ระบบไม่รู้จัก: not-a-real-permission' },
  )
})

test('member auth only selects active punishments that have not expired', () => {
  const now = new Date('2026-09-24T00:00:00.000Z')
  assert.deepEqual(activePunishmentWhere(now), {
    status: 'active',
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  })
  assert.equal(hasActivePunishment({ punishments: [{ id: 'active-punishment' }] }), true)
  assert.equal(hasActivePunishment({ punishments: [] }), false)
})

test('production fails closed at module initialization when SESSION_SECRET is missing', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousSecret = process.env.SESSION_SECRET
  Object.assign(process.env, { NODE_ENV: 'production' })
  delete process.env.SESSION_SECRET

  try {
    await assert.rejects(import('../lib/session-secret?missing-production-secret'), /SESSION_SECRET/)
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else Object.assign(process.env, { NODE_ENV: previousNodeEnv })
    if (previousSecret === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = previousSecret
  }
})
