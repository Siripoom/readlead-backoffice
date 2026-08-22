import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FirebaseAdminConfigurationError,
  validateFirebaseAdminConfig,
} from '../lib/firebase-admin-config'
import {
  resolveSocialMember,
  socialIdentityFromClaims,
  SocialMemberAuthError,
  type SocialAuthProvider,
  type SocialMemberRecord,
  type SocialMemberRepository,
  type VerifiedSocialIdentity,
} from '../lib/social-member-auth-resolver'

const identity: VerifiedSocialIdentity = {
  providerUid: 'firebase-uid-1',
  email: 'reader@example.com',
  name: 'Reader',
}

function member(id: string, overrides: Partial<SocialMemberRecord> = {}): SocialMemberRecord {
  return {
    id,
    name: 'Reader',
    email: 'reader@example.com',
    status: 'active',
    userType: 'user',
    authIdentities: [],
    ...overrides,
  }
}

class FakeRepository implements SocialMemberRepository {
  readonly users = new Map<string, SocialMemberRecord>()
  readonly providerOwners = new Map<string, string>()
  readonly userProviders = new Map<string, string>()
  readonly appleRelayConsents = new Map<string, Date>()

  private providerKey(provider: SocialAuthProvider, value: string) {
    return `${provider}:${value}`
  }

  addUser(user: SocialMemberRecord) {
    this.users.set(user.id, user)
    return user
  }

  addIdentity(userId: string, provider: SocialAuthProvider, providerUid: string) {
    this.providerOwners.set(this.providerKey(provider, providerUid), userId)
    this.userProviders.set(this.providerKey(provider, userId), providerUid)
    const user = this.users.get(userId)
    if (user && !user.authIdentities.some((item) => item.provider === provider)) {
      user.authIdentities.push({ provider })
    }
  }

  async findByProviderUid(provider: SocialAuthProvider, providerUid: string) {
    const userId = this.providerOwners.get(this.providerKey(provider, providerUid))
    return userId ? this.users.get(userId) ?? null : null
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null
  }

  async findById(userId: string) {
    return this.users.get(userId) ?? null
  }

  async findIdentityForUser(userId: string, provider: SocialAuthProvider) {
    const providerUid = this.userProviders.get(this.providerKey(provider, userId))
    return providerUid ? { providerUid } : null
  }

  async updateMemberName(userId: string, name: string) {
    const user = this.users.get(userId)!
    user.name = name
    return user
  }

  async linkIdentity(
    userId: string,
    provider: SocialAuthProvider,
    socialIdentity: VerifiedSocialIdentity,
    options: { applePrivateRelayConsentAt?: Date } = {},
  ) {
    this.addIdentity(userId, provider, socialIdentity.providerUid)
    if (options.applePrivateRelayConsentAt) {
      this.appleRelayConsents.set(userId, options.applePrivateRelayConsentAt)
    }
    return this.users.get(userId)!
  }

  async createMember(provider: SocialAuthProvider, socialIdentity: VerifiedSocialIdentity) {
    const user = this.addUser(member('new-user', { name: socialIdentity.name, email: socialIdentity.email }))
    this.addIdentity(user.id, provider, socialIdentity.providerUid)
    return user
  }
}

async function expectAuthError(promise: Promise<unknown>, code: string, status: number) {
  await assert.rejects(promise, (error: unknown) => (
    error instanceof SocialMemberAuthError && error.code === code && error.status === status
  ))
}

