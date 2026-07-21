import { Suspense } from 'react'
import { UsersPanel } from '@/components/users/UsersPanel'
import { requireAdmin } from '@/lib/auth'

export default async function UsersPage() {
  await requireAdmin('users')
  return (
    <Suspense>
      <UsersPanel />
    </Suspense>
  )
}
