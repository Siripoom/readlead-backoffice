'use client'

import { Drawer } from '@chakra-ui/react'
import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import styles from './AppShell.module.css'

interface AdminInfo { name: string; role: string; permissions: string[]; isOwner: boolean }

export function AppShell({ children, admin }: { children: React.ReactNode; admin: AdminInfo }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return <div className={styles.shell}>
    <Header admin={admin} onToggleSidebar={() => setSidebarOpen((value) => !value)} />
    <div className={styles.body}>
      <aside className={styles.desktopSidebar}><Sidebar permissions={admin.permissions} isOwner={admin.isOwner} /></aside>
      <Drawer.Root open={sidebarOpen} onOpenChange={(event) => setSidebarOpen(event.open)} placement="start">
        <Drawer.Backdrop /><Drawer.Positioner><Drawer.Content maxW="240px" className={styles.drawer}><Drawer.Body p={0}><Sidebar permissions={admin.permissions} isOwner={admin.isOwner} onNavigate={() => setSidebarOpen(false)} /></Drawer.Body><Drawer.CloseTrigger /></Drawer.Content></Drawer.Positioner>
      </Drawer.Root>
      <main className={styles.main}>{children}</main>
    </div>
  </div>
}
