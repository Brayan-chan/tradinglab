import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,Check,History,KeyRound,RefreshCw,ShieldAlert,Unplug } from 'lucide-react'
import { fetchMt5State,type LiveState } from './lib/mt5'

const money=(value:number,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(value)
const dateTime=(value:string)=>new Intl.DateTimeFormat('es-MX',{dateStyle:'short',timeStyle:'medium'}).format(new Date(value))

export function LiveAccount(){
  const [token,setToken]=useState(()=>localStorage.getItem('tradinglab:read-token')??'')
  const [draft,setDraft]=useState(token),[state,setState]=useState<LiveState|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false)
  async function refresh(current=token){
    if(!current)return;setLoading(true)
    try{setState(await fetchMt5State(current));setError('')}catch(e){setError(e instanceof Error?e.message:'Error de conexión')}finally{setLoading(false)}
  }
  useEffect(()=>{if(!token)return;refresh(token);const id=window.setInterval(()=>refresh(token),10000);return()=>clearInterval(id)},[token])
  const account=state?.account
  const age=account?Date.now()-new Date(account.snapshot_at).getTime():Infinity
  const connected=age<30000
  const risks=useMemo(()=>state?.positions.reduce((sum,p)=>{
    if(!p.stop_loss||!account)return sum
    const spec=state.symbols.find(s=>s.symbol===p.symbol)
    if(!spec||!spec.tick_size||!spec.tick_value)return sum
    return sum+Math.abs(p.price_open-p.stop_loss)/spec.tick_size*spec.tick_value*p.volume
  },0)??0,[state,account])
  const historyNet=useMemo(()=>state?.deals.reduce((sum,d)=>sum+d.profit+d.commission+d.swap,0)??0,[state])
  if(!token)return <section className="page"><div className="page-title"><div><span className="eyebrow">CONEXIÓN SEGURA</span><h1>Vincula este navegador con MT5.</h1><p>El token sólo permite consultar los snapshots recibidos por TradingLab.</p></div></div><article className="panel token-panel"><KeyRound/><h2>Token de lectura</h2><p>Usa el valor configurado como <code>TRADINGLAB_READ_TOKEN</code> en Vercel.</p><label className="field"><span>Token</span><div><input type="password" value={draft} onChange={e=>setDraft(e.target.value)} autoComplete="off"/></div></label><button className="primary wide" onClick={()=>{const value=draft.trim();localStorage.setItem('tradinglab:read-token',value);setToken(value)}}>Conectar navegador</button></article></section>
  return <section className="page"><div className="page-title"><div><span className="eyebrow">CUENTA MT5</span><h1>Control de exposición en vivo.</h1><p>Lectura automática; TradingLab no tiene permiso para operar.</p></div><div className={`status-badge ${connected?'approved':'blocked'}`}>{connected?<Check/>:<Unplug/>}{connected?'Sincronizando':'Sin señal reciente'}</div></div>
    {error&&<div className="notice error"><AlertTriangle/>{error}<button onClick={()=>{localStorage.removeItem('tradinglab:read-token');setToken('')}}>Cambiar token</button></div>}
    {!account&&!error?<article className="panel empty-live"><RefreshCw className={loading?'spin':''}/><h2>Esperando el primer snapshot</h2><p>Instala el EA en MT5 y permite la URL de TradingLab en WebRequest.</p></article>:account&&<><div className="metric-grid"><article className="metric-card"><div className="metric-head"><span>Equity</span></div><strong>{money(account.equity,account.currency)}</strong><small>Balance {money(account.balance,account.currency)}</small></article><article className="metric-card"><div className="metric-head"><span>PnL flotante</span></div><strong>{money(account.equity-account.balance,account.currency)}</strong><small>{state?.positions.length??0} posiciones abiertas</small></article><article className={`metric-card ${risks/account.equity*100>.5?'bad':'good'}`}><div className="metric-head"><span>Riesgo con SL</span><ShieldAlert/></div><strong>{account.equity?`${(risks/account.equity*100).toFixed(2)}%`:'—'}</strong><small>{money(risks,account.currency)} hasta los stops</small></article><article className="metric-card"><div className="metric-head"><span>Margen libre</span></div><strong>{money(account.free_margin,account.currency)}</strong><small>Nivel {account.margin_level.toFixed(1)}%</small></article></div>
      <article className="panel"><div className="panel-head"><div><span className="eyebrow">POSICIONES ABIERTAS</span><h2>{account.login_masked} · {account.server}</h2></div><button className="icon-button refresh" onClick={()=>refresh()}><RefreshCw className={loading?'spin':''}/></button></div><div className="position-table"><div className="position-row heading"><span>Símbolo</span><span>Dirección</span><span>Volumen</span><span>SL</span><span>PnL</span></div>{state?.positions.map(p=><div className={`position-row ${!p.stop_loss?'unsafe':''}`} key={p.ticket}><b>{p.symbol}</b><span className={`side-tag ${p.side}`}>{p.side==='buy'?'COMPRA':'VENTA'}</span><span>{p.volume.toFixed(2)}</span><span>{p.stop_loss||<em>SIN STOP</em>}</span><strong>{money(p.profit+p.swap,account.currency)}</strong></div>)}{!state?.positions.length&&<p className="empty-row">No hay posiciones abiertas.</p>}</div></article>
      <article className="panel deal-history"><div className="panel-head"><div><span className="eyebrow">HISTORIAL MT5 · ÚLTIMOS {state?.deals.length??0} MOVIMIENTOS</span><h2>Registro automático de operaciones</h2><p>Resultado neto recibido: <strong className={historyNet>=0?'good-text':'bad-text'}>{money(historyNet,account.currency)}</strong></p></div><History/></div><div className="deal-table"><div className="deal-row heading"><span>Fecha</span><span>Símbolo</span><span>Movimiento</span><span>Dirección</span><span>Volumen · precio</span><span>Resultado neto</span></div>{state?.deals.map(d=>{const net=d.profit+d.commission+d.swap;return <div className="deal-row" key={d.ticket}><time>{dateTime(d.executed_at)}</time><b>{d.symbol}</b><span>{d.entry==='in'?'APERTURA':d.entry==='out'?'CIERRE':'REVERSIÓN'}</span><span className={`side-tag ${d.side}`}>{d.side==='buy'?'COMPRA':'VENTA'}</span><span>{d.volume.toFixed(2)} · {d.price}</span><strong className={net>=0?'good-text':'bad-text'}>{money(net,account.currency)}</strong></div>})}{!state?.deals.length&&<p className="empty-row">Todavía no hay movimientos sincronizados en el periodo configurado.</p>}</div></article></>}
  </section>
}
