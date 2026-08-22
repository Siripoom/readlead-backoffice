import 'server-only'
import { FirebaseAdminConfigurationError, getFirebaseAdminAuth } from '@/lib/firebase-admin'
import { getPrisma } from '@/lib/prisma'
import {
  resolveSocialMember,
  socialIdentityFromClaims,
  SocialMemberAuthError,
  type SocialAuthProvider,
  type SocialMemberRepository,
  type VerifiedSocialIdentity,
} from '@/lib/social-member-auth-resolver'

export { SocialMemberAuthError } from '@/lib/social-member-auth-resolver'

export async function verifySocialIdToken(
  provider: SocialAuthProvider,
  idToken: string,
  options: { allowLinkedProvider?: boolean } = {},
): Promise<VerifiedSocialIdentity> {
  try {
    const adminAuth = getFirebaseAdminAuth()
    const decoded = await adminAuth.verifyIdToken(idToken, true)
    const firebaseProviderId = {
      google: 'google.com',
      facebook: 'facebook.com',
      apple: 'apple.com',
    }[provider]
    const signedInWithProvider = decoded.firebase.sign_in_provider === firebaseProviderId

    if (provider === 'facebook' || provider === 'apple' || (options.allowLinkedProvider && !signedInWithProvider)) {
      const firebaseUser = await adminAuth.getUser(decoded.uid)
      const linkedProvider = firebaseUser.providerData.find(({ providerId }) => providerId === firebaseProviderId)
      return socialIdentityFromClaims(provider, {
        uid: decoded.uid,
        email: linkedProvider?.email,
        email_verified: provider === 'facebook'
          ? decoded.email_verified
          : signedInWithProvider
            ? decoded.email_verified
            : true,
        name: linkedProvider?.displayName,
        firebase: decoded.firebase,
      }, options)
    }

    return socialIdentityFromClaims(provider, decoded, options)
  } catch (error) {
    if (error instanceof FirebaseAdminConfigurationError || error instanceof SocialMemberAuthError) throw error
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'unknown'
    console.error('Firebase ID token verification failed', { provider, code })
    const label = provider === 'google' ? 'Google' : provider === 'facebook' ? 'Facebook' : 'Apple'
    throw new SocialMemberAuthError(
      401,
      `การยืนยันตัวตนกับ ${label} หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่`,
      'invalid-token',
    )
  }
}

type MemberDatabase = Pick<ReturnType<typeof getPrisma>, 'user' | 'memberAuthIdentity'>

const memberInclude = {
  authIdentities: { select: { provider: true } },
} as const

class PrismaSocialMemberRepository implements SocialMemberRepository {
  constructor(private readonly database: MemberDatabase) {}

  async findByProviderUid(provider: SocialAuthProvider, providerUid: string) {
    const identity = await this.database.memberAuthIdentity.findUnique({
      where: { provider_providerUid: { provider, providerUid } },
      include: { user: { include: memberInclude } },
    })
    return identity?.user ?? null
  }

  findByEmail(email: string) {
    return this.database.user.findUnique({ where: { email }, include: memberInclude })
  }

  findById(userId: string) {
    return this.database.user.findUnique({ where: { id: userId }, include: memberInclude })
  }

  findIdentityForUser(userId: string, provider: SocialAuthProvider) {
    return this.database.memberAuthIdentity.findUnique({
      where: { userId_provider: { userId, provider } },
      select: { providerUid: true },
    })
  }

  updateMemberName(userId: string, name: string) {
    return this.database.user.update({
      where: { id: userId },
      data: { name },
      include: memberInclude,
    })
  }

  async linkIdentity(
    userId: string,
    provider: SocialAuthProvider,
    identity: VerifiedSocialIdentity,
    options: { applePrivateRelayConsentAt?: Date } = {},
  ) {
    await this.database.memberAuthIdentity.create({
      data: {
        userId,
        provider,
        providerUid: identity.providerUid,
        email: identity.email,
        applePrivateRelayConsentAt: options.applePrivateRelayConsentAt,
      },
    })
    const user = await this.findById(userId)
    if (!user) throw new SocialMemberAuthError(500, 'ไม่พบบัญชีหลังเชื่อมต่อโซเชียล', 'member-not-found')
    return user
  }

  createMember(provider: SocialAuthProvider, identity: VerifiedSocialIdentity) {
    return this.database.user.create({
      data: {
        name: identity.name,
        email: identity.email,
        userType: 'user',
        authIdentities: {
          create: {
            provider,
            providerUid: identity.providerUid,
            email: identity.email,
          },
        },
      },
      include: memberInclude,
    })
  }
}

export async function authenticateSocialMember(
  provider: SocialAuthProvider,
  identity: VerifiedSocialIdentity,
  currentUserId: string | null,
  options: { privateRelayConsent?: boolean } = {},
) {
  return getPrisma().$transaction(async (transaction) => (
    resolveSocialMember(provider, identity, currentUserId, new PrismaSocialMemberRepository(transaction), options)
  ))
}
