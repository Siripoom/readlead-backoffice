'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, DollarSign, Flag, Images, LayoutDashboard, ShieldAlert, Sparkles, Ticket, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import styles from './Sidebar.module.css'

interface NavChild { label: string; href: string; tab: string }
interface NavItem { label: string; href?: string; icon: LucideIcon; permission: string; children?: NavChild[] }

const navItems: NavItem[] = [
  { label: 'ภาพรวมระบบ', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { label: 'จัดการผู้ใช้', icon: Users, permission: 'users', children: [{ label: 'ผู้ใช้งาน', href: '/users?tab=users', tab: 'users' }, { label: 'นักเขียน', href: '/users?tab=creators', tab: 'creators' }, { label: 'แอดมิน', href: '/users?tab=admins', tab: 'admins' }] },
  { label: 'รายงาน', href: '/report', icon: Flag, permission: 'reports' },
  { label: 'การเงินของเว็บ', href: '/finance', icon: DollarSign, permission: 'finance' },
  { label: 'บทลงโทษ', href: '/punishment', icon: ShieldAlert, permission: 'punishment' },
  { label: 'แบนเนอร์ & โปรโมชัน', href: '/cms', icon: Images, permission: 'cms' },
  { label: 'ระบบ EXP', href: '/exp', icon: Sparkles, permission: 'exp' },
  { label: 'สมุดตั๋วโหวต', href: '/tickets', icon: Ticket, permission: 'exp' },
]

export function Sidebar({ permissions, isOwner, onNavigate }: { permissions: string[]; isOwner: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const usersActive = pathname.startsWith('/users')
  const [usersExpanded, setUsersExpanded] = useState(false)
  const usersOpen = usersActive || usersExpanded
  const activeTab = searchParams.get('tab') ?? 'users'

  return <nav className={styles.sidebar} aria-label="เมนูหลัก">
    <div className={styles.caption}>เมนูหลัก</div>
    {navItems.filter((item) => isOwner || permissions.includes(item.permission)).map((item) => {
      const Icon = item.icon
      if (item.children) return <div className={`${styles.group} ${usersOpen ? styles.open : ''}`} key={item.label}>
        <button type="button" className={`${styles.item} ${usersActive ? styles.current : ''}`} onClick={() => setUsersExpanded((value) => !value)} aria-expanded={usersOpen}>
          <Icon className={styles.icon} /><span>{item.label}</span><ChevronDown className={styles.chevron} />
        </button>
        {usersOpen && <div className={styles.children}>{item.children.map((child) => <Link key={child.tab} href={child.href} onClick={onNavigate} className={`${styles.child} ${usersActive && activeTab === child.tab ? styles.activeChild : ''}`}>{child.label}</Link>)}</div>}
      </div>
      const active = pathname === item.href || (!!item.href && pathname.startsWith(`${item.href}/`))
      return <Link key={item.label} href={item.href!} onClick={onNavigate} className={`${styles.item} ${active ? styles.active : ''}`}><Icon className={styles.icon} /><span>{item.label}</span></Link>
    })}
  </nav>
}
