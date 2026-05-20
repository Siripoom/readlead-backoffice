'use client'
import {
  Box,
  Button,
  Card,
  Field,
  Flex,
  Heading,
  Input,
  Text,
} from '@chakra-ui/react'
import { BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push('/dashboard')
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Card.Root w="full" maxW="400px" mx={4} shadow="md">
        <Card.Header pb={2}>
          <Flex align="center" justify="center" direction="column" gap={2}>
            <Flex align="center" gap={2} color="teal.600">
              <BookOpen size={32} />
              <Heading size="xl" color="teal.600">ReadLead</Heading>
            </Flex>
            <Text color="gray.500" fontSize="sm">Backoffice Administration</Text>
          </Flex>
        </Card.Header>

        <Card.Body>
          <Box as="form" onSubmit={handleSubmit}>
            <Flex direction="column" gap={4}>
              <Field.Root>
                <Field.Label>อีเมล</Field.Label>
                <Input
                  type="email"
                  placeholder="admin@readlead.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>รหัสผ่าน</Field.Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field.Root>

              <Button
                type="submit"
                colorPalette="teal"
                width="full"
                mt={2}
              >
                เข้าสู่ระบบ
              </Button>
            </Flex>
          </Box>
        </Card.Body>
      </Card.Root>
    </Flex>
  )
}
