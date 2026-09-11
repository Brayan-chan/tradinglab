export interface LiveAccount {
  account_key:string; login_masked:string; server:string; currency:string; balance:number; equity:number
  margin:number; free_margin:number; margin_level:number; snapshot_at:string
}
export interface LivePosition {
  ticket:string; symbol:string; side:'buy'|'sell'; volume:number; price_open:number; price_current:number
  stop_loss:number|null; take_profit:number|null; profit:number; swap:number
}
export interface LiveSymbol {
  symbol:string; contract_size:number; tick_size:number; tick_value:number; volume_min:number; volume_step:number; bid:number; ask:number
}
export interface LiveDeal {
  ticket:string; order_ticket:string; position_ticket:string; symbol:string; side:'buy'|'sell'
  entry:'in'|'out'|'inout'; volume:number; price:number; profit:number; commission:number; swap:number; executed_at:string
}
export interface BotDecision {
  id:number; symbol:string; timeframe:string; mode:'shadow'|'demo'; verdict:'outside_session'|'blocked'|'no_setup'|'signal'|'order_sent'|'error'
  side:'buy'|'sell'|null; reason:string; candle_time:string; evaluated_at:string; entry_price:number|null; stop_loss:number|null
  take_profit:number|null; risk_percent:number|null; reward_risk:number|null; spread_points:number|null
  h1_fast:number|null; h1_slow:number|null; m15_ema:number|null; m15_atr:number|null; m5_ema:number|null
}
export interface LiveState { ok:true; account:LiveAccount|null; positions:LivePosition[]; deals:LiveDeal[]; symbols:LiveSymbol[]; decisions:BotDecision[] }

export async function fetchMt5State(token:string, signal?:AbortSignal):Promise<LiveState> {
  const response=await fetch('/api/mt5/state',{headers:{Authorization:`Bearer ${token}`},signal,cache:'no-store'})
  if(response.status===401) throw new Error('Token de lectura incorrecto.')
  if(!response.ok) throw new Error('No se pudo consultar MT5.')
  return response.json() as Promise<LiveState>
}
