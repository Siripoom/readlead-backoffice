import { requireAdmin } from '@/lib/auth'
import { DashboardAnalytics } from '@/components/dashboard/DashboardAnalytics'

export default async function DashboardPage() {
  await requireAdmin('dashboard')
  return <DashboardAnalytics />
}
