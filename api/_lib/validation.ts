export type Mt5Position = {
  ticket: string; symbol: string; side: 'buy' | 'sell'; volume: number
  priceOpen: number; priceCurrent: number; sl: number; tp: number; profit: number; swap: number
}
export type Mt5Deal = {
  ticket: string; orderTicket: string; positionTicket: string; symbol: string; side: 'buy' | 'sell'
  volume: number; price: number; profit: number; commission: number; swap: number; time: string
}
export type Mt5Symbol = {
  symbol: string; contractSize: number; tickSize: number; tickValue: number
  volumeMin: number; volumeStep: number; bid: number; ask: number
}
export type Mt5Snapshot = {
  login: string; server: string; currency: string; capturedAt: string
  balance: number; equity: number; margin: number; freeMargin: number; marginLevel: number
  positions: Mt5Position[]; deals: Mt5Deal[]; symbols: Mt5Symbol[]
}

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max

export function validSnapshot(value: unknown): value is Mt5Snapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!text(v.login, 32) || !text(v.server, 120) || !text(v.currency, 12) || !text(v.capturedAt, 40)) return false
  if (![v.balance,v.equity,v.margin,v.freeMargin,v.marginLevel].every(finite)) return false
  if (!Array.isArray(v.positions) || v.positions.length > 200 || !Array.isArray(v.deals) || v.deals.length > 500 || !Array.isArray(v.symbols) || v.symbols.length > 50) return false
  return v.positions.every(p => p && text(p.ticket,32) && text(p.symbol,40) && (p.side==='buy'||p.side==='sell') && [p.volume,p.priceOpen,p.priceCurrent,p.sl,p.tp,p.profit,p.swap].every(finite))
    && v.deals.every(d => d && text(d.ticket,32) && text(d.orderTicket,32) && text(d.positionTicket,32) && text(d.symbol,40) && (d.side==='buy'||d.side==='sell') && text(d.time,40) && [d.volume,d.price,d.profit,d.commission,d.swap].every(finite))
    && v.symbols.every(s => s && text(s.symbol,40) && [s.contractSize,s.tickSize,s.tickValue,s.volumeMin,s.volumeStep,s.bid,s.ask].every(finite))
}
