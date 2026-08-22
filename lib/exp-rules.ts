export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export const EXP_LEVELS = [
  { level: 0, name: 'นักอ่านขาจร', minExp: 0 },
  { level: 1, name: 'นักอ่านฝึกหัด', minExp: 200 },
  { level: 2, name: 'นักอ่านทั่วไป', minExp: 1_000 },
  { level: 3, name: 'นักอ่านตัวจริง', minExp: 6_000 },
  { level: 4, name: 'ขาประจำ', minExp: 30_000 },
  { level: 5, name: 'ติ่งนิยาย', minExp: 54_000 },
  { level: 6, name: 'นกฮูก', minExp: 78_000 },
  { level: 7, name: 'หนอนหนังสือ', minExp: 118_000 },
  { level: 8, name: 'ผู้หยั่งรู้', minExp: 158_000 },
] as const

export const EXP_ACTIONS = {
  read5min: { label: 'อ่าน/ฟังบทที่ซื้อ 5 นาที', weeklyCap: 1_500 },
  readFree: { label: 'อ่าน/ฟังบทฟรี 5 นาที', weeklyCap: 240 },
  comment: { label: 'คอมเมนต์', weeklyCap: 70 },
  review: { label: 'รีวิวคุณภาพ', weeklyCap: 0 },
  dailyLogin: { label: 'เข้าสู่ระบบรายวัน', weeklyCap: 21 },
  streak7: { label: 'โบนัสล็อกอินติดกัน 7 วัน', weeklyCap: 10 },
  freeTicket: { label: 'ใช้ตั๋วโหวตฟรี', weeklyCap: 42 },
  subscribe: { label: 'สมัครอ่านตอน', weeklyCap: 3_000 },
  tip: { label: 'สนับสนุนผลงาน', weeklyCap: 15_000 },
} as const

export type ExpAction = keyof typeof EXP_ACTIONS
export const FREE_EXP_ACTIONS: readonly ExpAction[] = ['read5min', 'readFree', 'comment', 'review', 'dailyLogin', 'streak7', 'freeTicket']
export const FREE_WEEK_MAX = FREE_EXP_ACTIONS.reduce((sum, action) => sum + EXP_ACTIONS[action].weeklyCap, 0)

export type ExpEntryLike = {
  userId: string
  amount: number
  action: string
  status: string
  createdAt: Date | string
}

export type ExpAccountLike = {
  userId: string
  balance: number
  joinedAt: Date | string
  userName: string
}

export type ExpAlert = {
  type: 'mismatch' | 'free-cap' | 'rapid-growth' | 'bot-like' | 'new-account'
  severity: 'critical' | 'warning'
  userId: string
  userName: string
  rule: string
  detail: string
  breakdown?: string
}

export type TicketEntryLike = {
  type: string
  amount: number
  metadata?: unknown
}

export type VoteFanTotals = {
  freeVotes: number
  monthlyVotes: number
  coins: number
  fanPoints: number
}

export function bangkokDayKey(value: Date | string | number = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10)
}

export function bangkokDayStart(value: Date | string | number = new Date()) {
  return new Date(`${bangkokDayKey(value)}T00:00:00+07:00`)
}

export function bangkokWeekStart(value: Date | string | number = new Date()) {
  const start = bangkokDayStart(value)
  const shifted = new Date(start.getTime() + BANGKOK_OFFSET_MS)
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7
  return new Date(start.getTime() - daysSinceMonday * 86_400_000)
}

export function levelForExp(exp: number) {
  let current: (typeof EXP_LEVELS)[number] = EXP_LEVELS[0]
  for (const level of EXP_LEVELS) if (exp >= level.minExp) current = level
  return current
}

export function expProgress(exp: number) {
  const current = levelForExp(exp)
  const next = EXP_LEVELS.find((level) => level.level === current.level + 1) ?? null
  const percent = next
    ? Math.min(100, Math.max(0, Math.round(((exp - current.minExp) / (next.minExp - current.minExp)) * 100)))
    : 100
  return { ...current, next, percent }
}

export function expActionLabel(action: string) {
  return action in EXP_ACTIONS ? EXP_ACTIONS[action as ExpAction].label : action
}

export function weeklyCapMeters(entries: ExpEntryLike[], now: Date | string | number = new Date()) {
  const weekStart = bangkokWeekStart(now).getTime()
  return Object.entries(EXP_ACTIONS)
    .filter(([, config]) => config.weeklyCap > 0)
    .map(([action, config]) => ({
      action,
      label: config.label,
      cap: config.weeklyCap,
      used: entries.reduce((sum, entry) => {
        const eligible = entry.action === action
          && ['granted', 'pending'].includes(entry.status)
          && new Date(entry.createdAt).getTime() >= weekStart
        return sum + (eligible ? entry.amount : 0)
      }, 0),
    }))
}

function breakdown(entries: ExpEntryLike[]) {
  const totals = new Map<string, number>()
  for (const entry of entries) totals.set(entry.action, (totals.get(entry.action) ?? 0) + entry.amount)
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([action, amount]) => `${expActionLabel(action)} ${amount.toLocaleString('th-TH')}`)
    .join(' · ')
}

