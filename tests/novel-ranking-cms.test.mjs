import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { NextRequest } from 'next/server'

let published = true
let siblingConfigs = []
let writes = 0
let lookup
const work = {
  id: 'novel-1', type: 'novel', title: 'Published novel', category: 'fantasy',
  origin: 'original', narrationType: null, tagline: '', synopsis: '', views: 10,
  coverObjectKey: null, coverIsPublic: false,
  creator: { name: 'Writer', writerApplication: null }, _count: { episodes: 1 },
}
const section = () => ({
  id: 'art-section', key: 'ranking-wide', title: 'Ranking artwork', enabled: true,
  config: {}, page: { slug: 'novel' },
  items: siblingConfigs.map((config, index) => ({ id: `item-${index}`, config })),
})

mock.module('@/lib/auth', { exports: { authorizeApi: async () => ({ ok: true, admin: { id: 'admin-1' } }) } })
mock.module('@/lib/cms-bootstrap', { exports: { ensureCmsPage: async () => {} } })
mock.module('@/lib/storage/backblaze', { exports: { cmsMediaUrl: (value) => value } })
mock.module('@/lib/prisma', {
  exports: {
    getPrisma: () => ({
      cmsSection: { findUnique: async () => section() },
      creatorWork: {
        findFirst: async (input) => { lookup = input; return published ? { id: work.id } : null },
        findMany: async () => published ? [work] : [],
      },
      cmsItem: {
        findUnique: async () => ({ id: 'art-1', sectionId: 'art-section', section: section() }),
        findMany: async () => siblingConfigs.map((config) => ({ config })),
        create: async (input) => { writes += 1; return { id: 'art-1', ...input } },
        update: async () => { writes += 1; return {} },
      },
      auditLog: { create: async () => ({}) },
      cmsPage: {
        findUnique: async () => ({
          slug: 'novel', label: 'Novel', slideSeconds: 5,
          sections: [{
            ...section(),
            items: [{ id: 'art-1', title: 'Artwork', subtitle: '', imageUrl: '/art.png', enabled: true, config: { variant: 'default', bookId: work.id } }],
          }],
        }),
      },
    }),
  },
})

const { POST, PATCH } = await import('../app/api/cms/route')
const { GET } = await import('../app/api/public/cms/[page]/route')

function request(method, config) {
  return new NextRequest('http://localhost/api/cms', {
    method, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sectionId: 'art-section', type: 'item', id: 'art-1', title: 'Artwork', imageUrl: '/art.png', config }),
  })
}

test('ranking artwork requires a published novel for both create and update', async () => {
  siblingConfigs = []
  writes = 0
  published = true
  assert.equal((await POST(request('POST', { variant: 'default' }))).status, 400)
  assert.equal((await PATCH(request('PATCH', { variant: 'default' }))).status, 400)
  published = false
  assert.equal((await POST(request('POST', { variant: 'default', bookId: work.id }))).status, 400)
  assert.equal((await PATCH(request('PATCH', { variant: 'default', bookId: work.id }))).status, 400)
  assert.equal(writes, 0)
  assert.deepEqual(lookup, {
    where: { id: work.id, status: 'published', episodes: { some: { status: 'published' } }, type: 'novel' },
    select: { id: true },
  })
})

test('ranking artwork prevents duplicate work links even across visual variants', async () => {
  published = true
  writes = 0
  siblingConfigs = [{ bookId: work.id, variant: 'banner' }]
  assert.equal((await POST(request('POST', { variant: 'default', bookId: work.id }))).status, 409)
  assert.equal((await PATCH(request('PATCH', { variant: 'default', bookId: work.id }))).status, 409)
  assert.equal(writes, 0)
})

test('ranking artwork saves the existing work-linked visual contract', async () => {
  published = true
  siblingConfigs = []
  writes = 0
  assert.equal((await POST(request('POST', { variant: 'default', bookId: work.id }))).status, 201)
  assert.equal((await PATCH(request('PATCH', { variant: 'default', bookId: work.id }))).status, 200)
  assert.equal(writes, 2)
})

test('public ranking artwork hides missing or unpublished works and keeps book identity', async () => {
  published = false
  const hidden = await GET(new Request('http://localhost/api/public/cms/novel'), { params: Promise.resolve({ page: 'novel' }) })
  assert.equal(hidden.status, 200)
  assert.deepEqual((await hidden.json()).sections[0].items, [])
  published = true
  const visible = await GET(new Request('http://localhost/api/public/cms/novel'), { params: Promise.resolve({ page: 'novel' }) })
  const items = (await visible.json()).sections[0].items
  assert.equal(items.length, 1)
  assert.equal(items[0].book.id, work.id)
  assert.equal(items[0].imageUrl, '/art.png')
})
