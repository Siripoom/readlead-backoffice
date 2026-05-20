'use client'
import { Avatar, Box, Button, Flex, IconButton, Text } from '@chakra-ui/react'
import { LogOut, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter()

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={4}
      h="64px"
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
      position="sticky"
      top={0}
      zIndex={100}
    >
      <Flex align="center" gap={3}>
        <IconButton
          aria-label="Toggle sidebar"
          variant="ghost"
          display={{ base: 'flex', md: 'none' }}
          onClick={onToggleSidebar}
        >
          <Menu size={20} />
        </IconButton>
        <Text fontWeight="bold" fontSize="xl" color="teal.600">
          ReadLead
        </Text>
      </Flex>

      <Flex align="center" gap={3}>
        <Avatar.Root size="sm" colorPalette="teal">
          <Avatar.Fallback name="Admin User" />
        </Avatar.Root>
        <Box display={{ base: 'none', sm: 'block' }}>
          <Text fontSize="sm" fontWeight="medium">Admin User</Text>
        </Box>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/login')}
        >
          <LogOut size={16} />
          <Box as="span" display={{ base: 'none', sm: 'inline' }} ml={1}>
            ออกจากระบบ
          </Box>
        </Button>
      </Flex>
    </Flex>
  )
}
