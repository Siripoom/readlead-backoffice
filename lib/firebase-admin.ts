import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { validateFirebaseAdminConfig } from '@/lib/firebase-admin-config'

const APP_NAME = 'readlead-member-auth'

export { FirebaseAdminConfigurationError } from '@/lib/firebase-admin-config'

function getFirebaseAdminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME)
  if (existing) return existing

  const { projectId, clientEmail, privateKey } = validateFirebaseAdminConfig({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  })

  return initializeApp({
    projectId,
    credential: cert({ projectId, clientEmail, privateKey }),
  }, APP_NAME)
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp())
}
