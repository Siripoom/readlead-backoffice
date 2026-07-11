import { requireAdmin } from '@/lib/auth'
import { TicketManager } from '@/components/tickets/TicketManager'

export default async function TicketsPage() {
  await requireAdmin('exp')
  return <TicketManager />
}
