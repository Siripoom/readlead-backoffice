export interface Promotion {
  id: string
  name: string
  discount: number
  validFrom: string
  validTo: string
  active: boolean
}

export interface PricingItem {
  id: string
  category: string
  pricePerEpisode: number
  currency: string
}

export interface VipLevel {
  id: string
  level: number
  name: string
  minSpend: number
  badge: string
  color: string
}

export interface ExpTitle {
  id: string
  minExp: number
  title: string
  badge: string
  color: string
}