export function buildExpAlerts(accounts: ExpAccountLike[], entries: ExpEntryLike[], now = new Date()): ExpAlert[] {
  const alerts: ExpAlert[] = []
  const nowMs = now.getTime()
  const weekStart = bangkokWeekStart(now).getTime()

  for (const account of accounts) {
    const granted = entries.filter((entry) => entry.userId === account.userId && entry.status === 'granted')
    const ledgerBalance = granted.reduce((sum, entry) => sum + entry.amount, 0)
    if (ledgerBalance !== account.balance) {
      alerts.push({
        type: 'mismatch', severity: 'critical', userId: account.userId, userName: account.userName,
        rule: 'บัญชีไม่ลงตัว ระบบผิดพลาด หรือถูกแก้ตัวเลขตรงๆ',
        detail: `ยอดบนบัญชี ${account.balance.toLocaleString('th-TH')} EXP แต่ผลบวกจากสมุดได้ ${ledgerBalance.toLocaleString('th-TH')} EXP (ต่างกัน ${Math.abs(account.balance - ledgerBalance).toLocaleString('th-TH')})`,
        breakdown: 'ทุกแต้มที่ถูกกติกาต้องมีบันทึกในสมุดเสมอ ยอดที่ไม่มีที่มาคือธงแดงที่สุดของระบบ',
      })
    }

    const last24 = granted.filter((entry) => nowMs - new Date(entry.createdAt).getTime() < 86_400_000)
    const sum24 = last24.reduce((sum, entry) => sum + entry.amount, 0)
    if (sum24 > 1_000) {
      const freeSum = last24.filter((entry) => FREE_EXP_ACTIONS.includes(entry.action as ExpAction)).reduce((sum, entry) => sum + entry.amount, 0)
      const impossible = freeSum > FREE_WEEK_MAX
      alerts.push({
        type: impossible ? 'free-cap' : 'rapid-growth', severity: impossible ? 'critical' : 'warning',
        userId: account.userId, userName: account.userName,
        rule: impossible ? 'แต้มสายฟรีทะลุเพดานที่เป็นไปได้' : 'แต้มพุ่งเร็วผิดปกติ',
        detail: `ได้ ${sum24.toLocaleString('th-TH')} EXP ใน 24 ชม. เทียบเกณฑ์: สายฟรีทั้งสัปดาห์ทำได้สูงสุด ${FREE_WEEK_MAX.toLocaleString('th-TH')} EXP${impossible ? ` แต่คนนี้ได้จากสายฟรี ${freeSum.toLocaleString('th-TH')} = มีรูรั่วหรือโกงแน่นอน` : ' ก้อนนี้มาจากการใช้จ่ายเป็นหลัก อาจเป็นลูกค้ารายใหญ่'}`,
        breakdown: `ที่มาของแต้ม: ${breakdown(last24)}`,
      })
    }

    const maxed = weeklyCapMeters(granted.filter((entry) => new Date(entry.createdAt).getTime() >= weekStart), now)
      .filter((meter) => meter.used >= meter.cap)
    if (maxed.length >= 3) {
      alerts.push({
        type: 'bot-like', severity: 'warning', userId: account.userId, userName: account.userName,
        rule: 'พฤติกรรมคล้ายบอท',
        detail: `ชนเพดานพร้อมกัน ${maxed.length} หมวดในสัปดาห์นี้ คนทั่วไปแทบไม่กดครบทุกช่องแบบนี้`,
        breakdown: `หมวดที่ชน: ${maxed.map((meter) => meter.label).join(' · ')}`,
      })
    }

    const age = nowMs - new Date(account.joinedAt).getTime()
    if (age < 7 * 86_400_000 && account.balance > 500) {
      const freeAll = granted.filter((entry) => FREE_EXP_ACTIONS.includes(entry.action as ExpAction)).reduce((sum, entry) => sum + entry.amount, 0)
      alerts.push({
        type: 'new-account', severity: freeAll > FREE_WEEK_MAX ? 'critical' : 'warning',
        userId: account.userId, userName: account.userName, rule: 'บัญชีใหม่แต้มพุ่ง',
        detail: `อายุบัญชี ${Math.max(1, Math.ceil(age / 86_400_000))} วัน มี ${account.balance.toLocaleString('th-TH')} EXP เทียบเกณฑ์: สัปดาห์แรกสายฟรีล้วนไม่ควรเกิน ${FREE_WEEK_MAX.toLocaleString('th-TH')}`,
        breakdown: `ที่มาของแต้ม: ${breakdown(granted)}`,
      })
    }
  }

  return alerts.sort((a, b) => Number(a.severity === 'warning') - Number(b.severity === 'warning'))
}

function metadataNumber(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 0
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

export function voteFanTotals(entries: TicketEntryLike[]): VoteFanTotals {
  let freeVotes = 0
  let monthlyVotes = 0
  let coins = 0
  for (const entry of entries) {
    if (entry.type === 'vote_free') freeVotes += Math.abs(entry.amount)
    else if (entry.type === 'vote_month') monthlyVotes += Math.abs(entry.amount)
    else if (entry.type === 'tip' || entry.type === 'subscription') coins += Math.abs(entry.amount)
    else if (entry.type === 'revoke') {
      freeVotes -= metadataNumber(entry.metadata, 'freeVotes')
      monthlyVotes -= metadataNumber(entry.metadata, 'monthlyVotes')
      coins -= metadataNumber(entry.metadata, 'coins')
    }
  }
  freeVotes = Math.max(0, freeVotes)
  monthlyVotes = Math.max(0, monthlyVotes)
  coins = Math.max(0, coins)
  return { freeVotes, monthlyVotes, coins, fanPoints: freeVotes + monthlyVotes * 15 + coins }
}
