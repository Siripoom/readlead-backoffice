'use client'

import { Badge, Box, Button, Card, Dialog, Flex, Image as ChakraImage, Input, NativeSelect, Spinner, Table, Text, Textarea } from '@chakra-ui/react'
import { Check, Eye, Search, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'

type Status = 'pending' | 'approved' | 'rejected'
type Kind = 'publication' | 'translation' | 'deletion'
interface Item { id: string; type: Kind; status: Status; reason: string | null; submittedAt: string; reviewedAt: string | null; work: { id: string; title: string; type: string; origin: string; status: string; category: string; creator: { id: string; name: string; email: string }; _count: { episodes: number } } }
interface Detail extends Item { work: Item['work'] & { rating: string; creationMethod: string; narrationType: 'human' | 'ai' | null; tagline: string; synopsis: string; tags: string[]; originalTitle: string | null; originalAuthor: string | null; originalLanguage: string | null; translatorName: string | null; hasCover: boolean; episodes: Array<{ id: string; episodeNumber: number; title: string; type: string; status: string; priceCoins: number; content: string | null; durationSeconds: number | null; assets: Array<{ id: string; kind: string; contentType: string; sizeBytes: number; sortOrder: number }> }> } }

const statuses: Record<Status, { label: string; color: string }> = { pending: { label: 'รอตรวจ', color: 'orange' }, approved: { label: 'อนุมัติ', color: 'green' }, rejected: { label: 'ปฏิเสธ', color: 'red' } }
const kinds: Record<Kind, { label: string; color: string }> = {
  publication: { label: 'ตรวจเรื่องใหม่', color: 'blue' },
  translation: { label: 'ตรวจผลงานแปล', color: 'purple' },
  deletion: { label: 'ขอลบผลงาน', color: 'red' },
}
function thaiDate(value: string) { return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export function CreatorModerationPanel() {
  const [items, setItems] = useState<Item[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [status, setStatus] = useState('pending')
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [decisionBusy, setDecisionBusy] = useState(false)
  const [narrationBusy, setNarrationBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ ...(status !== 'all' ? { status } : {}), ...(type !== 'all' ? { type } : {}), ...(query ? { query } : {}) })
    fetch(`/api/creator-moderation?${params}`, { cache: 'no-store', signal: controller.signal }).then((response) => response.json()).then((data: { items?: Item[]; counts?: Record<string, number> }) => { setItems(data.items ?? []); setCounts(data.counts ?? {}); setLoading(false) }).catch(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, status, type])

  async function open(item: Item) {
    setDetailLoading(true)
    const response = await fetch(`/api/creator-moderation/${item.id}`, { cache: 'no-store' })
    if (!response.ok) toaster.error({ title: 'เปิดรายละเอียดไม่สำเร็จ' })
    else setDetail(await response.json() as Detail)
    setDetailLoading(false)
  }

  async function decide(decision: 'approved' | 'rejected') {
    if (!detail) return
    setDecisionBusy(true)
    const response = await fetch(`/api/creator-moderation/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, reason }) })
    const body = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) toaster.error({ title: 'ดำเนินการไม่สำเร็จ', description: body.error })
    else { toaster.success({ title: decision === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย' }); setItems((current) => current.filter((item) => item.id !== detail.id)); setDetail(null); setRejecting(false); setReason(''); setCounts((current) => ({ ...current, pending: Math.max(0, (current.pending ?? 1) - 1), [decision]: (current[decision] ?? 0) + 1 })) }
    setDecisionBusy(false)
  }

  async function changeNarrationType(narrationType: 'human' | 'ai') {
    if (!detail || detail.work.type !== 'audiobook' || detail.work.narrationType === narrationType) return
    setNarrationBusy(true)
    const response = await fetch(`/api/creator-moderation/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ narrationType }) })
    const body = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) toaster.error({ title: 'แก้ไขชนิดเสียงไม่สำเร็จ', description: body.error })
    else {
      setDetail((current) => current ? { ...current, work: { ...current.work, narrationType } } : current)
      toaster.success({ title: 'แก้ไขชนิดเสียงเรียบร้อย' })
    }
    setNarrationBusy(false)
  }

  function search(event: FormEvent) { event.preventDefault(); setQuery(draftQuery.trim()) }

  return <><Flex gap={3} mb={4} wrap="wrap">{(['pending', 'approved', 'rejected', 'all'] as const).map((value) => <Button key={value} variant={status === value ? 'solid' : 'outline'} colorPalette={value === 'rejected' ? 'red' : value === 'approved' ? 'green' : 'purple'} onClick={() => setStatus(value)}>{value === 'all' ? 'ทั้งหมด' : statuses[value].label} {value !== 'all' && `(${counts[value] ?? 0})`}</Button>)}</Flex>
    <Card.Root bg="white" shadow="sm"><Card.Body><Flex gap={3} mb={5} wrap="wrap"><form onSubmit={search}><Flex><Input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="ค้นหาชื่อเรื่อง / นักเขียน" minW="280px" /><Button type="submit" variant="outline"><Search size={16} /></Button></Flex></form><NativeSelect.Root maxW="220px"><NativeSelect.Field value={type} onChange={(event) => setType(event.target.value)}><option value="all">ทุกประเภทคำขอ</option><option value="publication">เรื่องใหม่</option><option value="translation">ผลงานแปลเดิม</option><option value="deletion">คำขอลบ</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root></Flex>
      {loading ? <Flex py={16} justify="center"><Spinner /></Flex> : <Box overflowX="auto"><Table.Root><Table.Header><Table.Row bg="gray.50"><Table.ColumnHeader>ผลงาน</Table.ColumnHeader><Table.ColumnHeader>นักเขียน</Table.ColumnHeader><Table.ColumnHeader>ประเภทคำขอ</Table.ColumnHeader><Table.ColumnHeader>ตอน</Table.ColumnHeader><Table.ColumnHeader>วันที่ส่ง</Table.ColumnHeader><Table.ColumnHeader>สถานะ</Table.ColumnHeader><Table.ColumnHeader>ตรวจสอบ</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{items.map((item) => <Table.Row key={item.id}><Table.Cell><Text fontWeight="semibold">{item.work.title}</Text><Text fontSize="xs" color="gray.500">{item.work.category} · {item.work.type}</Text></Table.Cell><Table.Cell><Text>{item.work.creator.name}</Text><Text fontSize="xs" color="gray.500">{item.work.creator.email}</Text></Table.Cell><Table.Cell><Badge colorPalette={kinds[item.type].color}>{kinds[item.type].label}</Badge></Table.Cell><Table.Cell>{item.work._count.episodes}</Table.Cell><Table.Cell>{thaiDate(item.submittedAt)}</Table.Cell><Table.Cell><Badge colorPalette={statuses[item.status].color}>{statuses[item.status].label}</Badge></Table.Cell><Table.Cell><Button size="sm" variant="ghost" onClick={() => void open(item)}><Eye size={16} />เปิด</Button></Table.Cell></Table.Row>)}{items.length === 0 && <Table.Row><Table.Cell colSpan={7}><Text py={12} textAlign="center" color="gray.500">ไม่มีรายการในตัวกรองนี้</Text></Table.Cell></Table.Row>}</Table.Body></Table.Root></Box>}
    </Card.Body></Card.Root>

    <Dialog.Root open={Boolean(detail) || detailLoading} size="xl" onOpenChange={(event) => { if (!event.open) { setDetail(null); setRejecting(false); setReason('') } }}><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content maxH="90vh" overflowY="auto"><Dialog.Header><Dialog.Title>{detailLoading ? 'กำลังโหลด…' : detail?.work.title}</Dialog.Title><Dialog.CloseTrigger /></Dialog.Header><Dialog.Body>{detailLoading ? <Flex py={20} justify="center"><Spinner /></Flex> : detail && <Flex direction="column" gap={5}>
      <Flex gap={5} align="start">{detail.work.hasCover && <ChakraImage src={`/api/creator-moderation/${detail.id}/media/cover`} alt="ภาพปก" w="130px" aspectRatio="3/4" objectFit="cover" borderRadius="lg" />}<Box><Flex gap={2} wrap="wrap"><Badge colorPalette={kinds[detail.type].color}>{kinds[detail.type].label}</Badge>{detail.work.type === 'audiobook' && <Badge colorPalette={detail.work.narrationType === 'ai' ? 'purple' : 'blue'}>{detail.work.narrationType === 'ai' ? 'เสียง AI' : 'เสียงพากย์'}</Badge>}</Flex>{detail.work.type === 'audiobook' && <NativeSelect.Root mt={3} maxW="220px" disabled={narrationBusy}><NativeSelect.Field aria-label="ชนิดเสียงหนังสือเสียง" value={detail.work.narrationType ?? 'human'} onChange={(event) => void changeNarrationType(event.target.value as 'human' | 'ai')}><option value="human">เสียงพากย์</option><option value="ai">เสียง AI</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root>}{!detail.work.hasCover && <Text mt={2} fontSize="xs" color="orange.600">ผลงานนี้ยังไม่มีภาพปก</Text>}<Text mt={3} fontWeight="bold">{detail.work.creator.name}</Text><Text fontSize="sm" color="gray.500">{detail.work.creator.email}</Text><Text mt={3} fontSize="sm">{detail.work.tagline}</Text></Box></Flex>
      {detail.type === 'deletion' && <Box bg="red.50" borderRadius="lg" p={4}><Text fontSize="xs" color="red.600">เหตุผลที่ขอลบ</Text><Text>{detail.reason}</Text></Box>}
      {detail.work.origin === 'translated' && <Box bg="purple.50" borderRadius="lg" p={4}><Text fontWeight="semibold" mb={2}>ข้อมูลต้นฉบับ</Text><Text fontSize="sm">ชื่อ: {detail.work.originalTitle || '—'} · ภาษา: {detail.work.originalLanguage || '—'}</Text><Text fontSize="sm">ผู้แต่ง: {detail.work.originalAuthor || '—'} · ผู้แปล: {detail.work.translatorName || '—'}</Text></Box>}
      <Box><Text fontWeight="semibold">เรื่องย่อ</Text><Text mt={2} fontSize="sm" whiteSpace="pre-wrap">{detail.work.synopsis || '—'}</Text></Box><Box><Text fontWeight="semibold" mb={3}>ตัวอย่างตอน ({detail.work.episodes.length})</Text>{detail.work.episodes.map((episode) => <Box key={episode.id} borderWidth="1px" borderRadius="lg" p={4} mb={3}><Flex justify="space-between"><Text fontWeight="medium">ตอนที่ {episode.episodeNumber} · {episode.title}</Text><Badge>{episode.type}</Badge></Flex>{episode.content && <Text mt={3} fontSize="sm" whiteSpace="pre-wrap" lineClamp={5}>{episode.content}</Text>}<Flex gap={2} mt={3} wrap="wrap">{episode.assets.map((asset) => asset.contentType.startsWith('image/') ? <ChakraImage key={asset.id} src={`/api/creator-moderation/${detail.id}/media/${asset.id}`} alt={`หน้า ${asset.sortOrder + 1}`} w="90px" h="120px" objectFit="cover" borderRadius="md" /> : <audio key={asset.id} src={`/api/creator-moderation/${detail.id}/media/${asset.id}`} controls />)}</Flex></Box>)}</Box>
      {rejecting && <Box><Text fontWeight="medium" mb={2}>เหตุผลที่ปฏิเสธ *</Text><Textarea maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="ระบุเหตุผล 1–500 ตัวอักษร" /><Text textAlign="right" fontSize="xs" color="gray.500">{reason.length}/500</Text></Box>}
    </Flex>}</Dialog.Body>{detail?.status === 'pending' && <Dialog.Footer gap={2}>{rejecting ? <><Button variant="outline" onClick={() => setRejecting(false)}>ย้อนกลับ</Button><Button colorPalette="red" disabled={!reason.trim() || decisionBusy} onClick={() => void decide('rejected')}><X size={16} />ยืนยันปฏิเสธ</Button></> : <><Button colorPalette="red" variant="outline" onClick={() => setRejecting(true)}><X size={16} />ปฏิเสธ</Button><Button colorPalette="green" disabled={decisionBusy} onClick={() => void decide('approved')}><Check size={16} />อนุมัติ</Button></>}</Dialog.Footer>}</Dialog.Content></Dialog.Positioner></Dialog.Root>
  </>
}
