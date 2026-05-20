import { AppShell } from '@/components/layout/AppShell'
import { BackofficeToaster } from '@/components/layout/BackofficeToaster'

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <BackofficeToaster />
    </AppShell>
  )
}
