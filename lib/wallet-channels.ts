// Source of truth for which payment channels the member wallet offers, per
// platform. Mirrored (kept in sync by hand) with the `PaymentChannel` shape
// in readlead-web's lib/types.ts — the two repos deploy independently, so
// this contract is duplicated rather than shared, same as WALLET_PACKAGES.

export type ChannelKind = 'slip' | 'gateway' | 'iap'
export type Platform = 'web' | 'ios' | 'android'

interface WalletChannelBase {
  id: string
  label: string
  description: string
  kind: ChannelKind
  enabled: boolean
  platforms: Platform[]
}

interface SlipWalletChannel extends WalletChannelBase {
  kind: 'slip'
}

interface GatewayWalletChannel extends WalletChannelBase {
  kind: 'gateway'
  provider: 'omise'
  instrument: 'card' | 'promptpay' | 'truemoney' | 'shopeepay' | 'apple-pay' | 'google-pay'
}

interface IapWalletChannel extends WalletChannelBase {
  kind: 'iap'
  store: 'google-play' | 'app-store'
}

export type WalletChannel = SlipWalletChannel | GatewayWalletChannel | IapWalletChannel

export const WALLET_CHANNELS: WalletChannel[] = [
  { id: 'proof-upload', label: 'อัปโหลดหลักฐาน', description: 'แนบสลิปเพื่อรออนุมัติ', kind: 'slip', enabled: true, platforms: ['web'] },
  { id: 'promptpay', label: 'พร้อมเพย์', description: 'สแกน QR จ่ายทันที', kind: 'gateway', provider: 'omise', instrument: 'promptpay', enabled: true, platforms: ['web'] },
  { id: 'credit-card', label: 'บัตรเครดิต/เดบิต', description: 'Visa, Mastercard', kind: 'gateway', provider: 'omise', instrument: 'card', enabled: true, platforms: ['web'] },
  { id: 'truemoney', label: 'ทรูมันนี่ วอลเล็ท', description: 'TrueMoney Wallet', kind: 'gateway', provider: 'omise', instrument: 'truemoney', enabled: true, platforms: ['web'] },
  { id: 'shopeepay', label: 'ShopeePay', description: 'จ่ายผ่าน ShopeePay', kind: 'gateway', provider: 'omise', instrument: 'shopeepay', enabled: true, platforms: ['web'] },
  // ⚠️ ENABLED FOR UI REVIEW ONLY — DO NOT SHIP TO PRODUCTION AS-IS.
  // The ApplePaySession flow is implemented (see GatewayChargeDialog.tsx and
  // lib/apple-pay.ts), but a real payment still cannot complete: it needs an
  // Apple Merchant ID, APPLE_PAY_MERCHANT_CERT/_KEY, and the domain
  // association file served over HTTPS. Until those exist, tapping the
  // button in Safari fails at merchant validation with a 503. Set this back
  // to false before deploying unless that setup is finished.
  // Tagged 'ios' alongside 'web': a native app would mint an Omise token
  // from a native PassKit payment the same way omise.js does on web (see
  // lib/member-topup-charges.ts) and hit the same charge endpoint.
  { id: 'apple-pay', label: 'Apple Pay', description: 'จ่ายด้วย Apple Pay', kind: 'gateway', provider: 'omise', instrument: 'apple-pay', enabled: true, platforms: ['web', 'ios'] },
  // Google Pay Web works via a JS-tokenized card (Omise treats it exactly
  // like a card charge), and Google's TEST environment needs no merchant
  // registration — unlike Apple Pay it can be turned on now. Before going
  // live, register a real merchant ID in the Google Pay & Wallet Console and
  // switch the frontend's environment from TEST to PRODUCTION.
  // Tagged 'android' alongside 'web' (no iOS surface): a native Android app
  // mints an Omise token from a native Google Pay payment the same way
  // omise.js does on web, then hits the same charge endpoint — no separate
  // backend work needed, see lib/member-topup-charges.ts.
  { id: 'google-pay', label: 'Google Pay', description: 'จ่ายด้วย Google Pay', kind: 'gateway', provider: 'omise', instrument: 'google-pay', enabled: true, platforms: ['web', 'android'] },
  // Google Play / App Store IAP endpoints are stub-only (no real receipt
  // verification against Google/Apple yet) — irrelevant on web regardless
  // since platforms excludes 'web', kept off until a native app exists.
  { id: 'google-play', label: 'Google Play', description: 'ซื้อผ่าน Google Play', kind: 'iap', store: 'google-play', enabled: false, platforms: ['android'] },
  { id: 'app-store', label: 'App Store', description: 'ซื้อผ่าน App Store', kind: 'iap', store: 'app-store', enabled: false, platforms: ['ios'] },
]

export function getWalletChannel(channelId: string) {
  return WALLET_CHANNELS.find((channel) => channel.id === channelId)
}
