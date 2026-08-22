import 'server-only'
import {
  authenticateSocialMember,
  SocialMemberAuthError,
  verifySocialIdToken,
} from '@/lib/social-member-auth'
import type { VerifiedSocialIdentity } from '@/lib/social-member-auth-resolver'

export { SocialMemberAuthError as AppleMemberAuthError }

export function verifyAppleIdToken(idToken: string, allowLinkedProvider = false) {
  return verifySocialIdToken('apple', idToken, { allowLinkedProvider })
}

export function authenticateAppleMember(
  identity: VerifiedSocialIdentity,
  currentUserId: string | null,
  privateRelayConsent = false,
) {
  return authenticateSocialMember('apple', identity, currentUserId, { privateRelayConsent })
}
