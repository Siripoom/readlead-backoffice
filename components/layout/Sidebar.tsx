'use client'
import {
  Accordion,
  Box,
  Flex,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  BadgeDollarSign,
  BookOpen,
  DollarSign,
  Flag,
  LayoutDashboard,
  ShieldAlert,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface NavChild {
  label: string
  href: string
}

interface NavItem {
  label: string
  href?: string
  icon: LucideIcon
  children?: NavChild[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Content', href: '/content', icon: BookOpen },
  {
    label: 'User',
    icon: Users,
    children: [
      { label: 'Users', href: '/users?tab=users' },
      { label: 'Creators', href: '/users?tab=creators' },
      { label: 'Admins', href: '/users?tab=admins' },
    ],
  },
  { label: 'Report', href: '/report', icon: Flag },
  { label: 'Finance', href: '/finance', icon: DollarSign },
  { label: 'บทลงโทษ', href: '/punishment', icon: ShieldAlert },
  {
    label: 'Monetization',
    icon: BadgeDollarSign,
    children: [
      { label: 'Promotions', href: '/monetization?tab=promotions' },
      { label: 'Pricing', href: '/monetization?tab=pricing' },
      { label: 'VIP Levels', href: '/monetization?tab=vip' },
      { label: 'EXP & Titles', href: '/monetization?tab=exp' },
      { label: 'Ads', href: '/monetization?tab=ads' },
    ],
  },
]

function SidebarContent() {
  const pathname = usePathname()

  return (
    <VStack align="stretch" gap={1} p={3}>
      {NAV_ITEMS.map((item) => {
        if (item.children) {
          const isActive = item.children.some((c) =>
            pathname.startsWith(c.href.split('?')[0])
          )
          return (
            <Accordion.Root
              key={item.label}
              collapsible
              defaultValue={isActive ? [item.label] : []}
            >
              <Accordion.Item value={item.label} border="none">
                <Accordion.ItemTrigger
                  px={3}
                  py={2}
                  borderRadius="md"
                  _hover={{ bg: 'gray.100' }}
                  bg={isActive ? 'teal.50' : 'transparent'}
                  cursor="pointer"
                >
                  <Flex align="center" gap={3} flex={1}>
                    <Box color={isActive ? 'teal.600' : 'gray.500'}>
                      <item.icon size={18} />
                    </Box>
                    <Text
                      fontSize="sm"
                      fontWeight={isActive ? 'semibold' : 'medium'}
                      color={isActive ? 'teal.700' : 'gray.700'}
                    >
                      {item.label}
                    </Text>
                  </Flex>
                  <Accordion.ItemIndicator />
                </Accordion.ItemTrigger>
                <Accordion.ItemContent>
                  <Accordion.ItemBody pb={1} pt={0}>
                    <VStack align="stretch" gap={0} pl={8}>
                      {item.children.map((child) => {
                        const childPath = child.href.split('?')[0]
                        const isChildActive = pathname === childPath || pathname.startsWith(childPath + '/')
                        return (
                          <Link key={child.href} href={child.href}>
                            <Box
                              px={3}
                              py={1.5}
                              borderRadius="md"
                              fontSize="sm"
                              color={isChildActive ? 'teal.700' : 'gray.600'}
                              fontWeight={isChildActive ? 'semibold' : 'normal'}
                              bg={isChildActive ? 'teal.50' : 'transparent'}
                              _hover={{ bg: 'gray.100' }}
                            >
                              {child.label}
                            </Box>
                          </Link>
                        )
                      })}
                    </VStack>
                  </Accordion.ItemBody>
                </Accordion.ItemContent>
              </Accordion.Item>
            </Accordion.Root>
          )
        }

        const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href!))
        return (
          <Link key={item.label} href={item.href!}>
            <Flex
              align="center"
              gap={3}
              px={3}
              py={2}
              borderRadius="md"
              bg={isActive ? 'teal.50' : 'transparent'}
              _hover={{ bg: 'gray.100' }}
            >
              <Box color={isActive ? 'teal.600' : 'gray.500'}>
                <item.icon size={18} />
              </Box>
              <Text
                fontSize="sm"
                fontWeight={isActive ? 'semibold' : 'medium'}
                color={isActive ? 'teal.700' : 'gray.700'}
              >
                {item.label}
              </Text>
            </Flex>
          </Link>
        )
      })}
    </VStack>
  )
}

export function Sidebar() {
  return (
    <Box
      as="nav"
      w="240px"
      minH="calc(100vh - 64px)"
      bg="gray.50"
      borderRightWidth="1px"
      borderColor="gray.200"
      overflowY="auto"
    >
      <SidebarContent />
    </Box>
  )
}
