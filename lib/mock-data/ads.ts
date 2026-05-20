export type AdType = 'banner' | 'interstitial' | 'in-content'

export interface AdPlacement {
  id: string
  name: string
  location: string
  type: AdType
  active: boolean
}

export interface AdItem {
  id: string
  name: string
  advertiser: string
  type: AdType
  validFrom: string
  validTo: string
  active: boolean
  imageUrl?: string
}

