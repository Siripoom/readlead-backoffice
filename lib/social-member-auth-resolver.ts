import type { MemberAuthProvider, UserStatus, UserType } from '@/lib/generated/prisma/enums'

export type SocialAuthProvider = Extract<MemberAuthProvider, 'google' | 'facebook' | 'apple'>

export interface VerifiedSocialIdentity {
  providerUid: string
  email: string
  name: string
}

export interface SocialTokenClaims {
  uid?: string
  email?: string
  email_verified?: boolean
  given_name?: string
  name?: string
  firebase?: {
    sign_in_provider?: string
    identities?: Record<string, unknown>
  }
}

export interface SocialMemberRecord {
  id: string
  name: string
  email: string
  status: UserStatus
  userType: UserType
  authIdentities: Array<{ provider: MemberAuthProvider }>
}

export interface SocialMemberRepository {
  findByProviderUid(provider: SocialAuthProvider, providerUid: string): Promise<SocialMemberRecord | null>
  findByEmail(email: string): Promise<SocialMemberRecord | null>
  findById(userId: string): Promise<SocialMemberRecord | null>
  findIdentityForUser(userId: string, provider: SocialAuthProvider): Promise<{ providerUid: string } | null>
  updateMemberName(userId: string, name: string): Promise<SocialMemberRecord>
  linkIdentity(
    userId: string,
    provider: SocialAuthProvider,
    identity: VerifiedSocialIdentity,
    options?: { applePrivateRelayConsentAt?: Date },
  ): Promise<SocialMemberRecord>
  createMember(provider: SocialAuthProvider, identity: VerifiedSocialIdentity): Promise<SocialMemberRecord>
}

const PROVIDERS = {
  google: { label: 'Google', firebaseId: 'google.com', requireVerifiedEmailClaim: true },
  facebook: { label: 'Facebook', firebaseId: 'facebook.com', requireVerifiedEmailClaim: false },
  apple: { label: 'Apple', firebaseId: 'apple.com', requireVerifiedEmailClaim: true },
} as const satisfies Record<SocialAuthProvider, {
  label: string
  firebaseId: string
  requireVerifiedEmailClaim: boolean
}>

export class SocialMemberAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'SocialMemberAuthError'
  }
}

function hasLinkedProvider(token: SocialTokenClaims, firebaseProviderId: string) {
  const identity = token.firebase?.identities?.[firebaseProviderId]
  return Array.isArray(identity) ? identity.length > 0 : Boolean(identity)
}

export function socialIdentityFromClaims(
  provider: SocialAuthProvider,
  token: SocialTokenClaims,
  options: { allowLinkedProvider?: boolean } = {},
): VerifiedSocialIdentity {
  const config = PROVIDERS[provider]
  const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : ''
  const signedInWithProvider = token.firebase?.sign_in_provider === config.firebaseId
  const linkedProvider = options.allowLinkedProvider && hasLinkedProvider(token, config.firebaseId)
  const invalidEmailVerification = config.requireVerifiedEmailClaim && token.email_verified !== true

  if (!token.uid || !email || invalidEmailVerification || (!signedInWithProvider && !linkedProvider)) {
    const message = provider === 'facebook' && !email
      ? 'Facebook ไม่ได้ส่งอีเมล กรุณาเพิ่มอีเมลใน Facebook และอนุญาตสิทธิ์อีเมลแล้วลองใหม่'
      : `ข้อมูลยืนยันตัวตนจาก ${config.label} ไม่ถูกต้อง`
    throw new SocialMemberAuthError(401, message, `invalid-${provider}-token`)
  }

  const givenName = typeof token.given_name === 'string' ? token.given_name.trim() : ''
  const fullName = typeof token.name === 'string' ? token.name.trim() : ''
  const fallbackName = provider === 'apple' ? 'สมาชิก' : email.split('@')[0] || 'สมาชิก'
  const firstName = givenName || fullName.split(/\s+/)[0] || fallbackName
  return { providerUid: token.uid, email, name: firstName.slice(0, 100) }
}

export function isPlaceholderMemberName(name: string) {
  const normalized = name.trim().toLowerCase()
  return !normalized || normalized === 'test'
}

