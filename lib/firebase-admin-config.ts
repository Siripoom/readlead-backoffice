export type FirebaseAdminConfigurationIssue =
  | 'missing-value'
  | 'invalid-project-id'
  | 'invalid-client-email'
  | 'project-mismatch'
  | 'invalid-private-key'

export class FirebaseAdminConfigurationError extends Error {
  constructor(public readonly issue: FirebaseAdminConfigurationIssue) {
    super('Firebase Admin SDK is not configured correctly')
    this.name = 'FirebaseAdminConfigurationError'
  }
}

export function validateFirebaseAdminConfig(input: {
  projectId?: string
  clientEmail?: string
  privateKey?: string
}) {
  const projectId = input.projectId?.trim()
  const clientEmail = input.clientEmail?.trim()
  const privateKey = input.privateKey?.replace(/\\n/g, '\n').trim()

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAdminConfigurationError('missing-value')
  }
  if (projectId.startsWith('1:') || !/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) {
    throw new FirebaseAdminConfigurationError('invalid-project-id')
  }

  const serviceAccountProject = clientEmail.match(/@([a-z][a-z0-9-]{4,29})\.iam\.gserviceaccount\.com$/)?.[1]
  if (!serviceAccountProject) {
    throw new FirebaseAdminConfigurationError('invalid-client-email')
  }
  if (serviceAccountProject !== projectId) {
    throw new FirebaseAdminConfigurationError('project-mismatch')
  }
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.endsWith('-----END PRIVATE KEY-----')) {
    throw new FirebaseAdminConfigurationError('invalid-private-key')
  }

  return { projectId, clientEmail, privateKey }
}
