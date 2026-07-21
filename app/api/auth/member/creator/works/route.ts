export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { createCreatorWork, listCreatorWorks, type CreatorWorkInput } from '@/lib/db/creator-studio'

function validate(body: Partial<CreatorWorkInput>) {
  if (!['novel', 'manga', 'audiobook'].includes(body.type ?? '') || !['original', 'translated'].includes(body.origin ?? '') || !body.title?.trim() || body.title.trim().length > 200 || !body.category?.trim()) return null
  if (body.origin === 'translated' && (!body.originalAuthor?.trim() || !body.translatorName?.trim() || !body.originalLanguage?.trim() || !body.originalTitle?.trim())) return null
  if (body.type === 'audiobook' && !['human', 'ai'].includes(body.narrationType ?? '')) return null
  if (body.type !== 'audiobook' && body.narrationType != null) return null
  return {
    type: body.type!, origin: body.origin!, title: body.title.trim(), category: body.category.trim(),
    rating: (body.rating ?? 'general').slice(0, 20), creationMethod: (body.creationMethod ?? 'self_written').slice(0, 50),
    tagline: (body.tagline ?? '').trim().slice(0, 200), synopsis: (body.synopsis ?? '').trim().slice(0, 100_000),
    tags: Array.isArray(body.tags) ? [...new Set(body.tags.map(String).map((tag) => tag.trim()).filter(Boolean))].slice(0, 10) : [],
    originalAuthor: body.originalAuthor?.trim(), translatorName: body.translatorName?.trim(), originalLanguage: body.originalLanguage?.trim(), originalTitle: body.originalTitle?.trim(),
    narrationType: body.type === 'audiobook' ? body.narrationType : null,
    seriesStatus: body.seriesStatus ?? 'ongoing',
  } satisfies CreatorWorkInput
}

export async function GET() {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  try { return privateJson({ items: await listCreatorWorks(auth.user.id) }) } catch (error) { return creatorApiError(error) }
}

export async function POST(request: Request) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const input = validate(await request.json().catch(() => ({})))
  if (!input) return privateJson({ error: 'กรุณากรอกข้อมูลผลงานให้ครบถ้วน' }, 400)
  try { return privateJson({ work: await createCreatorWork(auth.user.id, input) }, 201) } catch (error) { return creatorApiError(error, 'สร้างผลงานไม่สำเร็จ') }
}
