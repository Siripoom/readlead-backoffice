import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

mock.module('@/lib/prisma', { exports: { getPrisma: () => ({ creatorWork: { findFirst: async (query: { where: { OR: Array<Record<string, unknown>> }; select: Record<string, unknown> }) => {
  if ('coverContentType' in query.select) return query.where.OR?.some((condition) => condition.status === 'approved') ? { coverObjectKey: 'hidden-cover', coverContentType: 'image/png' } : null
  return { id: 'work-a', status: 'approved', title: 'Preview', tagline: 'Hidden teaser', synopsis: 'Hidden synopsis', coverObjectKey: 'hidden-cover', coverIsPublic: false, reviews: [], comments: [], episodes: [], creator: { id: 'creator-a', name: 'Writer' } }
} } }) } })
mock.module('@/lib/storage/backblaze', { exports: { downloadCreatorMedia: async () => { throw new Error('approved cover must not be read') } } })

const { GET: getDetail } = await import('../app/api/public/catalog/works/[id]/route')
const { GET: getCover } = await import('../app/api/public/catalog/works/[id]/cover/route')

test('approved work hides cover and description until published', async () => {
  const context = { params: Promise.resolve({ id: 'work-a' }) }
  const detail = await getDetail(new Request('http://localhost/work-a'), context)
  assert.equal(detail.status, 200)
  const { work } = await detail.json()
  assert.equal(work.availability, 'coming_soon')
  assert.equal(work.hasCover, false)
  assert.equal(work.synopsis, '')
  assert.equal(work.tagline, '')
  const cover = await getCover(new Request('http://localhost/work-a/cover'), context)
  assert.equal(cover.status, 404)
})
