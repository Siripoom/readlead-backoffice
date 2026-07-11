'use client'

import { BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './Login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const result = await response.json().catch(() => ({ error: 'เซิร์ฟเวอร์ไม่ส่งคำตอบที่ถูกต้อง' }))
      if (!response.ok) return setError(result.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
      router.push('/dashboard'); router.refresh()
    } catch { setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์') }
    finally { setLoading(false) }
  }

  return <main className={styles.login}><section className={styles.card}>
    <div className={styles.logo}><BookOpen /><span>ReadLead</span></div><p className={styles.sub}>Backoffice Administration</p><p className={styles.note}>เข้าสู่ระบบสำหรับผู้ดูแลระบบ<br />เพื่อจัดการข้อมูลและการทำงานของเว็บไซต์</p>
    <form onSubmit={handleSubmit}>
      <label>อีเมล<input type="email" autoComplete="email" placeholder="admin@readlead.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>รหัสผ่าน<input type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <button type="submit" disabled={loading}>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
    </form>
  </section></main>
}
