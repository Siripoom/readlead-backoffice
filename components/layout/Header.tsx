'use client'

import { Bell, BookOpen, ChevronDown, LogOut, Menu } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import styles from './Header.module.css'

interface HeaderProps { onToggleSidebar: () => void; admin: { name: string; role: string } }

export function Header({ onToggleSidebar, admin }: HeaderProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(event: MouseEvent) { if (!menuRef.current?.contains(event.target as Node)) setOpen(false) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [])
  const initials = admin.name.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase() || 'AD'

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login'); router.refresh()
  }

  return <header className={styles.header}>
    <div className={styles.brandSide}><button type="button" className={styles.mobileMenu} aria-label="เปิดเมนู" onClick={onToggleSidebar}><Menu /></button><Link href="/dashboard" className={styles.brand}><BookOpen /><span>ReadLead</span><i>แอดมิน</i></Link></div>
    <div className={styles.right}>
      <button type="button" className={styles.bell} aria-label="การแจ้งเตือน"><Bell /></button>
      <div className={styles.profileWrap} ref={menuRef}>
        <button type="button" className={styles.profile} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu"><span className={styles.avatar}>{initials}</span><span className={styles.name}><b>{admin.name}</b><small>{admin.role}</small></span><ChevronDown className={`${styles.profileChevron} ${open ? styles.rotated : ''}`} /></button>
        {open && <div className={styles.dropdown} role="menu"><div className={styles.menuHead}>เข้าสู่ระบบในชื่อ<br /><b>{admin.name}</b><small>{admin.role}</small></div><div className={styles.separator} /><button type="button" role="menuitem" onClick={logout}><LogOut />ออกจากระบบ</button></div>}
      </div>
    </div>
  </header>
}