function assertUsableMember(user: SocialMemberRecord) {
  if (user.userType !== 'user' && user.userType !== 'creator') {
    throw new SocialMemberAuthError(409, 'อีเมลนี้ไม่สามารถใช้เข้าสู่ระบบสมาชิกได้', 'not-a-member')
  }
  if (user.status !== 'active') {
    throw new SocialMemberAuthError(403, 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 'member-disabled')
  }
}

function syncPlaceholderName(
  user: SocialMemberRecord,
  identity: VerifiedSocialIdentity,
  repository: SocialMemberRepository,
) {
  return isPlaceholderMemberName(user.name)
    ? repository.updateMemberName(user.id, identity.name)
    : Promise.resolve(user)
}

export async function resolveSocialMember(
  provider: SocialAuthProvider,
  identity: VerifiedSocialIdentity,
  currentUserId: string | null,
  repository: SocialMemberRepository,
  options: { privateRelayConsent?: boolean } = {},
): Promise<SocialMemberRecord> {
  const label = PROVIDERS[provider].label

  if (currentUserId) {
    const currentUser = await repository.findById(currentUserId)
    if (!currentUser) {
      throw new SocialMemberAuthError(401, 'เซสชันเข้าสู่ระบบไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่', 'invalid-session')
    }
    assertUsableMember(currentUser)

    const emailsMatch = currentUser.email.toLowerCase() === identity.email
    const isApplePrivateRelay = provider === 'apple' && identity.email.endsWith('@privaterelay.appleid.com')
    if (!emailsMatch && !isApplePrivateRelay) {
      throw new SocialMemberAuthError(409, `อีเมล ${label} ต้องตรงกับอีเมลของบัญชี ReadLead`, 'email-mismatch')
    }
    if (!emailsMatch && isApplePrivateRelay && options.privateRelayConsent !== true) {
      throw new SocialMemberAuthError(
        409,
        'กรุณายืนยันการเชื่อม Apple Hide My Email กับบัญชี ReadLead นี้',
        'apple-private-relay-consent-required',
      )
    }

    const identityOwner = await repository.findByProviderUid(provider, identity.providerUid)
    if (identityOwner && identityOwner.id !== currentUser.id) {
      throw new SocialMemberAuthError(409, `บัญชี ${label} นี้เชื่อมกับบัญชี ReadLead อื่นแล้ว`, 'identity-conflict')
    }
    if (identityOwner) return syncPlaceholderName(identityOwner, identity, repository)

    const existingIdentity = await repository.findIdentityForUser(currentUser.id, provider)
    if (existingIdentity) {
      throw new SocialMemberAuthError(409, `บัญชี ReadLead นี้เชื่อมกับ ${label} อื่นอยู่แล้ว`, 'provider-conflict')
    }

    const linkedUser = await repository.linkIdentity(currentUser.id, provider, identity, {
      applePrivateRelayConsentAt: !emailsMatch && isApplePrivateRelay ? new Date() : undefined,
    })
    return syncPlaceholderName(linkedUser, identity, repository)
  }

  const identityOwner = await repository.findByProviderUid(provider, identity.providerUid)
  if (identityOwner) {
    assertUsableMember(identityOwner)
    return syncPlaceholderName(identityOwner, identity, repository)
  }

  const emailOwner = await repository.findByEmail(identity.email)
  if (emailOwner) {
    assertUsableMember(emailOwner)
    if (provider === 'facebook') {
      throw new SocialMemberAuthError(
        409,
        'อีเมลนี้มีบัญชี ReadLead อยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม แล้วเชื่อม Facebook จากหน้าโปรไฟล์',
        'existing-account-login-required',
      )
    }
    const existingIdentity = await repository.findIdentityForUser(emailOwner.id, provider)
    if (existingIdentity) {
      throw new SocialMemberAuthError(409, `อีเมลนี้เชื่อมกับบัญชี ${label} อื่นอยู่แล้ว`, 'provider-conflict')
    }
    const linkedUser = await repository.linkIdentity(emailOwner.id, provider, identity)
    return syncPlaceholderName(linkedUser, identity, repository)
  }

  return repository.createMember(provider, identity)
}
