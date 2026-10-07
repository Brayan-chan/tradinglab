import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearerToken, tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { noStore } from '../_lib/http.js'

// GET  -> modo actual (token de lectura)
// POST -> cambia el modo: 'manual' espera tu clic en cada señal, 'auto' la aprueba sola al crearse
//         (token de acción: cambiar el modo es tan sensible como aprobar una señal puntual)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  const db = database()

  if (req.method === 'GET') {
    if (!tokenMatches(bearerToken(req.headers.authorization), process.env.TRADINGLAB_READ_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
    const result = await db.from('mt5_bot_settings').select('approval_mode,updated_at').eq('id', true).maybeSingle()
    if (result.error) return res.status(500).json({ ok:false, error:'Settings lookup failed' })
    return res.status(200).json({ ok:true, approvalMode: result.data?.approval_mode ?? 'manual', updatedAt: result.data?.updated_at ?? null })
  }

  if (req.method === 'POST') {
    if (!tokenMatches(bearerToken(req.headers.authorization), process.env.TRADINGLAB_ACTION_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
    let value: unknown
    try { value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body } catch { return res.status(400).json({ ok:false, error:'Invalid JSON' }) }
    const mode = (value as Record<string, unknown> | null)?.approvalMode
    if (mode !== 'manual' && mode !== 'auto') return res.status(400).json({ ok:false, error:'Invalid approvalMode' })
    const result = await db.from('mt5_bot_settings').update({ approval_mode: mode, updated_at: new Date().toISOString() }).eq('id', true).select('approval_mode').maybeSingle()
    if (result.error || !result.data) return res.status(500).json({ ok:false, error:'Settings update failed' })
    return res.status(200).json({ ok:true, approvalMode: result.data.approval_mode })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok:false, error:'Method not allowed' })
}
