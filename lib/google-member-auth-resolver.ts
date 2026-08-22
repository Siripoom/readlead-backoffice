import {
  resolveSocialMember,
  socialIdentityFromClaims,
  SocialMemberAuthError,
  type SocialMemberRecord,
  type SocialMemberRepository,
  type SocialTokenClaims,
  type VerifiedSocialIdentity,
} from '@/lib/social-member-auth-resolver'

export { isPlaceholderMemberName } from '@/lib/social-member-auth-resolver'
export { SocialMemberAuthError as GoogleMemberAuthError }
export type VerifiedGoogleIdentity = VerifiedSocialIdentity
export type GoogleTokenClaims = SocialTokenClaims
export type GoogleMemberRecord = SocialMemberRecord
export type GoogleMemberRepository = SocialMemberRepository

export function googleIdentityFromClaims(token: SocialTokenClaims) {
  return socialIdentityFromClaims('google', token)
}

export function resolveGoogleMember(
  identity: VerifiedSocialIdentity,
  currentUserId: string | null,
  repository: SocialMemberRepository,
) {
  return resolveSocialMember('google', identity, currentUserId, repository)
}
