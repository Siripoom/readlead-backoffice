'use client'

import { useState } from 'react'
import { toaster } from '@/lib/toaster'
import styles from './FinanceOverview.module.css'

export type PaymentChannelSetting = {
  id: string
  label: string
  description: string
  kind: 'slip' | 'gateway' | 'iap'
  platform: 'web' | 'ios' | 'android'
  configuredEnabled: boolean
  enabled: boolean
  ready: boolean
  readinessReason: string | null
}

const PLATFORM_LABEL = { web: 'เว็บไซต์', ios: 'iOS', android: 'Android' } as const

export function PaymentChannelsTab({ initialChannels }: { initialChannels: PaymentChannelSetting[] }) {
  const [channels, setChannels] = useState(initialChannels)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  async function toggle(channel: PaymentChannelSetting) {
    if (channel.platform !== 'web' || !channel.ready || busyKey) return
    const key = `${channel.id}:${channel.platform}`
    setBusyKey(key)
    try {
      const response = await fetch('/api/finance/payment-channels', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id, platform: channel.platform, enabled: !channel.configuredEnabled }),
      })
      const body = await response.json() as { channel?: PaymentChannelSetting; error?: string }
      if (!response.ok || !body.channel) throw new Error(body.error || 'บันทึกไม่สำเร็จ')
      setChannels((items) => items.map((item) => item.id === body.channel!.id && item.platform === body.channel!.platform ? body.channel! : item))
      toaster.success({ title: body.channel.configuredEnabled ? 'เปิดช่องทางแล้ว' : 'ปิดช่องทางแล้ว', description: channel.label })
    } catch (error) {
      toaster.error({ title: 'บันทึกช่องทางไม่สำเร็จ', description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setBusyKey(null)
    }
  }

  return <section className={styles.channelPanel}>
    <div className={styles.channelHead}>
      <div><h2>ช่องทางชำระเงิน</h2><p>เปิดหรือปิดช่องทางสำหรับผู้ใช้ ระบบจะบล็อกเฉพาะรายการใหม่ทันที</p></div>
      <span>บันทึก Audit Log ทุกการเปลี่ยนแปลง</span>
    </div>
    {(['web', 'ios', 'android'] as const).map((platform) => {
      const items = channels.filter((channel) => channel.platform === platform)
      if (!items.length) return null
      return <div className={styles.channelGroup} key={platform}>
        <div className={styles.channelGroupTitle}><h3>{PLATFORM_LABEL[platform]}</h3>{platform !== 'web' && <span>เตรียมไว้สำหรับแอปในอนาคต</span>}</div>
        <div className={styles.channelList}>
          {items.map((channel) => {
            const key = `${channel.id}:${channel.platform}`
            const editable = platform === 'web' && channel.ready
            return <article className={styles.channelRow} key={key}>
              <div className={styles.channelInfo}>
                <div><b>{channel.label}</b><span className={channel.ready ? styles.channelReady : styles.channelNotReady}>{channel.ready ? 'พร้อมใช้งาน' : 'ยังไม่พร้อม'}</span></div>
                <p>{channel.description}</p>
                {!channel.ready && channel.readinessReason && <small>{channel.readinessReason}</small>}
              </div>
              <button type="button" role="switch" aria-checked={channel.configuredEnabled && channel.ready} aria-label={`${channel.configuredEnabled ? 'ปิด' : 'เปิด'} ${channel.label}`} className={`${styles.channelSwitch} ${channel.configuredEnabled && channel.ready ? styles.channelSwitchOn : ''}`} disabled={!editable || busyKey === key} onClick={() => void toggle(channel)}><span /></button>
            </article>
          })}
        </div>
      </div>
    })}
  </section>
}
