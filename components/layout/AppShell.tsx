'use client'
import { Box, Drawer, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <Flex direction="column" minH="100vh">
      <Header onToggleSidebar={() => setIsSidebarOpen((v) => !v)} />

      <Flex flex={1}>
        {/* Desktop sidebar */}
        <Box display={{ base: 'none', md: 'block' }} flexShrink={0}>
          <Sidebar />
        </Box>

        {/* Mobile sidebar as Drawer */}
        <Drawer.Root
          open={isSidebarOpen}
          onOpenChange={(e) => setIsSidebarOpen(e.open)}
          placement="start"
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content maxW="240px">
              <Drawer.Body p={0}>
                <Sidebar />
              </Drawer.Body>
              <Drawer.CloseTrigger />
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>

        {/* Main content */}
        <Box as="main" flex={1} p={6} bg="gray.50" minH="0">
          {children}
        </Box>
      </Flex>
    </Flex>
  )
}
