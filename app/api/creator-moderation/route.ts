export const dynamic = 'force-dynamic'
import { authorizeApi } from '@/lib/auth'
import { listCreatorModeration } from '@/lib/db/creator-moderation'

export async function GET(request: Request) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const params = new URL(request.url).searchParams
  const status = params.get('status')
  const type = params.get('type')
  const data = await listCreatorModeration({ status: ['pending', 'approved', 'rejected'].includes(status ?? '') ? status as 'pending' | 'approved' | 'rejected' : undefined, type: ['publication', 'translation', 'deletion'].includes(type ?? '') ? type as 'publication' | 'translation' | 'deletion' : undefined, query: params.get('query')?.trim() })
  return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}
