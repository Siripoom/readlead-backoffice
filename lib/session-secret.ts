const DEVELOPMENT_SESSION_SECRET = 'readlead-local-development-secret'

function resolveSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be configured in production')
  }
  return DEVELOPMENT_SESSION_SECRET
}

export function getSessionSecret() {
  return resolveSessionSecret()
}
