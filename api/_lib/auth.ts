import { createHash, timingSafeEqual } from 'node:crypto'

export function bearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

export function tokenMatches(received: string, expected: string | undefined) {
  if (!received || !expected) return false
  const a = createHash('sha256').update(received).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export function accountKey(server: string, login: string) {
  return createHash('sha256').update(`${server}:${login}`).digest('hex').slice(0, 32)
}

export function maskedLogin(login: string) {
  return login.length <= 4 ? login : `••••${login.slice(-4)}`
}
