import { AppShell } from '@/components/layout/AppShell'
import { BackofficeToaster } from '@/components/layout/BackofficeToaster'
import { requireAdmin } from '@/lib/auth'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  return (
    <AppShell admin={{ name: admin.user.name, role: admin.role, permissions: admin.permissions, isOwner: admin.isOwner }}>
      {children}
      <BackofficeToaster />
    </AppShell>
  )
}
