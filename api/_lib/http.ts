import type { VercelRequest, VercelResponse } from '@vercel/node'

export function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

export function method(req: VercelRequest, res: VercelResponse, allowed: string) {
  if (req.method === allowed) return true
  res.setHeader('Allow', allowed)
  res.status(405).json({ ok: false, error: 'Method not allowed' })
  return false
}
