import { shadowOutcome, type ShadowBar } from './shadowOutcome.js'
import type { database as Database } from './db.js'

type Db = ReturnType<typeof Database>

// Best-effort, nunca lanza: se llama de paso cada vez que alguien abre el dashboard, así que un
// fallo aquí no debe tumbar esa lectura. Procesa un lote chico por llamada; si queda trabajo
// pendiente, la siguiente carga del dashboard sigue avanzando.
export async function resolvePendingReviews(db: Db): Promise<void> {
  try {
    const candidates = await db.from('mt5_bot_pending_orders')
      .select('id,account_key,symbol,side,entry_price,stop_loss,take_profit,volume,candle_time,status,position_ticket,decision_id')
      .in('status', ['approved', 'filled']).order('created_at', { ascending: true }).limit(20)
    if (candidates.error || !candidates.data?.length) return

    for (const order of candidates.data) {
      const existing = await db.from('mt5_trade_reviews').select('outcome_status').eq('decision_id', order.decision_id).maybeSingle()
      if (existing.data && existing.data.outcome_status !== 'pending') continue // ya resuelta, nada que hacer

      if (order.status === 'filled' && order.position_ticket) {
        // DEMO real: el resultado es el deal de salida de MT5, no una simulación.
        const deal = await db.from('mt5_deals').select('profit,executed_at')
          .eq('account_key', order.account_key).eq('position_ticket', order.position_ticket).eq('entry', 'out')
          .order('executed_at', { ascending: false }).limit(1).maybeSingle()
        if (!deal.data) continue // posición real sigue abierta; se revisa en la próxima carga
        const profit = Number(deal.data.profit)
        // Aproximación indicativa del riesgo en dólares (no usa contract_size/comisión exactos),
        // consistente con el mismo espíritu de shadowOutcome: útil para comparar, no para contabilidad.
        const riskUsd = Math.abs(order.entry_price - order.stop_loss) * order.volume
        const r = riskUsd > 0 ? Number((profit / riskUsd).toFixed(4)) : null
        await db.from('mt5_trade_reviews').upsert({
          account_key: order.account_key, decision_id: order.decision_id, pending_order_id: order.id,
          outcome_status: profit > 0 ? 'tp' : profit < 0 ? 'sl' : 'ambiguous', r_multiple: r, resolved_at: deal.data.executed_at,
        }, { onConflict: 'decision_id' })
        continue
      }

      if (order.status === 'approved') {
        // SOMBRA: nunca hubo una orden real — simulamos con las velas M5 ya sincronizadas qué habría pasado.
        const enteredAt = Math.floor(new Date(order.candle_time).getTime() / 1000)
        const bars = await db.from('mt5_market_bars').select('time,open,high,low,close')
          .eq('account_key', order.account_key).eq('symbol', order.symbol).gte('time', enteredAt)
          .order('time', { ascending: true }).limit(500)
        if (bars.error) continue
        const outcome = shadowOutcome(
          { side: order.side as 'buy' | 'sell', entry: order.entry_price, sl: order.stop_loss, tp: order.take_profit, enteredAt },
          (bars.data ?? []) as ShadowBar[],
        )
        if (outcome.status === 'pending' || outcome.status === 'incomplete') continue // faltan velas todavía
        await db.from('mt5_trade_reviews').upsert({
          account_key: order.account_key, decision_id: order.decision_id, pending_order_id: order.id,
          outcome_status: outcome.status, r_multiple: outcome.r, resolved_at: outcome.time ? new Date(outcome.time * 1000).toISOString() : null,
        }, { onConflict: 'decision_id' })
      }
    }
  } catch (error) {
    console.error('resolvePendingReviews failed', { message: error instanceof Error ? error.message : String(error) })
  }
}