for (const provider of ['google', 'facebook', 'apple'] as const) {
  test(`creates a new member and ${provider} identity on first sign-in`, async () => {
    const repository = new FakeRepository()
    const user = await resolveSocialMember(provider, identity, null, repository)
    assert.equal(user.id, 'new-user')
    assert.deepEqual(user.authIdentities, [{ provider }])
  })

  if (provider !== 'facebook') {
    test(`links ${provider} to an existing member with the same verified email`, async () => {
      const repository = new FakeRepository()
      repository.addUser(member('existing-user'))
      const user = await resolveSocialMember(provider, identity, null, repository)
      assert.equal(user.id, 'existing-user')
    })
  } else {
    test('does not auto-link Facebook to an existing member by unverified email', async () => {
      const repository = new FakeRepository()
      repository.addUser(member('existing-user'))
      await expectAuthError(
        resolveSocialMember(provider, identity, null, repository),
        'existing-account-login-required',
        409,
      )
      assert.equal(repository.userProviders.size, 0)
    })
  }

  test(`${provider} profile connection is idempotent`, async () => {
    const repository = new FakeRepository()
    repository.addUser(member('linked-user'))
    repository.addIdentity('linked-user', provider, identity.providerUid)
    const user = await resolveSocialMember(provider, identity, 'linked-user', repository)
    assert.equal(user.id, 'linked-user')
  })

  test(`rejects ${provider} profile connection when emails differ`, async () => {
    const repository = new FakeRepository()
    repository.addUser(member('current-user'))
    await expectAuthError(
      resolveSocialMember(provider, { ...identity, email: 'other@example.com' }, 'current-user', repository),
      'email-mismatch',
      409,
    )
  })

  test(`rejects a ${provider} identity linked to another member`, async () => {
    const repository = new FakeRepository()
    repository.addUser(member('current-user'))
    repository.addUser(member('other-user'))
    repository.addIdentity('other-user', provider, identity.providerUid)
    await expectAuthError(
      resolveSocialMember(provider, identity, 'current-user', repository),
      'identity-conflict',
      409,
    )
  })

  test(`rejects an email linked to a different ${provider} identity`, async () => {
    const repository = new FakeRepository()
    repository.addUser(member('existing-user'))
    repository.addIdentity('existing-user', provider, `different-${provider}-uid`)
    await expectAuthError(
      resolveSocialMember(provider, identity, null, repository),
      provider === 'facebook' ? 'existing-account-login-required' : 'provider-conflict',
      409,
    )
  })
}

test('one member can have Google, Facebook, and Apple identities', async () => {
  const repository = new FakeRepository()
  repository.addUser(member('existing-user'))
  repository.addIdentity('existing-user', 'google', 'google-uid')
  await resolveSocialMember('facebook', identity, 'existing-user', repository)
  const user = await resolveSocialMember('apple', { ...identity, providerUid: 'apple-uid' }, 'existing-user', repository)
  assert.deepEqual(user.authIdentities, [
    { provider: 'google' },
    { provider: 'facebook' },
    { provider: 'apple' },
  ])
})

test('connects Facebook to the current ReadLead member when emails match', async () => {
  const repository = new FakeRepository()
  repository.addUser(member('current-user'))
  const user = await resolveSocialMember('facebook', identity, 'current-user', repository)
  assert.equal(user.id, 'current-user')
  assert.deepEqual(user.authIdentities, [{ provider: 'facebook' }])
})

test('requires consent to connect an Apple private relay email to a different ReadLead email', async () => {
  const repository = new FakeRepository()
  repository.addUser(member('current-user'))
  const relayIdentity = {
    ...identity,
    providerUid: 'apple-relay-uid',
    email: 'private-token@privaterelay.appleid.com',
  }

  await expectAuthError(
    resolveSocialMember('apple', relayIdentity, 'current-user', repository),
    'apple-private-relay-consent-required',
    409,
  )

  const user = await resolveSocialMember(
    'apple',
    relayIdentity,
    'current-user',
    repository,
    { privateRelayConsent: true },
  )
  assert.equal(user.id, 'current-user')
  assert.ok(repository.appleRelayConsents.get('current-user') instanceof Date)
})

test('does not let Apple consent bypass a non-relay email mismatch', async () => {
  const repository = new FakeRepository()
  repository.addUser(member('current-user'))
  await expectAuthError(
    resolveSocialMember(
      'apple',
      { ...identity, email: 'different@example.com' },
      'current-user',
      repository,
      { privateRelayConsent: true },
    ),
    'email-mismatch',
    409,
  )
})

test('rejects inactive and banned members for social sign-in', async () => {
  for (const status of ['inactive', 'banned'] as const) {
    const repository = new FakeRepository()
    repository.addUser(member(`${status}-user`, { status }))
    await expectAuthError(resolveSocialMember('facebook', identity, null, repository), 'member-disabled', 403)
  }
})

test('uses given name, full-name first word, then email local part', () => {
  assert.equal(socialIdentityFromClaims('facebook', {
    uid: 'facebook-uid-1',
    email: ' Reader@Example.COM ',
    email_verified: true,
    given_name: ' First ',
    name: ' Reader Name ',
    firebase: { sign_in_provider: 'facebook.com' },
  }).name, 'First')
  assert.equal(socialIdentityFromClaims('facebook', {
    uid: 'facebook-uid-2',
    email: 'reader@example.com',
    name: 'Reader Example',
    firebase: { sign_in_provider: 'facebook.com' },
  }).name, 'Reader')
  assert.equal(socialIdentityFromClaims('facebook', {
    uid: 'facebook-uid-3',
    email: 'fallback@example.com',
    firebase: { sign_in_provider: 'facebook.com' },
  }).name, 'fallback')
})

