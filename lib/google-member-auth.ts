import 'server-only'
import {
  authenticateSocialMember,
  SocialMemberAuthError,
  verifySocialIdToken,
} from '@/lib/social-member-auth'
import type { VerifiedSocialIdentity } from '@/lib/social-member-auth-resolver'

export { SocialMemberAuthError as GoogleMemberAuthError }

export function verifyGoogleIdToken(idToken: string, allowLinkedProvider = false) {
  return verifySocialIdToken('google', idToken, { allowLinkedProvider })
}

export function authenticateGoogleMember(identity: VerifiedSocialIdentity, currentUserId: string | null) {
  return authenticateSocialMember('google', identity, currentUserId)
}
