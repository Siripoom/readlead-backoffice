import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { NextRequest } from 'next/server'

const skips: number[] = []
mock.module('@/lib/prisma', { exports: { getPrisma: () => ({
  $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  creatorWork: {
    count: async () => 0,
    findMany: async (query: { skip: number }) => { skips.push(query.skip); return [] },
  },
}) } })

const { GET } = await import('../app/api/public/catalog/works/route')

test('catalog page bounds invalid and enormous page values before querying', async () => {
  for (const [input, expectedPage] of [['Infinity', 1], ['-5', 1], ['1.5', 1], ['999999999999999999', 1], ['5000', 1000]] as const) {
    const response = await GET(new NextRequest(`http://localhost/api/public/catalog/works?page=${input}`))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).page, expectedPage)
    assert.equal(skips.at(-1), (expectedPage - 1) * 20)
  }
})
