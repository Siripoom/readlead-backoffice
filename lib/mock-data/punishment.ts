export interface PunishmentLevel {
  id: string
  level: number
  name: string
  threshold: number
  duration: number
}

export interface PunishmentRecord {
  id: string
  userId: string
  levelName: string
  date: string
  note?: string
}
