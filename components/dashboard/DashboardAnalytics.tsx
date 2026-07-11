'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './DashboardAnalytics.module.css'

type Metric = 'users' | 'works' | 'revenue' | 'online'
type IncomeRow = { id: string; month: string; income: number; transactions: number; recordedAt: string }
type DashboardData = {
  totals: Record<Metric, number>
  breakdown: { users: Record<string, number>; works: Record<string, number> }
  series: { users: string[]; works: string[]; revenue: { date: string; value: number }[] }
  income: IncomeRow[]
  years: number[]
}

const metrics: Record<Metric, { label: string; money?: boolean }> = {
  users: { label: 'ผู้ใช้งาน' },
  works: { label: 'ผลงาน' },
  revenue: { label: 'รายได้', money: true },
  online: { label: 'ผู้ออนไลน์' },
}
const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }
function formatValue(value: number, money = false) { return `${money ? '฿' : ''}${Math.round(value).toLocaleString('en-US')}` }
function shortValue(value: number, money = false) {
  const prefix = money ? '฿' : ''
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${prefix}${Math.round(value / 1_000)}k`
  return `${prefix}${Math.round(value).toLocaleString('en-US')}`
}
function daily(data: DashboardData | null, metric: Metric, month: number, year: number) {
  const days = new Date(year, month + 1, 0).getDate()
  const values = Array<number>(days).fill(0)
  if (!data) return values
  if (metric === 'online') return values
  if (metric === 'revenue') {
    data.series.revenue.forEach(({ date, value }) => {
      const itemDate = new Date(date)
      if (itemDate.getMonth() === month && itemDate.getFullYear() === year) values[itemDate.getDate() - 1] += value
    })
    return values
  }
  data.series[metric].forEach((date) => {
    const itemDate = new Date(date)
    if (itemDate.getMonth() === month && itemDate.getFullYear() === year) values[itemDate.getDate() - 1] += 1
  })
  return values
}
function smoothPath(values: number[], width: number, height: number, max: number) {
  const points = values.map((value, index) => [index * width / Math.max(values.length - 1, 1), height - value / max * height])
  if (!points.length) return ''
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index]
    const middle = (previous[0] + point[0]) / 2
    return `${path} C ${middle} ${previous[1]} ${middle} ${point[1]} ${point[0]} ${point[1]}`
  }, `M ${points[0][0]} ${points[0][1]}`)
}
function periodLabel(month: number, year: number) { return `${months[month]} ${year}` }

export function DashboardAnalytics() {
  const now = new Date()
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [metric, setMetric] = useState<Metric>('users')
  const [monthA, setMonthA] = useState(now.getMonth())
  const [yearA, setYearA] = useState(now.getFullYear())
  const [monthB, setMonthB] = useState(previous.getMonth())
  const [yearB, setYearB] = useState(previous.getFullYear())
  const [compare, setCompare] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/dashboard', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); return response.json() })
      .then(setData)
      .catch((fetchError) => { if (fetchError.name !== 'AbortError') setError(true) })
    return () => controller.abort()
  }, [])

  const current = useMemo(() => daily(data, metric, monthA, yearA), [data, metric, monthA, yearA])
  const comparison = useMemo(() => daily(data, metric, monthB, yearB), [data, metric, monthB, yearB])
  const yearTotal = (selectedYear: number) => Array.from({ length: 12 }, (_, month) => sum(daily(data, metric, month, selectedYear))).reduce((a, b) => a + b, 0)
  const max = Math.max(...current, ...(compare ? comparison : []), 1)
  const currentSum = sum(current)
  const comparisonSum = sum(comparison)
  const change = comparisonSum ? (currentSum - comparisonSum) / comparisonSum * 100 : null
  const years = data?.years?.length ? data.years : [now.getFullYear(), now.getFullYear() - 1]
  const userSub = data ? `นักอ่าน ${(data.breakdown.users.user ?? 0).toLocaleString()} · นักเขียน ${(data.breakdown.users.creator ?? 0).toLocaleString()}` : 'กำลังโหลดข้อมูล...'
  const workSub = data ? Object.entries(data.breakdown.works).slice(0, 3).map(([name, count]) => `${name} ${count.toLocaleString()}`).join(' · ') || 'ยังไม่มีผลงาน' : 'กำลังโหลดข้อมูล...'
  // MonthlyIncome has no transaction-level date, so a truthful daily total is unavailable.
  const todayIncome = 0
  const monthIncome = sum(daily(data, 'revenue', now.getMonth(), now.getFullYear()))
  const yearIncome = Array.from({ length: 12 }, (_, month) => sum(daily(data, 'revenue', month, now.getFullYear()))).reduce((a, b) => a + b, 0)
  const online = data?.totals.online ?? 0
  const cards: { key: Metric; label: string; value: string; sub: React.ReactNode; comparison?: string }[] = [
    { key: 'users', label: 'ผู้ใช้งานทั้งหมด', value: (data?.totals.users ?? 0).toLocaleString(), sub: userSub },
    { key: 'works', label: 'ผลงานทั้งหมด', value: (data?.totals.works ?? 0).toLocaleString(), sub: workSub },
    { key: 'revenue', label: 'รายได้รวม (บาท)', value: formatValue(data?.totals.revenue ?? 0), sub: 'ยอดสะสมทั้งหมด' },
    { key: 'online', label: 'ผู้ออนไลน์ปัจจุบัน', value: online.toLocaleString(), sub: <><span className={styles.live}>● สด</span> · อิงบัญชีที่ active</>, comparison: '—' },
  ]

  return <div className={styles.dashboard}>
    <header className={styles.pageHead}>
      <h1>ภาพรวมระบบ</h1>
      <p>สรุปภาพรวมทั้งเว็บ ณ วันที่ {now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })}</p>
    </header>

    {error && <div className={styles.error}>ไม่สามารถโหลดข้อมูลล่าสุดได้ กรุณาลองรีเฟรชอีกครั้ง</div>}
    <div className={styles.cards}>
      {cards.map((card) => {
        const values = daily(data, card.key, now.getMonth(), now.getFullYear())
        const previousValues = daily(data, card.key, previous.getMonth(), previous.getFullYear())
        const before = sum(previousValues)
        const percentage = before ? (sum(values) - before) / before * 100 : null
        const down = percentage !== null && percentage < 0
        return <button key={card.key} type="button" className={`${styles.card} ${metric === card.key ? styles.selected : ''}`} onClick={() => setMetric(card.key)}>
          <span className={styles.cardTop}>
            <span className={styles.cardLabel}>{card.label}</span>
            <span className={styles.pillBox}>
              <span className={`${styles.pill} ${down ? styles.pillDown : styles.pillUp}`}>{card.comparison ?? (percentage === null ? '—' : `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`)}</span>
              <span className={styles.compareLabel}>{card.key === 'online' ? 'ไม่มีข้อมูลย้อนหลัง' : 'เทียบเดือนก่อน'}</span>
            </span>
          </span>
          <strong className={styles.cardValue}>{card.value}</strong>
          <span className={styles.cardSub}>{card.sub}</span>
        </button>
      })}
    </div>

    <section className={styles.panel}>
      <h2>แนวโน้ม{metrics[metric].label}</h2>
      <div className={styles.controls}>
        <span className={styles.currentLine} />
        <select aria-label="เดือนของเส้นหลัก" value={monthA} onChange={(event) => setMonthA(Number(event.target.value))}>{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
        <select aria-label="ปีของเส้นหลัก" value={yearA} onChange={(event) => setYearA(Number(event.target.value))}>{years.map((year) => <option key={year}>{year}</option>)}</select>
        <label className={styles.checkbox}><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /> เทียบกับ</label>
        {compare && <><span className={styles.previousLine} /><select aria-label="เดือนของเส้นเปรียบเทียบ" value={monthB} onChange={(event) => setMonthB(Number(event.target.value))}>{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</select><select aria-label="ปีของเส้นเปรียบเทียบ" value={yearB} onChange={(event) => setYearB(Number(event.target.value))}>{years.map((year) => <option key={year}>{year}</option>)}</select></>}
        {compare && <span className={`${styles.change} ${(change ?? 0) < 0 ? styles.changeDown : styles.changeUp}`}>{change === null ? 'ยังไม่มีข้อมูลเปรียบเทียบ' : `${change >= 0 ? '▲ ดีกว่า' : '▼ น้อยกว่า'} ${periodLabel(monthB, yearB)} ${Math.abs(change).toFixed(1)}%`}</span>}
      </div>
      <div className={styles.chartWrap}>
        <svg viewBox="0 0 660 170" role="img" aria-label={`กราฟแนวโน้ม${metrics[metric].label}`} preserveAspectRatio="none">
          {Array.from({ length: 5 }, (_, index) => { const y = 10 + index * 32; const value = max * (1 - index / 4); return <g key={y}><line x1="54" y1={y} x2="650" y2={y} className={styles.gridLine} /><text x="47" y={y + 4} textAnchor="end" className={styles.axisText}>{shortValue(value, metrics[metric].money)}</text></g> })}
          {[0, 5, 10, 15, 20, 25, 30].filter((day) => day < current.length).map((day) => <text key={day} x={54 + day * 596 / Math.max(current.length - 1, 1)} y="166" textAnchor="middle" className={styles.axisText}>{day + 1}</text>)}
          {compare && <path d={smoothPath(comparison, 596, 128, max)} transform="translate(54 10)" className={styles.comparePath} />}
          <path d={smoothPath(current, 596, 128, max)} transform="translate(54 10)" className={styles.currentPath} />
        </svg>
      </div>
      <div className={styles.tableWrap}><table className={styles.summary}><thead><tr><th /><th><i className={styles.dotCurrent} />เส้นหลัก · {periodLabel(monthA, yearA)}</th>{compare && <th><i className={styles.dotPrevious} />เส้นเทียบ · {periodLabel(monthB, yearB)}</th>}</tr></thead><tbody>
        {[
          ['สูงสุดในเดือน', Math.max(...current), Math.max(...comparison)],
          ['รวมทั้งเดือน', currentSum, comparisonSum],
          ['รวมทั้งปี', yearTotal(yearA), yearTotal(yearB)],
        ].map(([label, a, b]) => <tr key={label}><td>{label}</td><td>{formatValue(Number(a), metrics[metric].money)}</td>{compare && <td>{formatValue(Number(b), metrics[metric].money)}</td>}</tr>)}
      </tbody></table></div>
    </section>

    <section className={styles.panel}>
      <h2>ยอดเงินที่เติมเข้ามา (เติมเหรียญ)</h2>
      <div className={styles.miniRow}>{[['วันนี้', todayIncome], ['เดือนนี้', monthIncome], ['ปีนี้', yearIncome]].map(([label, value]) => <div className={styles.mini} key={String(label)}><span>{label}</span><strong>{formatValue(Number(value), true)}</strong></div>)}</div>
    </section>
  </div>
}
