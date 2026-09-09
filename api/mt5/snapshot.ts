import type { VercelRequest, VercelResponse } from '@vercel/node'
import { accountKey, bearerToken, maskedLogin, tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { method, noStore } from '../_lib/http.js'
import { validSnapshot } from '../_lib/validation.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (!method(req, res, 'POST')) return
  if (!tokenMatches(bearerToken(req.headers.authorization), process.env.MT5_INGEST_TOKEN)) return res.status(401).json({ ok:false, error:'Unauthorized' })
  const rawLength = Number(req.headers['content-length'] ?? 0)
  if (rawLength > 512_000) return res.status(413).json({ ok:false, error:'Payload too large' })
  let payload: unknown
  try { payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body }
  catch { return res.status(400).json({ ok:false, error:'Invalid JSON' }) }
  if (!validSnapshot(payload)) return res.status(400).json({ ok:false, error:'Invalid snapshot' })
  const captured = new Date(payload.capturedAt)
  if (!Number.isFinite(captured.getTime()) || Math.abs(Date.now() - captured.getTime()) > 15 * 60_000) return res.status(400).json({ ok:false, error:'Invalid timestamp' })

  const db = database()
  const account_key = accountKey(payload.server, payload.login)
  const now = captured.toISOString()
  const { error: accountError } = await db.from('mt5_accounts').upsert({
    account_key, login_masked: maskedLogin(payload.login), server: payload.server, currency: payload.currency,
    balance: payload.balance, equity: payload.equity, margin: payload.margin, free_margin: payload.freeMargin,
    margin_level: payload.marginLevel, snapshot_at: now,
  }, { onConflict:'account_key' })
  if (accountError) return res.status(500).json({ ok:false, error:'Account sync failed' })

  const { error: clearError } = await db.from('mt5_positions').delete().eq('account_key', account_key)
  if (clearError) return res.status(500).json({ ok:false, error:'Position sync failed' })
  if (payload.positions.length) {
    const { error } = await db.from('mt5_positions').insert(payload.positions.map(p => ({
      account_key, ticket:p.ticket, symbol:p.symbol, side:p.side, volume:p.volume, price_open:p.priceOpen,
      price_current:p.priceCurrent, stop_loss:p.sl || null, take_profit:p.tp || null, profit:p.profit, swap:p.swap, observed_at:now,
    })))
    if (error) return res.status(500).json({ ok:false, error:'Position sync failed' })
  }
  if (payload.deals.length) {
    const { error } = await db.from('mt5_deals').upsert(payload.deals.map(d => ({
      account_key, ticket:d.ticket, order_ticket:d.orderTicket, position_ticket:d.positionTicket, symbol:d.symbol,
      side:d.side, entry:d.entry??'out', volume:d.volume, price:d.price, profit:d.profit, commission:d.commission, swap:d.swap, executed_at:d.time,
    })), { onConflict:'account_key,ticket', ignoreDuplicates:true })
    if (error) return res.status(500).json({ ok:false, error:'Deal sync failed' })
  }
  if (payload.symbols.length) {
    const { error } = await db.from('mt5_symbols').upsert(payload.symbols.map(s => ({
      account_key, symbol:s.symbol, contract_size:s.contractSize, tick_size:s.tickSize, tick_value:s.tickValue,
      volume_min:s.volumeMin, volume_step:s.volumeStep, bid:s.bid, ask:s.ask, observed_at:now,
    })), { onConflict:'account_key,symbol' })
    if (error) return res.status(500).json({ ok:false, error:'Symbol sync failed' })
  }
  return res.status(200).json({ ok:true, accountKey:account_key, receivedAt:new Date().toISOString() })
}
