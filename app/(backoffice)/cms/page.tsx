import { requireAdmin } from '@/lib/auth'
import { CmsManager } from '@/components/cms/CmsManager'

export default async function CmsPage() {
  await requireAdmin('cms')
  return <CmsManager />
}
