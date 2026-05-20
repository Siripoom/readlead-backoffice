export type ContentStatus = 'pending' | 'approved' | 'rejected'

export interface ContentItem {
  id: string
  title: string
  author: string
  category: string
  status: ContentStatus
  chapters: number
  submittedAt: string
}

export const mockContent: ContentItem[] = [
  { id: '1', title: 'ดวงใจจักรพรรดิ', author: 'นิ้วกลม', category: 'โรแมนซ์', status: 'pending', chapters: 24, submittedAt: '2026-05-14' },
  { id: '2', title: 'มังกรผู้พิทักษ์', author: 'ขวัญเรือน', category: 'แฟนตาซี', status: 'approved', chapters: 48, submittedAt: '2026-05-12' },
  { id: '3', title: 'รักข้ามภพ', author: 'ฝันดาว', category: 'โรแมนซ์', status: 'approved', chapters: 36, submittedAt: '2026-05-10' },
  { id: '4', title: 'ฆาตกรรมในคืนพายุ', author: 'ศักดิ์ชัย', category: 'ระทึกขวัญ', status: 'rejected', chapters: 12, submittedAt: '2026-05-08' },
  { id: '5', title: 'เจ้าแห่งดาบ', author: 'อรณี', category: 'แอคชั่น', status: 'pending', chapters: 60, submittedAt: '2026-05-07' },
  { id: '6', title: 'สาวน้อยมหาอำนาจ', author: 'ดาวดวงเด่น', category: 'แฟนตาซี', status: 'approved', chapters: 30, submittedAt: '2026-05-05' },
  { id: '7', title: 'บ้านลับแห่งความลึกลับ', author: 'พงศ์พล', category: 'สยองขวัญ', status: 'pending', chapters: 18, submittedAt: '2026-05-03' },
]
