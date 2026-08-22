import 'server-only'
import {
  authenticateSocialMember,
  SocialMemberAuthError,
  verifySocialIdToken,
} from '@/lib/social-member-auth'
import type { VerifiedSocialIdentity } from '@/lib/social-member-auth-resolver'

export { SocialMemberAuthError as FacebookMemberAuthError }

export function verifyFacebookIdToken(idToken: string, allowLinkedProvider = false) {
  return verifySocialIdToken('facebook', idToken, { allowLinkedProvider })
}

export function authenticateFacebookMember(identity: VerifiedSocialIdentity, currentUserId: string | null) {
  return authenticateSocialMember('facebook', identity, currentUserId)
}
