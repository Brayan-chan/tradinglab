import { useEffect,useState } from 'react'
import type { BotDecision } from './lib/mt5'
import { shadowOutcome,type ShadowBar } from './lib/shadowOutcome'
type MarketBar=ShadowBar&{captured_at:string}
export function MarketChart({token,decisions}:{token:string;decisions:BotDecision[]}){
 const [bars,setBars]=useState<MarketBar[]>([]),[error,setError]=useState(''),[now,setNow]=useState(Date.now())
 useEffect(()=>{
  const controller=new AbortController();let busy=false
  const refresh=async()=>{setNow(Date.now());if(busy)return;busy=true;try{
   const response=await fetch('/api/mt5/market',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'})
   if(!response.ok)throw new Error('No se pudieron leer las velas de XM.')
   const data=await response.json();if(!controller.signal.aborted){setBars(data.bars);setError('')}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Error de conexión')}finally{busy=false}}
  refresh();const timer=setInterval(refresh,15_000);return()=>{controller.abort();clearInterval(timer)}
 },[token])
 const shown=bars.slice(-100),last=bars.at(-1),fresh=last&&now-Date.parse(last.captured_at)<45_000
 const signals=decisions.filter(d=>d.symbol==='BTCUSD'&&d.mode==='shadow'&&d.verdict==='signal'&&d.side&&d.entry_price&&d.stop_loss&&d.take_profit)
 const selected=signals[0]
 const levels=selected?[selected.entry_price!,selected.stop_loss!,selected.take_profit!]:[]
 const min=Math.min(...shown.map(b=>b.low),...levels),max=Math.max(...shown.map(b=>b.high),...levels),range=max-min||1
 const y=(p:number)=>280-(p-min)/range*240,x=(i:number)=>35+i*8.6
 const labels={pending:'Pendiente',tp:'TP indicativo',sl:'SL indicativo',ambiguous:'Ambiguo: SL y TP',incomplete:'Datos insuficientes',invalid:'Señal inválida'}
 return <article className="panel"><div className="panel-head"><div><span className="eyebrow">VELAS XM · BTCUSD M5 · ACTUALIZACIÓN 15 S</span><h2>Precio y señales</h2></div><span>{fresh?'Datos recientes':'Datos atrasados o sin conexión'}</span></div>
  {error&&<p role="alert">{error}</p>}
  {!shown.length?<p>Esperando velas. Es necesario actualizar y recompilar TradingLabTrader.</p>:<>
   <svg viewBox="0 0 960 320" role="img" aria-label="Gráfica de velas BTCUSD M5 de XM" style={{width:'100%',background:'#0b1014',borderRadius:12}}>
    {Array.from({length:5},(_,i)=>{const p=min+range*i/4;return <g key={i}><line x1="25" x2="900" y1={y(p)} y2={y(p)} stroke="#26313a"/><text x="902" y={y(p)+4} fill="#b3bdc5" fontSize="10">{p.toFixed(0)}</text></g>})}
    {shown.map((b,i)=>{const color=b.close>=b.open?'#38d9a9':'#ff6b6b';return <g key={b.time}><title>{new Date(b.time*1000).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})} · O {b.open} H {b.high} L {b.low} C {b.close}</title><line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} stroke={color}/><rect x={x(i)-2.5} y={Math.min(y(b.open),y(b.close))} width="5" height={Math.max(1,Math.abs(y(b.open)-y(b.close)))} fill={color}/></g>})}
    {selected&&levels.map((p,i)=><g key={i}><line x1="25" x2="895" y1={y(p)} y2={y(p)} stroke={['#ff9b52','#ff6b6b','#38d9a9'][i]} strokeDasharray="4 4"/><text x="30" y={y(p)-5} fill="white" fontSize="11">{['Entrada sombra','SL','TP'][i]} {p.toFixed(2)}</text></g>)}
    {signals.map(d=>{const index=shown.findIndex(b=>b.time<=Date.parse(d.evaluated_at)/1000&&b.time+300>Date.parse(d.evaluated_at)/1000);return index<0?null:<text key={d.id} x={x(index)} y={y(d.entry_price!)-8} fill="#ffc078" fontSize="15">{d.side==='buy'?'↑':'↓'}</text>})}
    <text x="30" y="310" fill="#b3bdc5" fontSize="11">Flechas: señales sombra, no ejecuciones. Última vela en formación.</text>
   </svg>
   <p>Última recepción: {last?new Date(last.captured_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'}):'—'}. SL/TP mostrados de la última señal sombra.</p>
  </>}
  <h3>Resultados sombra indicativos</h3><p>No representan fills ni incluyen costes. Una entrada dentro de una vela o un hueco de datos impide confirmar el resultado.</p>
  {signals.map(d=>{const outcome=shadowOutcome({side:d.side!,entry:d.entry_price!,sl:d.stop_loss!,tp:d.take_profit!,enteredAt:Date.parse(d.evaluated_at)/1000},bars.filter(b=>b.time+300<=now/1000));return <p key={d.id}>{new Date(d.evaluated_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})} · {d.side==='buy'?'Compra':'Venta'} · {labels[outcome.status]} {outcome.r===null?'':`${outcome.r.toFixed(2)}R`}</p>})}
 </article>
}
