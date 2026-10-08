// Copia deliberada de src/lib/shadowOutcome.ts: api/ y src/ son dos proyectos TypeScript
// separados a propósito (ver tsconfig.node.json), así que no se importa entre ellos.
// Si cambias la lógica aquí, cambia también la de src/lib/shadowOutcome.ts (y viceversa).
export interface ShadowBar { time:number; open:number; high:number; low:number; close:number }
export interface ShadowSignal { side:'buy'|'sell'; entry:number; sl:number; tp:number; enteredAt:number }
export interface ShadowOutcome { status:'pending'|'tp'|'sl'|'ambiguous'|'incomplete'|'invalid'; r:number|null; time:number|null }

/** Indicative OHLC outcome, not a broker fill or a tick-accurate backtest. */
export function shadowOutcome(signal:ShadowSignal,bars:ShadowBar[],intervalSeconds=300):ShadowOutcome {
  const {side,entry,sl,tp,enteredAt}=signal
  const result=(status:ShadowOutcome['status'],r:number|null=null,time:number|null=null):ShadowOutcome=>({status,r,time})
  if(![entry,sl,tp,enteredAt,intervalSeconds].every(Number.isFinite)||intervalSeconds<=0||!(side==='buy'?sl<entry&&tp>entry:sl>entry&&tp<entry))return result('invalid')
  const ordered=[...bars].sort((a,b)=>a.time-b.time)
  const first=Math.ceil(enteredAt/intervalSeconds)*intervalSeconds
  let expected=first
  for(const bar of ordered){
    if(bar.time<first)continue
    if(bar.time!==expected)return result('incomplete',null,bar.time)
    if(![bar.open,bar.high,bar.low,bar.close].every(Number.isFinite)||bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close))return result('invalid')
    if(first!==enteredAt)return result('incomplete',null,bar.time)
    const stop=side==='buy'?bar.low<=sl:bar.high>=sl
    const target=side==='buy'?bar.high>=tp:bar.low<=tp
    if(stop&&target)return result('ambiguous',null,bar.time)
    if(stop)return result('sl',-1,bar.time)
    if(target)return result('tp',Math.abs(tp-entry)/Math.abs(entry-sl),bar.time)
    expected+=intervalSeconds
  }
  return result('pending')
}
