import 'server-only'

import { request as httpsRequest } from 'node:https'

// Apple Pay on the web requires the merchant (us) to validate the session
// with Apple directly — unlike Google Pay, Omise does not do this on our
// behalf (docs.omise.co/applepay). The browser hands us a validationURL and
// we must POST to it over mutual TLS using the Apple Merchant Identity
// Certificate, then hand the resulting merchant session back to the browser.

const VALIDATION_TIMEOUT_MS = 10_000

export class ApplePayError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApplePayError'
  }
}

// Certificates are stored in dotenv with escaped newlines (same convention
// as FIREBASE_PRIVATE_KEY) so they survive being a single-line env value.
function pem(value: string | undefined) {
  return value ? value.replace(/\\n/g, '\n') : undefined
}

// The validationURL is attacker-controllable (it arrives from the browser),
// and we are about to make a request to it carrying our client certificate.
// Pinning it to Apple is what stops this endpoint from being an SSRF that
// also hands merchant sessions to an arbitrary host.
function assertAppleValidationUrl(rawUrl: unknown) {
  const text = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!text) throw new ApplePayError(400, 'ไม่พบ validationURL')
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new ApplePayError(400, 'validationURL ไม่ถูกต้อง')
  }
  if (url.protocol !== 'https:') throw new ApplePayError(400, 'validationURL ไม่ถูกต้อง')
  if (url.hostname !== 'apple.com' && !url.hostname.endsWith('.apple.com')) {
    throw new ApplePayError(400, 'validationURL ไม่ถูกต้อง')
  }
  return url
}

export async function createApplePayMerchantSession(validationUrl: unknown): Promise<unknown> {
  const merchantIdentifier = process.env.APPLE_PAY_MERCHANT_ID
  const cert = pem(process.env.APPLE_PAY_MERCHANT_CERT)
  const key = pem(process.env.APPLE_PAY_MERCHANT_KEY)
  const webAppUrl = process.env.WEB_APP_URL
  if (!merchantIdentifier || !cert || !key || !webAppUrl) {
    throw new ApplePayError(503, 'ระบบ Apple Pay ยังไม่พร้อมใช้งาน')
  }

  const url = assertAppleValidationUrl(validationUrl)
  // initiativeContext must be the domain the user is actually on, and must
  // match a domain registered with Apple via Omise — Apple rejects the
  // validation outright when it doesn't.
  const payload = JSON.stringify({
    merchantIdentifier,
    displayName: process.env.APPLE_PAY_DISPLAY_NAME || 'ReadLead',
    initiative: 'web',
    initiativeContext: new URL(webAppUrl).hostname,
  })

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        cert,
        key,
        timeout: VALIDATION_TIMEOUT_MS,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          if (!response.statusCode || response.statusCode >= 400) {
            console.error('Apple Pay merchant validation rejected', { status: response.statusCode, body })
            reject(new ApplePayError(502, 'ยืนยันร้านค้ากับ Apple ไม่สำเร็จ'))
            return
          }
          try {
            resolve(JSON.parse(body))
          } catch {
            reject(new ApplePayError(502, 'ยืนยันร้านค้ากับ Apple ไม่สำเร็จ'))
          }
        })
      },
    )
    req.on('timeout', () => req.destroy(new ApplePayError(504, 'ยืนยันร้านค้ากับ Apple ใช้เวลานานเกินไป')))
    req.on('error', (error) => {
      console.error('Apple Pay merchant validation failed', error)
      reject(error instanceof ApplePayError ? error : new ApplePayError(502, 'ยืนยันร้านค้ากับ Apple ไม่สำเร็จ'))
    })
    req.write(payload)
    req.end()
  })
}
