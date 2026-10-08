import type { VercelRequest, VercelResponse } from '@vercel/node'
import { accountKey, bearerToken, tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { method, noStore } from '../_lib/http.js'

// El EA consulta esto en cada tick (solo en MODE_DEMO) para saber si hay una señal que tú ya
// aprobaste y sigue vigente. Nunca inventa ni recalcula niveles: devuelve exactamente lo que se
// aprobó. Mismo token que el resto de la ingesta (MT5_INGEST_TOKEN) — es el EA preguntando, no un humano decidiendo.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (!method(req, res, 'GET')) return
  if (!tokenMatches(bearerToken(req.headers.authorization), process.env.MT5_INGEST_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
  const login = typeof req.query.login === 'string' ? req.query.login : ''
  const server = typeof req.query.server === 'string' ? req.query.server : ''
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : ''
  if (!login || !server || !symbol) return res.status(400).json({ ok:false, error:'Missing login, server or symbol' })
  const db = database()
  const key = accountKey(server, login)
  const result = await db.from('mt5_bot_pending_orders').select('id,side,entry_price,stop_loss,take_profit,volume')
    .eq('account_key', key).eq('symbol', symbol).eq('status', 'approved').gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (result.error) return res.status(500).send('ERROR')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  if (!result.data) return res.status(200).send('NONE')
  const o = result.data
  // id|side|entry|stop|target|volume — formato simple a propósito: el único consumidor es el EA en
  // MQL5, que no tiene un parser de JSON confiable. Nada de comas decimales ni separadores regionales.
  return res.status(200).send(`${o.id}|${o.side}|${o.entry_price}|${o.stop_loss}|${o.take_profit}|${o.volume}`)
}
