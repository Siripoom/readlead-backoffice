'use client'
import { Badge, Box, Button, Card, Flex, Input, Table, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useState } from 'react'
import { toaster } from '@/lib/toaster'

type Queue={id:string;title:string;creatorName:string;reason:string;chapter?:string;status:string;submittedAt:string}
type Blacklist={id:string;term:string}

export function ModerationPanel(){
 const [queue,setQueue]=useState<Queue[]>([]),[blacklist,setBlacklist]=useState<Blacklist[]>([]),[term,setTerm]=useState('')
 const load=useCallback(()=>fetch('/api/moderation').then(r=>r.json()).then(d=>{setQueue(d.queue??[]);setBlacklist(d.blacklist??[])}),[])
 useEffect(()=>{void load()},[load])
 async function decide(id:string,decision:string){await fetch('/api/moderation',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,decision})});toaster.success({title:'อัปเดตคิวแล้ว'});load()}
 async function add(){if(!term.trim())return;const r=await fetch('/api/moderation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({term})});if(!r.ok)return toaster.error({title:'เพิ่ม blacklist ไม่สำเร็จ'});setTerm('');load()}
 async function remove(id:string){await fetch(`/api/moderation?blacklistId=${id}`,{method:'DELETE'});load()}
 const pending=queue.filter(q=>q.status==='pending')
 return <Card.Root mb={5} borderColor="orange.200"><Card.Header><Flex justify="space-between" align="center"><Text fontWeight="800">🚨 เรื่องถูกระบบคัดกรองดักไว้ <Badge colorPalette="orange">{pending.length}</Badge></Text></Flex></Card.Header><Card.Body pt={0}><Box overflowX="auto"><Table.Root size="sm"><Table.Header><Table.Row><Table.ColumnHeader>เรื่อง</Table.ColumnHeader><Table.ColumnHeader>นักเขียน</Table.ColumnHeader><Table.ColumnHeader>เหตุที่ดัก</Table.ColumnHeader><Table.ColumnHeader>ตอน</Table.ColumnHeader><Table.ColumnHeader>จัดการ</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{pending.map(q=><Table.Row key={q.id}><Table.Cell fontWeight="700">{q.title}</Table.Cell><Table.Cell>{q.creatorName}</Table.Cell><Table.Cell color="orange.700">{q.reason}</Table.Cell><Table.Cell>{q.chapter??'—'}</Table.Cell><Table.Cell><Flex gap={2}><Button size="xs" colorPalette="green" onClick={()=>decide(q.id,'approved')}>อนุมัติ</Button><Button size="xs" colorPalette="red" variant="outline" onClick={()=>decide(q.id,'rejected')}>ปฏิเสธ</Button></Flex></Table.Cell></Table.Row>)}</Table.Body></Table.Root>{pending.length===0&&<Text textAlign="center" color="gray.400" py={5}>ไม่มีเรื่องรอตรวจ</Text>}</Box><Flex mt={4} gap={2} align="center" wrap="wrap"><Input maxW="300px" placeholder="ชื่อเรื่อง / IP / คำที่ต้องบล็อก" value={term} onChange={e=>setTerm(e.target.value)}/><Button size="sm" onClick={add}>+ เพิ่ม</Button>{blacklist.map(b=><Badge key={b.id} colorPalette="red" px={2} py={1} cursor="pointer" onClick={()=>remove(b.id)}>{b.term} ×</Badge>)}</Flex></Card.Body></Card.Root>
}
