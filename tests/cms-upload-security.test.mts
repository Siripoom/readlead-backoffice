import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

const uploads: unknown[] = []

mock.module('@/lib/auth', {
  exports: {
    authorizeApi: async () => ({ ok: true as const, admin: { id: 'cms-admin' } }),
  },
})
mock.module('@/lib/storage/backblaze', {
  exports: {
    BackblazeConfigError: class BackblazeConfigError extends Error {},
    uploadCmsImage: async (input: unknown) => {
      uploads.push(input)
      return { url: 'https://storage.example/cms/image.png' }
    },
  },
})

const { POST } = await import('../app/api/cms/upload/route')
const { detectCmsImageFormat } = await import('../lib/cms-image-validation')

test('CMS upload rejects HTML bytes spoofed as image/png', async () => {
  uploads.length = 0
  const form = new FormData()
  form.set('file', new File(['<script>alert(document.domain)</script>'], 'attack.png', { type: 'image/png' }))

  const response = await POST(new Request('http://localhost/api/cms/upload', { method: 'POST', body: form }))

  assert.equal(response.status, 400)
  assert.equal(uploads.length, 0)
})

test('CMS image detection recognizes every allowed format by signature', () => {
  const samples = [
    { body: [0xff, 0xd8, 0xff], contentType: 'image/jpeg', extension: 'jpg' },
    { body: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], contentType: 'image/png', extension: 'png' },
    { body: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], contentType: 'image/webp', extension: 'webp' },
    { body: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], contentType: 'image/gif', extension: 'gif' },
  ]

  for (const sample of samples) {
    assert.deepEqual(detectCmsImageFormat(Uint8Array.from(sample.body)), {
      contentType: sample.contentType,
      extension: sample.extension,
    })
  }
})
