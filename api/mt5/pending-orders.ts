import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearerToken, tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { noStore } from '../_lib/http.js'

// GET  -> lista señales pendientes de tu aprobación (token de lectura, igual que /state)
// POST -> aprueba o rechaza una señal puntual (token de acción, separado del de lectura
//         a propósito: leer el estado y autorizar una entrada son privilegios distintos)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  const db = database()

  if (req.method === 'GET') {
    if (!tokenMatches(bearerToken(req.headers.authorization), process.env.TRADINGLAB_READ_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
    // Expira de forma perezosa cualquier señal vencida antes de listar, sin depender de un cron aparte.
    await db.from('mt5_bot_pending_orders').update({ status:'expired' }).eq('status','pending').lt('expires_at', new Date().toISOString())
    const result = await db.from('mt5_bot_pending_orders').select('*').order('created_at',{ ascending:false }).limit(50)
    if (result.error) return res.status(500).json({ ok:false, error:'Pending orders lookup failed' })
    return res.status(200).json({ ok:true, orders: result.data })
  }

  if (req.method === 'POST') {
    if (!tokenMatches(bearerToken(req.headers.authorization), process.env.TRADINGLAB_ACTION_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
    let value: unknown
    try { value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body } catch { return res.status(400).json({ ok:false, error:'Invalid JSON' }) }
    if (!value || typeof value !== 'object') return res.status(400).json({ ok:false, error:'Invalid request' })
    const v = value as Record<string, unknown>
    const id = Number(v.id)
    const action = v.action
    if (!Number.isInteger(id) || id <= 0 || (action !== 'approve' && action !== 'reject')) return res.status(400).json({ ok:false, error:'Invalid request' })
    const status = action === 'approve' ? 'approved' : 'rejected'
    // Solo decide sobre una señal que sigue 'pending' y no venció; evita reabrir algo ya resuelto o caducado.
    const result = await db.from('mt5_bot_pending_orders')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', id).eq('status','pending').gt('expires_at', new Date().toISOString())
      .select('id').maybeSingle()
    if (result.error) return res.status(500).json({ ok:false, error:'Decision update failed' })
    if (!result.data) return res.status(409).json({ ok:false, error:'La señal ya no está disponible (expiró o ya fue decidida)' })
    return res.status(200).json({ ok:true, id, status })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ ok:false, error:'Method not allowed' })
}
