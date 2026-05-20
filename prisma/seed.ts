import { PrismaClient } from '../lib/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  // Users
  const users = [
    { id: 'u1', name: 'สมชาย ใจดี',        email: 'somchai@email.com',  joinedAt: new Date('2025-01-10'), status: 'active'   as const, userType: 'user'    as const },
    { id: 'u2', name: 'วาริน สุขใส',        email: 'warin@email.com',    joinedAt: new Date('2025-02-14'), status: 'active'   as const, userType: 'user'    as const },
    { id: 'u3', name: 'พิมพ์ใจ ดีงาม',      email: 'pimjai@email.com',   joinedAt: new Date('2025-03-22'), status: 'inactive' as const, userType: 'user'    as const },
    { id: 'u4', name: 'อนันต์ วงศ์สวัสดิ์', email: 'anan@email.com',     joinedAt: new Date('2025-04-01'), status: 'banned'   as const, userType: 'user'    as const },
    { id: 'u5', name: 'นริศา มั่นคง',        email: 'narisa@email.com',   joinedAt: new Date('2025-05-18'), status: 'active'   as const, userType: 'user'    as const },
  ]
  for (const u of users) {
    await prisma.user.upsert({ where: { id: u.id }, update: u, create: u })
  }

  // Creators
  const creators = [
    { id: 'c1', name: 'นิ้วกลม',      email: 'niugram@email.com',  joinedAt: new Date('2024-08-01'), status: 'active'   as const, userType: 'creator' as const },
    { id: 'c2', name: 'ขวัญเรือน',    email: 'kwanruen@email.com', joinedAt: new Date('2024-09-15'), status: 'active'   as const, userType: 'creator' as const },
    { id: 'c3', name: 'ฝันดาว',       email: 'fandao@email.com',   joinedAt: new Date('2024-10-20'), status: 'active'   as const, userType: 'creator' as const },
    { id: 'c4', name: 'อรณี',         email: 'orani@email.com',    joinedAt: new Date('2025-01-05'), status: 'inactive' as const, userType: 'creator' as const },
    { id: 'c5', name: 'ดาวดวงเด่น',   email: 'daoduan@email.com',  joinedAt: new Date('2025-03-11'), status: 'active'   as const, userType: 'creator' as const },
  ]
  const creatorProfiles = [
    { userId: 'c1', works: 5, followers: 12400 },
    { userId: 'c2', works: 3, followers: 8700  },
    { userId: 'c3', works: 7, followers: 21000 },
    { userId: 'c4', works: 1, followers: 540   },
    { userId: 'c5', works: 4, followers: 9200  },
  ]
  for (const c of creators) {
    await prisma.user.upsert({ where: { id: c.id }, update: c, create: c })
  }
  for (const cp of creatorProfiles) {
    await prisma.creatorProfile.upsert({ where: { userId: cp.userId }, update: cp, create: cp })
  }

  // Admins
  const admins = [
    { id: 'a1', name: 'Admin Super',    email: 'superadmin@readlead.com', joinedAt: new Date('2024-01-01'), status: 'active' as const, userType: 'admin' as const },
    { id: 'a2', name: 'สุรีย์ จัดการ', email: 'suree@readlead.com',      joinedAt: new Date('2024-03-15'), status: 'active' as const, userType: 'admin' as const },
    { id: 'a3', name: 'ภูมิ ตรวจสอบ',  email: 'poom@readlead.com',       joinedAt: new Date('2024-06-01'), status: 'active' as const, userType: 'admin' as const },
  ]
  const adminProfiles = [
    { userId: 'a1', role: 'Super Admin',     lastLogin: new Date('2026-05-16') },
    { userId: 'a2', role: 'Content Manager', lastLogin: new Date('2026-05-15') },
    { userId: 'a3', role: 'Moderator',       lastLogin: new Date('2026-05-14') },
  ]
  for (const a of admins) {
    await prisma.user.upsert({ where: { id: a.id }, update: a, create: a })
  }
  for (const ap of adminProfiles) {
    await prisma.adminProfile.upsert({ where: { userId: ap.userId }, update: ap, create: ap })
  }

  // Content
  const contents = [
    { id: 'ct1', title: 'ดวงใจจักรพรรดิ',       author: 'นิ้วกลม',     category: 'โรแมนซ์',   status: 'pending'  as const, chapters: 24, submittedAt: new Date('2026-05-14') },
    { id: 'ct2', title: 'มังกรผู้พิทักษ์',       author: 'ขวัญเรือน',  category: 'แฟนตาซี',   status: 'approved' as const, chapters: 48, submittedAt: new Date('2026-05-12') },
    { id: 'ct3', title: 'รักข้ามภพ',             author: 'ฝันดาว',     category: 'โรแมนซ์',   status: 'approved' as const, chapters: 36, submittedAt: new Date('2026-05-10') },
    { id: 'ct4', title: 'ฆาตกรรมในคืนพายุ',      author: 'ศักดิ์ชัย',  category: 'ระทึกขวัญ', status: 'rejected' as const, chapters: 12, submittedAt: new Date('2026-05-08') },
    { id: 'ct5', title: 'เจ้าแห่งดาบ',           author: 'อรณี',       category: 'แอคชั่น',   status: 'pending'  as const, chapters: 60, submittedAt: new Date('2026-05-07') },
    { id: 'ct6', title: 'สาวน้อยมหาอำนาจ',       author: 'ดาวดวงเด่น', category: 'แฟนตาซี',   status: 'approved' as const, chapters: 30, submittedAt: new Date('2026-05-05') },
    { id: 'ct7', title: 'บ้านลับแห่งความลึกลับ', author: 'พงศ์พล',     category: 'สยองขวัญ',  status: 'pending'  as const, chapters: 18, submittedAt: new Date('2026-05-03') },
  ]
  for (const c of contents) {
    await prisma.content.upsert({ where: { id: c.id }, update: c, create: c })
  }

  // Reports
  const reports = [
    { id: 'r1', senderName: 'สมชาย ใจดี',       subject: 'เนื้อหาไม่เหมาะสมในตอนที่ 12', type: 'inappropriate_content' as const, date: new Date('2026-05-15'), status: 'open'        as const, message: 'ตอนที่ 12 ของเรื่อง "มังกรผู้พิทักษ์" มีเนื้อหาที่ไม่เหมาะสม' },
    { id: 'r2', senderName: 'วาริน สุขใส',       subject: 'นักเขียนส่งเนื้อหาซ้ำซ้อน',    type: 'spam'                  as const, date: new Date('2026-05-14'), status: 'in_progress'  as const, message: 'นักเขียนชื่อ "ฝันดาว" ได้อัพโหลดเนื้อหาเดียวกันซ้ำหลายครั้ง' },
    { id: 'r3', senderName: 'นริศา มั่นคง',       subject: 'คัดลอกงานจากที่อื่น',          type: 'copyright'             as const, date: new Date('2026-05-13'), status: 'resolved'     as const, message: 'เรื่อง "รักข้ามภพ" มีเนื้อหาที่คัดลอกมาจากนิยายต่างประเทศ' },
    { id: 'r4', senderName: 'พิมพ์ใจ ดีงาม',     subject: 'ผู้ใช้ส่งข้อความรุกราน',       type: 'harassment'            as const, date: new Date('2026-05-12'), status: 'open'         as const, message: 'ผู้ใช้ชื่อ "user_x123" ส่งข้อความที่มีเนื้อหาล่วงละเมิด' },
    { id: 'r5', senderName: 'อนันต์ วงศ์สวัสดิ์', subject: 'โฆษณาในส่วนคอมเมนต์',         type: 'spam'                  as const, date: new Date('2026-05-11'), status: 'in_progress'  as const, message: 'มีบัญชีหลายบัญชีที่โพสต์โฆษณาสินค้าในส่วนคอมเมนต์' },
    { id: 'r6', senderName: 'ภูมิพล รักษา',      subject: 'เนื้อหามีความรุนแรงเกินไป',    type: 'inappropriate_content' as const, date: new Date('2026-05-10'), status: 'resolved'     as const, message: 'เรื่อง "เจ้าแห่งดาบ" มีฉากความรุนแรงที่รุนแรงมากเกินไป' },
    { id: 'r7', senderName: 'มาลี สดใส',         subject: 'ปัญหาการชำระเงิน',             type: 'other'                 as const, date: new Date('2026-05-09'), status: 'open'         as const, message: 'ชำระเงินซื้อเหรียญแล้วแต่เหรียญยังไม่เข้าบัญชี' },
  ]
  for (const r of reports) {
    await prisma.report.upsert({ where: { id: r.id }, update: r, create: r })
  }

  // Punishment levels
  const levels = [
    { id: 'pl1', level: 1, name: 'คำเตือน',             threshold: 1,  duration: 0  },
    { id: 'pl2', level: 2, name: 'ระงับชั่วคราว 3 วัน', threshold: 3,  duration: 3  },
    { id: 'pl3', level: 3, name: 'ระงับชั่วคราว 7 วัน', threshold: 5,  duration: 7  },
    { id: 'pl4', level: 4, name: 'ระงับ 30 วัน',         threshold: 8,  duration: 30 },
    { id: 'pl5', level: 5, name: 'แบนถาวร',              threshold: 10, duration: 0  },
  ]
  for (const l of levels) {
    await prisma.punishmentLevel.upsert({ where: { id: l.id }, update: l, create: l })
  }

  // Punishment records
  const punishRecords = [
    { id: 'ph1', userId: 'u1', levelName: 'คำเตือน',             date: new Date('2025-03-15'), note: 'ส่งสแปมในคอมเมนต์' },
    { id: 'ph2', userId: 'u4', levelName: 'ระงับชั่วคราว 3 วัน', date: new Date('2025-04-10'), note: 'เนื้อหาไม่เหมาะสม' },
    { id: 'ph3', userId: 'u4', levelName: 'ระงับชั่วคราว 7 วัน', date: new Date('2025-05-01'), note: 'ละเมิดลิขสิทธิ์' },
    { id: 'ph4', userId: 'c2', levelName: 'คำเตือน',             date: new Date('2025-02-20'), note: 'โพสต์เนื้อหาซ้ำ' },
  ]
  for (const r of punishRecords) {
    await prisma.punishmentRecord.upsert({ where: { id: r.id }, update: r, create: r })
  }

  // Monthly income
  const incomes = [
    { id: 'mi1', month: 'มกราคม 2026',    income: 98400,  transactions: 1842, creators: 412 },
    { id: 'mi2', month: 'กุมภาพันธ์ 2026', income: 104200, transactions: 1960, creators: 438 },
    { id: 'mi3', month: 'มีนาคม 2026',     income: 115800, transactions: 2104, creators: 471 },
    { id: 'mi4', month: 'เมษายน 2026',     income: 109600, transactions: 2033, creators: 456 },
    { id: 'mi5', month: 'พฤษภาคม 2026',    income: 124500, transactions: 2287, creators: 501 },
  ]
  for (const i of incomes) {
    await prisma.monthlyIncome.upsert({ where: { id: i.id }, update: i, create: i })
  }

  // Withdrawal requests
  const withdrawals = [
    { id: 'w1', creator: 'ฝันดาว',      bank: 'กสิกรไทย',     bankAccount: 'xxx-x-xx892-4', amount: 8400,  requestedAt: new Date('2026-05-15'), status: 'pending'  as const },
    { id: 'w2', creator: 'ขวัญเรือน',   bank: 'ไทยพาณิชย์',   bankAccount: 'xxx-x-xx341-7', amount: 5200,  requestedAt: new Date('2026-05-14'), status: 'pending'  as const },
    { id: 'w3', creator: 'นิ้วกลม',     bank: 'กรุงเทพ',       bankAccount: 'xxx-x-xx120-1', amount: 12600, requestedAt: new Date('2026-05-13'), status: 'approved' as const },
    { id: 'w4', creator: 'ดาวดวงเด่น',  bank: 'กรุงไทย',       bankAccount: 'xxx-x-xx574-9', amount: 3800,  requestedAt: new Date('2026-05-12'), status: 'approved' as const },
    { id: 'w5', creator: 'อรณี',        bank: 'ทหารไทยธนชาต',  bankAccount: 'xxx-x-xx203-6', amount: 1500,  requestedAt: new Date('2026-05-11'), status: 'rejected' as const },
    { id: 'w6', creator: 'ศักดิ์ชัย',   bank: 'กสิกรไทย',     bankAccount: 'xxx-x-xx788-2', amount: 6700,  requestedAt: new Date('2026-05-10'), status: 'pending'  as const },
    { id: 'w7', creator: 'ฝันดาว',      bank: 'กสิกรไทย',     bankAccount: 'xxx-x-xx892-4', amount: 9100,  requestedAt: new Date('2026-05-08'), status: 'approved' as const },
    { id: 'w8', creator: 'พงศ์พล',      bank: 'ไทยพาณิชย์',   bankAccount: 'xxx-x-xx455-3', amount: 4200,  requestedAt: new Date('2026-05-07'), status: 'pending'  as const },
  ]
  for (const w of withdrawals) {
    await prisma.withdrawalRequest.upsert({ where: { id: w.id }, update: w, create: w })
  }

  // Promotions
  const promotions = [
    { id: 'pm1', name: 'Welcome Pack',     discount: 20, validFrom: new Date('2026-05-01'), validTo: new Date('2026-05-31'), active: true  },
    { id: 'pm2', name: 'Summer Sale',      discount: 30, validFrom: new Date('2026-06-01'), validTo: new Date('2026-06-30'), active: false },
    { id: 'pm3', name: 'VIP Bonus',        discount: 15, validFrom: new Date('2026-05-15'), validTo: new Date('2026-07-15'), active: true  },
    { id: 'pm4', name: 'New Year Special', discount: 50, validFrom: new Date('2026-12-25'), validTo: new Date('2027-01-05'), active: false },
  ]
  for (const p of promotions) {
    await prisma.promotion.upsert({ where: { id: p.id }, update: p, create: p })
  }

  // Pricing
  const pricings = [
    { id: 'pr1', category: 'นิยายทั่วไป', pricePerEpisode: 5, currency: 'เหรียญ' },
    { id: 'pr2', category: 'มังงะ',        pricePerEpisode: 8, currency: 'เหรียญ' },
    { id: 'pr3', category: 'นิยายเสียง',   pricePerEpisode: 7, currency: 'เหรียญ' },
  ]
  for (const p of pricings) {
    await prisma.pricing.upsert({ where: { id: p.id }, update: p, create: p })
  }

  // VIP levels
  const vipLevels = [
    { id: 'v1', level: 1, name: 'Silver',   minSpend: 100,  badge: 'เงิน',     color: 'gray'   },
    { id: 'v2', level: 2, name: 'Gold',     minSpend: 500,  badge: 'ทอง',      color: 'yellow' },
    { id: 'v3', level: 3, name: 'Platinum', minSpend: 1500, badge: 'แพลทินัม', color: 'cyan'   },
    { id: 'v4', level: 4, name: 'Diamond',  minSpend: 5000, badge: 'ไดมอนด์',  color: 'blue'   },
  ]
  for (const v of vipLevels) {
    await prisma.vipLevel.upsert({ where: { id: v.id }, update: v, create: v })
  }

  // Exp titles
  const expTitles = [
    { id: 'e1', minExp: 0,     title: 'นักอ่านมือใหม่',         badge: 'Newbie', color: 'gray'   },
    { id: 'e2', minExp: 500,   title: 'นักอ่านผู้กระตือรือร้น', badge: 'Reader', color: 'green'  },
    { id: 'e3', minExp: 2000,  title: 'นักอ่านชำนาญ',           badge: 'Expert', color: 'blue'   },
    { id: 'e4', minExp: 5000,  title: 'ราชานักอ่าน',            badge: 'Master', color: 'purple' },
    { id: 'e5', minExp: 15000, title: 'ตำนานแห่งการอ่าน',       badge: 'Legend', color: 'orange' },
  ]
  for (const e of expTitles) {
    await prisma.expTitle.upsert({ where: { id: e.id }, update: e, create: e })
  }

  // Ad placements
  const adPlacements = [
    { id: 'apl1', name: 'แบนเนอร์บนสุด',         location: 'หน้าแรก — Top',               type: 'banner'       as const, active: true  },
    { id: 'apl2', name: 'แบนเนอร์ระหว่างตอน',    location: 'หน้าอ่าน — Between chapters', type: 'in_content'   as const, active: true  },
    { id: 'apl3', name: 'Interstitial ก่อนอ่าน', location: 'หน้าอ่าน — Pre-read',         type: 'interstitial' as const, active: false },
    { id: 'apl4', name: 'แบนเนอร์ท้ายหน้า',      location: 'ทุกหน้า — Footer',            type: 'banner'       as const, active: true  },
    { id: 'apl5', name: 'โฆษณาในคอมเมนต์',       location: 'หน้าอ่าน — Comment section',  type: 'in_content'   as const, active: false },
  ]
  for (const ap of adPlacements) {
    await prisma.adPlacement.upsert({ where: { id: ap.id }, update: ap, create: ap })
  }

  // Ads
  const ads = [
    { id: 'ad1', name: 'แคมเปญ Book Fair 2026', advertiser: 'สำนักพิมพ์ A', type: 'banner'       as const, validFrom: new Date('2026-05-01'), validTo: new Date('2026-05-31'), active: true  },
    { id: 'ad2', name: 'โปรฤดูร้อน',            advertiser: 'ร้านหนังสือ B', type: 'interstitial' as const, validFrom: new Date('2026-04-15'), validTo: new Date('2026-06-15'), active: true  },
    { id: 'ad3', name: 'โฆษณาแอปอ่านหนังสือ',   advertiser: 'StartUp C',     type: 'in_content'   as const, validFrom: new Date('2026-05-10'), validTo: new Date('2026-07-10'), active: false },
    { id: 'ad4', name: 'Flash Sale สัปดาห์นี้', advertiser: 'สำนักพิมพ์ D', type: 'banner'       as const, validFrom: new Date('2026-05-17'), validTo: new Date('2026-05-24'), active: true  },
  ]
  for (const a of ads) {
    await prisma.ad.upsert({ where: { id: a.id }, update: a, create: a })
  }

  console.log('Seed completed.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