test('uses Apple first name and falls back to สมาชิก instead of a relay address', () => {
  assert.equal(socialIdentityFromClaims('apple', {
    uid: 'apple-uid-1',
    email: 'private-token@privaterelay.appleid.com',
    email_verified: true,
    name: 'Arisa Reader',
    firebase: { sign_in_provider: 'apple.com' },
  }).name, 'Arisa')
  assert.equal(socialIdentityFromClaims('apple', {
    uid: 'apple-uid-2',
    email: 'private-token@privaterelay.appleid.com',
    email_verified: true,
    firebase: { sign_in_provider: 'apple.com' },
  }).name, 'สมาชิก')
})

test('replaces placeholder names but preserves a chosen member name', async () => {
  const repository = new FakeRepository()
  repository.addUser(member('placeholder-user', { name: 'test' }))
  repository.addIdentity('placeholder-user', 'facebook', identity.providerUid)
  const placeholder = await resolveSocialMember('facebook', identity, null, repository)
  assert.equal(placeholder.name, 'Reader')

  repository.addUser(member('custom-user', { name: 'หนอนหนังสือ' }))
  repository.addIdentity('custom-user', 'facebook', 'custom-uid')
  const custom = await resolveSocialMember('facebook', { ...identity, providerUid: 'custom-uid' }, null, repository)
  assert.equal(custom.name, 'หนอนหนังสือ')
})

test('requires verified Google email and accepts unverified Facebook email', () => {
  assert.throws(() => socialIdentityFromClaims('google', {
    uid: 'google-uid',
    email: 'reader@example.com',
    email_verified: false,
    firebase: { sign_in_provider: 'google.com' },
  }), (error: unknown) => error instanceof SocialMemberAuthError && error.code === 'invalid-google-token')

  assert.equal(socialIdentityFromClaims('facebook', {
    uid: 'facebook-uid',
    email: 'reader@example.com',
    email_verified: false,
    firebase: { sign_in_provider: 'facebook.com' },
  }).email, 'reader@example.com')
})

test('requires a verified email and Apple provider for Apple sign-in', () => {
  for (const claims of [
    { uid: 'apple-uid', email: 'reader@example.com', email_verified: false, firebase: { sign_in_provider: 'apple.com' } },
    { uid: 'apple-uid', email: 'reader@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } },
    { uid: 'apple-uid', email_verified: true, firebase: { sign_in_provider: 'apple.com' } },
  ]) {
    assert.throws(() => socialIdentityFromClaims('apple', claims), (error: unknown) => (
      error instanceof SocialMemberAuthError && error.code === 'invalid-apple-token'
    ))
  }
})

test('rejects Facebook without email and with the wrong provider', () => {
  for (const claims of [
    { uid: 'facebook-uid', firebase: { sign_in_provider: 'facebook.com' } },
    { uid: 'facebook-uid', email: 'reader@example.com', email_verified: true, firebase: { sign_in_provider: 'password' } },
  ]) {
    assert.throws(() => socialIdentityFromClaims('facebook', claims), (error: unknown) => (
      error instanceof SocialMemberAuthError && error.code === 'invalid-facebook-token'
    ))
  }
})

test('accepts a linked Facebook identity only for an authenticated profile connection', () => {
  const claims = {
    uid: 'firebase-uid',
    email: 'reader@example.com',
    email_verified: true,
    firebase: {
      sign_in_provider: 'google.com',
      identities: { 'facebook.com': ['facebook-provider-uid'] },
    },
  }
  assert.throws(() => socialIdentityFromClaims('facebook', claims), SocialMemberAuthError)
  assert.equal(
    socialIdentityFromClaims('facebook', claims, { allowLinkedProvider: true }).providerUid,
    'firebase-uid',
  )
})

test('accepts matching Firebase Admin project credentials and normalizes escaped newlines', () => {
  const config = validateFirebaseAdminConfig({
    projectId: 'readlead-272f7',
    clientEmail: 'firebase-adminsdk@readlead-272f7.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\\nprivate-key-data\\n-----END PRIVATE KEY-----',
  })
  assert.equal(config.projectId, 'readlead-272f7')
  assert.match(config.privateKey, /\nprivate-key-data\n/)
})

test('rejects invalid or mismatched Firebase Admin project credentials', () => {
  for (const config of [
    {
      projectId: '1:150197393770:web:a7a0b165e811074d8aed13',
      clientEmail: 'firebase-adminsdk@readlead-272f7.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\\nprivate-key-data\\n-----END PRIVATE KEY-----',
    },
    {
      projectId: 'readlead-272f7',
      clientEmail: 'firebase-adminsdk@different-project.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\\nprivate-key-data\\n-----END PRIVATE KEY-----',
    },
  ]) {
    assert.throws(() => validateFirebaseAdminConfig(config), FirebaseAdminConfigurationError)
  }
})
