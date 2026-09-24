import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

const auditCalls: Array<{ data: Record<string, unknown> }> = []
const statusCalls: Array<{ where: { id: string }; data: { status: string } }> = []
const adminUpdateCalls: unknown[] = []

const admin = {
  id: 'admin-a',
  isOwner: false,
  permissions: ['users', 'admins'],
}

const target = {
  id: 'target-admin-user',
  status: 'active',
  adminProfile: { id: 'admin-b', isOwner: false },
}

const prisma = {
  user: {
    findUnique: async () => target,
    update: async (args: (typeof statusCalls)[number]) => { statusCalls.push(args) },
  },
  adminProfile: {
    update: async (args: unknown) => { adminUpdateCalls.push(args) },
  },
  auditLog: {
    create: async (args: (typeof auditCalls)[number]) => { auditCalls.push(args) },
  },
  $transaction: async <T>(callback: (transaction: typeof prisma) => Promise<T>) => callback(prisma),
}

mock.module('@/lib/auth', {
  exports: {
    authorizeApi: async () => ({ ok: true as const, admin }),
  },
})

mock.module('@/lib/db/users', {
  exports: {
    getUserById: async () => target,
    updateUserName: async () => undefined,
  },
})

mock.module('@/lib/prisma', {
  exports: { getPrisma: () => prisma },
})

const { PATCH } = await import('../app/api/users/[id]/route')
const legacyPunishmentRoute = await import('../app/api/users/[id]/punishments/route')

function patchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/users/target-admin-user', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const context = { params: Promise.resolve({ id: target.id }) }

test('status changes through users PATCH are audited atomically', async () => {
  auditCalls.length = 0
  statusCalls.length = 0
  const response = await PATCH(patchRequest({ status: 'banned' }), context)

  assert.equal(response.status, 200)
  assert.deepEqual(statusCalls, [{ where: { id: target.id }, data: { status: 'banned' } }])
  assert.deepEqual(auditCalls, [{
    data: {
      adminId: admin.id,
      action: 'user.status_changed',
      entity: 'User',
      entityId: target.id,
      detail: { previousStatus: 'active', status: 'banned' },
    },
  }])
})

test('non-owner cannot grant a permission they do not hold', async () => {
  adminUpdateCalls.length = 0
  const response = await PATCH(patchRequest({ permissions: ['finance'] }), context)
  assert.equal(response.status, 403)
  assert.equal(adminUpdateCalls.length, 0)
})

test('unknown permissions are rejected', async () => {
  adminUpdateCalls.length = 0
  const response = await PATCH(patchRequest({ permissions: ['not-a-real-permission'] }), context)
  assert.equal(response.status, 400)
  assert.equal(adminUpdateCalls.length, 0)
})

test('legacy user punishment route cannot create punishment records', () => {
  assert.equal('POST' in legacyPunishmentRoute, false)
})
