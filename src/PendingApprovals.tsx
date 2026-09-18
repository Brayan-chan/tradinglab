import { useCallback,useEffect,useState } from 'react'
import { AlertTriangle,Check,Clock3,KeyRound,RefreshCw,X } from 'lucide-react'
import { decidePendingOrder,fetchPendingOrders,type PendingOrder } from './lib/mt5'

const clock=(value:string)=>new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'short',timeStyle:'medium'}).format(new Date(value))
const price=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value)
const statusLabel=(value:string)=>({pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada',expired:'Expirada',filled:'Ejecutada'} as Record<string,string>)[value]??value

function countdown(expiresAt:string, now:number){
  const ms=new Date(expiresAt).getTime()-now
  if(ms<=0) return 'vencida'
  const totalSeconds=Math.floor(ms/1000)
  return `${Math.floor(totalSeconds/60)}:${String(totalSeconds%60).padStart(2,'0')}`
}

export function PendingApprovals(){
  const [readToken]=useState(()=>localStorage.getItem('tradinglab:read-token')??'')
  const [actionToken,setActionToken]=useState(()=>localStorage.getItem('tradinglab:action-token')??'')
  const [actionDraft,setActionDraft]=useState('')
  const [orders,setOrders]=useState<PendingOrder[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[busyId,setBusyId]=useState<number|null>(null),[now,setNow]=useState(Date.now())

  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(!readToken)return
    setLoading(true)
    try{setOrders(await fetchPendingOrders(readToken,signal));setError('')}
    catch(reason){if(!signal?.aborted)setError(reason instanceof Error?reason.message:'No se pudieron consultar las señales.')}
    finally{if(!signal?.aborted)setLoading(false)}
  },[readToken])

  useEffect(()=>{
    const controller=new AbortController()
    refresh(controller.signal)
    const timer=window.setInterval(()=>{setNow(Date.now());refresh(controller.signal)},15_000)
    return()=>{controller.abort();window.clearInterval(timer)}
  },[refresh])

  async function decide(id:number, action:'approve'|'reject'){
    if(!actionToken){setError('Configura el token de acción antes de decidir.');return}
    setBusyId(id)
    try{await decidePendingOrder(actionToken,id,action);await refresh()}
    catch(reason){setError(reason instanceof Error?reason.message:'No se pudo registrar la decisión.')}
    finally{setBusyId(null)}
  }

  if(!readToken)return <section className="page"><div className="page-title"><div><span className="eyebrow">ACCESO PROTEGIDO</span><h1>Aprobación de señales.</h1><p>Utiliza el mismo token de lectura de Cuenta MT5 / Piloto automático.</p></div></div>
    <article className="panel token-panel"><KeyRound/><h2>Falta el token de lectura</h2><p>Ve primero a Piloto automático y conecta tu token de lectura; esta vista lo reutiliza.</p></article></section>

  const pending=orders.filter(o=>o.status==='pending')
  const decided=orders.filter(o=>o.status!=='pending')

  return <section className="page autopilot-page">
    <div className="page-title"><div><span className="eyebrow">CONFIRMACIÓN HUMANA REQUERIDA</span><h1>Señales esperando tu aprobación.</h1><p>Ninguna se ejecuta en MT5 sin que la apruebes aquí, y cada una expira sola si no decides a tiempo.</p></div>
      <div className={`status-badge ${pending.length?'blocked':'approved'}`}>{pending.length?<AlertTriangle/>:<Check/>}{pending.length?`${pending.length} esperando decisión`:'Sin señales pendientes'}</div>
    </div>

    {!actionToken&&<article className="panel token-panel"><KeyRound/><h2>Token de acción</h2><p>Distinto del token de lectura: aprobar o rechazar una señal necesita este segundo token (el mismo valor que pusiste en TRADINGLAB_ACTION_TOKEN en Vercel).</p><label className="field"><span>Token</span><div><input type="password" value={actionDraft} onChange={e=>setActionDraft(e.target.value)} autoComplete="off"/></div></label><button className="primary wide" onClick={()=>{const value=actionDraft.trim();localStorage.setItem('tradinglab:action-token',value);setActionToken(value)}}>Guardar token de acción</button></article>}

    {error&&<div className="notice error"><AlertTriangle/>{error}</div>}

    <article className="panel decision-history">
      <div className="panel-head"><div><span className="eyebrow">PENDIENTES</span><h2>Señales activas</h2></div><button className="icon-button refresh" onClick={()=>refresh()} aria-label="Actualizar"><RefreshCw className={loading?'spin':''}/></button></div>
      {!pending.length&&<p className="empty-row">No hay señales esperando aprobación en este momento.</p>}
      {pending.map(order=><article className="panel latest-decision" key={order.id} style={{marginBottom:12}}>
        <div className={`decision-verdict ${order.side==='buy'?'signal':'blocked'}`}><strong>{order.side==='buy'?'COMPRA':'VENTA'} · {order.symbol}</strong><span><Clock3 size={14}/> vence en {countdown(order.expires_at,now)}</span></div>
        <div className="decision-levels">
          <span>Entrada <b>{price(order.entry_price)}</b></span>
          <span>SL <b>{price(order.stop_loss)}</b></span>
          <span>TP <b>{price(order.take_profit)}</b></span>
          <span>Volumen <b>{order.volume.toFixed(2)}</b></span>
          <span>Vela <b>{clock(order.candle_time)}</b></span>
        </div>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="secondary" disabled={busyId===order.id} onClick={()=>decide(order.id,'reject')}><X size={16}/> Rechazar</button>
          <button className="primary" disabled={busyId===order.id} onClick={()=>decide(order.id,'approve')}><Check size={16}/> Aprobar</button>
        </div>
      </article>)}
    </article>

    <article className="panel decision-history">
      <div className="panel-head"><div><span className="eyebrow">TRAZABILIDAD</span><h2>Historial de decisiones</h2></div><small>{decided.length} resueltas</small></div>
      <div className="decision-table">
        <div className="decision-row heading"><span>Vela</span><span>Estado</span><span>Dirección</span><span>Precios</span><span>Decidida</span></div>
        {decided.map(order=><div className="decision-row" key={order.id}>
          <time>{clock(order.candle_time)}</time>
          <b className={`verdict-text ${order.status==='approved'||order.status==='filled'?'signal':order.status==='rejected'?'blocked':'no_setup'}`}>{statusLabel(order.status)}</b>
          <span>{order.side==='buy'?'Compra':'Venta'}</span>
          <span>{price(order.entry_price)} / {price(order.stop_loss)} / {price(order.take_profit)}</span>
          <p>{order.decided_at?clock(order.decided_at):'—'}</p>
        </div>)}
        {!decided.length&&<p className="empty-row">Todavía no hay señales decididas.</p>}
      </div>
    </article>
  </section>
}
