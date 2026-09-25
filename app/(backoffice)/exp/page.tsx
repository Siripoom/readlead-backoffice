import { requireAdmin } from '@/lib/auth'
import { ExpManager } from '@/components/exp/ExpManager'

export default async function ExpPage() {
  await requireAdmin('exp')
  return <ExpManager />
}
