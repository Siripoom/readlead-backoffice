import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { NextRequest } from 'next/server'

mock.module('@/lib/auth', { exports: { authorizeApi: async () => ({ ok: true, admin: { id: 'admin-a' } }) } })
mock.module('@/lib/db/punishment', { exports: { getPunishmentRecords: async () => [] } })
mock.module('@/lib/prisma', { exports: {
  getPrisma: () => ({
    punishmentRecord: { update: async () => { throw Object.assign(new Error('missing'), { code: 'P2025' }) } },
    auditLog: { create: async () => { throw new Error('unexpected audit') } },
  }),
} })

const { PATCH } = await import('../app/api/punishment/records/route')

test('PATCH returns 404 when punishment record no longer exists', async () => {
  const request = new NextRequest('http://localhost/api/punishment/records', {
    method: 'PATCH',
    body: JSON.stringify({ id: 'missing-record', status: 'cancelled' }),
  })
  const response = await PATCH(request)
  assert.equal(response.status, 404)
})

test('PATCH rejects malformed JSON and unsupported status', async () => {
  for (const body of ['{', JSON.stringify({ id: 'record-a', status: 'recorded' }), 'null']) {
    const response = await PATCH(new NextRequest('http://localhost/api/punishment/records', { method: 'PATCH', body }))
    assert.equal(response.status, 400)
  }
})
