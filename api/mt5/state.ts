import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearerToken, tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { method, noStore } from '../_lib/http.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (!method(req, res, 'GET')) return
  if (!tokenMatches(bearerToken(req.headers.authorization), process.env.TRADINGLAB_READ_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
  const db = database()
  const accountResult = await db.from('mt5_accounts').select('*').order('snapshot_at', { ascending:false }).limit(1).maybeSingle()
  if (accountResult.error) return res.status(500).json({ ok:false, error:'State lookup failed' })
  if (!accountResult.data) return res.status(200).json({ ok:true, account:null, positions:[], deals:[], symbols:[], decisions:[] })
  const key = accountResult.data.account_key
  const [positions, deals, symbols, decisions] = await Promise.all([
    db.from('mt5_positions').select('*').eq('account_key',key).order('ticket'),
    db.from('mt5_deals').select('*').eq('account_key',key).order('executed_at',{ascending:false}).limit(200),
    db.from('mt5_symbols').select('*').eq('account_key',key).order('symbol'),
    db.from('mt5_bot_decisions').select('*').eq('account_key',key).order('evaluated_at',{ascending:false}).limit(200),
  ])
  if (positions.error || deals.error || symbols.error || decisions.error) return res.status(500).json({ ok:false, error:'State lookup failed' })
  return res.status(200).json({ ok:true, account:accountResult.data, positions:positions.data, deals:deals.data, symbols:symbols.data, decisions:decisions.data })
}
