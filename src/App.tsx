import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, BarChart3, BookOpen, Calculator, Check, ChevronRight, CircleDollarSign, FileUp, FlaskConical, LayoutDashboard, LockKeyhole, Menu, Radio, Shield, ShieldAlert, Target, TrendingDown, TrendingUp, X } from 'lucide-react'
import { calculateRisk } from './lib/risk'
import { decodeXmReport, metricsFor, parseXmReport } from './lib/xmParser'
import { simulateMonteCarlo } from './lib/monteCarlo'
import type { JournalEntry, Side, Trade } from './types'
import { LiveAccount } from './LiveAccount'

type View = 'dashboard' | 'live' | 'risk' | 'simulator' | 'journal'
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const pct = (value: number) => `${value.toFixed(2)}%`

const DEMO_EQUITY = [
  { n: 0, balance: 100 }, { n: 20, balance: 102 }, { n: 40, balance: 99 },
  { n: 60, balance: 105 }, { n: 80, balance: 108 }, { n: 100, balance: 104 },
]

const initialJournal: JournalEntry[] = [
  { id: 'example', createdAt: '2026-09-01T12:00:00', symbol: 'BTCUSD', side: 'buy', setup: 'Ejemplo educativo', plannedRisk: .25, resultR: null, followedPlan: true, notes: 'Define una invalidación técnica antes de calcular el tamaño.' },
]

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => { try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return initial } })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

function MetricCard({ label, value, detail, tone = 'neutral', icon: Icon }: { label: string; value: string; detail: string; tone?: 'neutral' | 'good' | 'bad' | 'warn'; icon: typeof Activity }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-head"><span>{label}</span><Icon size={18} /></div>
    <strong>{value}</strong><small>{detail}</small>
  </article>
}

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [sidebar, setSidebar] = useState(false)
  const [trades, setTrades] = useLocalStorage<Trade[]>('tradinglab:trades', [])
  const [journal, setJournal] = useLocalStorage<JournalEntry[]>('tradinglab:journal', initialJournal)
  const [importMessage, setImportMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const metrics = useMemo(() => metricsFor(trades), [trades])

  async function importReport(file?: File) {
    if (!file) return
    try {
      const parsed = parseXmReport(decodeXmReport(await file.arrayBuffer()))
      if (!parsed.length) throw new Error('El reporte no contiene posiciones cerradas.')
      setTrades(parsed); setImportMessage(`${parsed.length} operaciones importadas correctamente.`)
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'No pudimos leer el reporte.') }
  }

  const nav = [
    ['dashboard', LayoutDashboard, 'Resumen'], ['live', Radio, 'Cuenta MT5'], ['risk', Calculator, 'Planificar operación'],
    ['simulator', FlaskConical, 'Monte Carlo'], ['journal', BookOpen, 'Diario'],
  ] as const

  return <div className="app-shell">
    <aside className={sidebar ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brand-mark"><Shield size={19} /></div><div><b>TRADING<span>LAB</span></b><small>Risk operating system</small></div></div>
      <nav>{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setSidebar(false) }}><Icon size={18}/><span>{label}</span>{view === id && <ChevronRight size={15}/>}</button>)}</nav>
      <div className="sidebar-card"><LockKeyhole size={18}/><b>Local y privado</b><p>Tus reportes y tu diario permanecen en este navegador.</p></div>
      <p className="disclaimer">Herramienta educativa. No garantiza rentabilidad ni constituye asesoría financiera.</p>
    </aside>
    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setSidebar(!sidebar)}><Menu/></button><div><span className="eyebrow">CUENTA DE ENTRENAMIENTO</span><b>Protocolo de preservación activo</b></div><div className="risk-pill"><span></span> Riesgo base 0.25%</div></header>
      {view === 'dashboard' && <Dashboard trades={trades} metrics={metrics} onImport={() => fileRef.current?.click()} message={importMessage} />}
      {view === 'live' && <LiveAccount />}
      {view === 'risk' && <RiskPlanner />}
      {view === 'simulator' && <MonteCarlo />}
      {view === 'journal' && <Journal entries={journal} setEntries={setJournal} />}
      <input ref={fileRef} hidden type="file" accept=".html,.htm" onChange={e => importReport(e.target.files?.[0])}/>
    </main>
  </div>
}

function Dashboard({ trades, metrics, onImport, message }: { trades: Trade[]; metrics: ReturnType<typeof metricsFor>; onImport: () => void; message: string }) {
  const hasData = trades.length > 0
  const chart = useMemo(() => {
    if (!hasData) return DEMO_EQUITY
    let balance = 0
    return [...trades].sort((a,b) => a.closedAt.localeCompare(b.closedAt)).map((t, n) => ({ n, balance: +(balance += t.pnl + t.commission + t.swap).toFixed(2) }))
  }, [trades, hasData])
  const stopRate = hasData ? metrics.withStop / metrics.trades * 100 : 0
  return <section className="page">
    <div className="page-title"><div><span className="eyebrow">CENTRO DE CONTROL</span><h1>Sobrevivir primero. Crecer después.</h1><p>Una vista honesta del riesgo, sin confundir acierto con rentabilidad.</p></div><button className="primary" onClick={onImport}><FileUp size={18}/> Importar reporte XM</button></div>
    {message && <div className="notice"><Check size={17}/>{message}</div>}
    <div className="metric-grid">
      <MetricCard label="Resultado neto" value={hasData ? money.format(metrics.netProfit) : '—'} detail={hasData ? `${metrics.trades} operaciones importadas` : 'Importa un reporte para comenzar'} tone={hasData && metrics.netProfit < 0 ? 'bad' : 'neutral'} icon={TrendingDown}/>
      <MetricCard label="Tasa de acierto" value={hasData ? pct(metrics.winRate) : '—'} detail="No garantiza esperanza positiva" tone="warn" icon={Target}/>
      <MetricCard label="Profit factor" value={hasData ? metrics.profitFactor.toFixed(2) : '—'} detail={!hasData ? 'Esperando datos' : metrics.profitFactor >= 1 ? 'Ganancia bruta supera pérdida' : 'Menor que 1: sistema perdedor'} tone={hasData ? (metrics.profitFactor >= 1 ? 'good' : 'bad') : 'neutral'} icon={BarChart3}/>
      <MetricCard label="Operaciones con SL" value={hasData ? pct(stopRate) : '—'} detail={hasData ? `${metrics.trades - metrics.withStop} sin protección registrada` : 'Esperando datos'} tone={hasData && stopRate < 100 ? 'bad' : 'neutral'} icon={ShieldAlert}/>
    </div>
    <div className="dashboard-grid">
      <article className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">CURVA OPERATIVA</span><h2>{hasData ? 'PnL acumulado importado' : 'Anatomía de dos colapsos'}</h2></div><span className="legend"><i></i>{hasData ? 'PnL de posiciones' : 'Balance XM aproximado'}</span></div>
        <ResponsiveContainer width="100%" height={300}><AreaChart data={chart}><defs><linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6b3d" stopOpacity={.26}/><stop offset="1" stopColor="#ff6b3d" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#222832" vertical={false}/><XAxis dataKey="n" stroke="#6f7784" tickLine={false}/><YAxis stroke="#6f7784" tickFormatter={v => `$${v}`} tickLine={false}/><Tooltip contentStyle={{background:'#11151b',border:'1px solid #29303b',borderRadius:12}} formatter={(v) => money.format(Number(v))}/><Area type="monotone" dataKey="balance" stroke="#ff6b3d" fill="url(#balanceFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer>
      </article>
      <article className="panel risk-diagnosis"><div className="panel-head"><div><span className="eyebrow">PROTOCOLO</span><h2>Lo que debemos bloquear</h2></div><AlertTriangle className="orange"/></div>
        {[['Sin stop','operación sin invalidación'],['Más volumen','aumentar riesgo al perder'],['Una tesis','exposición agregada'],['Pérdida límite','pausa obligatoria']].map(([a,b])=><div className="diagnosis-row" key={a}><b>{a}</b><span>{b}</span></div>)}
        <button className="secondary">Ver protocolo de riesgo <ChevronRight size={16}/></button>
      </article>
    </div>
    <div className="rule-strip"><Shield size={22}/><div><b>Regla activa: una tesis, un riesgo</b><p>Varias entradas sobre BTCUSD en la misma dirección se calculan como una única exposición agregada.</p></div><span>OBLIGATORIA</span></div>
  </section>
}

function NumberField({ label, value, onChange, suffix, step = 'any' }: { label: string; value: number; onChange: (v:number)=>void; suffix?: string; step?: string }) {
  return <label className="field"><span>{label}</span><div><input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))}/>{suffix && <em>{suffix}</em>}</div></label>
}

function RiskPlanner() {
  const [instrument, setInstrument] = useState<'BTCUSD'|'GOLD'>('BTCUSD')
  const [side, setSide] = useState<Side>('buy')
  const [equity, setEquity] = useState(1000), [risk, setRisk] = useState(.25), [openRisk, setOpenRisk] = useState(0)
  const [entry, setEntry] = useState(78000), [stop, setStop] = useState(77500), [target, setTarget] = useState(79000)
  const [daily, setDaily] = useState(0), [losses, setLosses] = useState(0)
  const spec = instrument === 'BTCUSD' ? { contractSize: 1, minVolume: .01, step: .01 } : { contractSize: 100, minVolume: .01, step: .01 }
  const result = calculateRisk({ equity, riskPercent:risk, openRiskPercent:openRisk, entry, stop, target, side, dailyPnlPercent:daily, consecutiveLosses:losses, ...spec, volumeStep:spec.step })
  function selectInstrument(next: 'BTCUSD'|'GOLD') { setInstrument(next); if(next==='GOLD'){setEntry(2650);setStop(2647.5);setTarget(2655)}else{setEntry(78000);setStop(77500);setTarget(79000)} }
  return <section className="page"><div className="page-title"><div><span className="eyebrow">GUARDIA PRE-TRADE</span><h1>Planifica la pérdida antes de pensar en ganar.</h1><p>El lote es el resultado del riesgo; nunca el punto de partida.</p></div><div className={`status-badge ${result.status}`}>{result.status==='approved'?<Check/>:<X/>}{result.status==='approved'?'Operación aprobada':result.status==='warning'?'Revisar operación':'Operación bloqueada'}</div></div>
    <div className="planner-grid"><article className="panel form-panel"><div className="segmented"><button className={instrument==='BTCUSD'?'active':''} onClick={()=>selectInstrument('BTCUSD')}>Bitcoin · BTCUSD</button><button className={instrument==='GOLD'?'active':''} onClick={()=>selectInstrument('GOLD')}>Oro · GOLD</button></div><div className="segmented side"><button className={side==='buy'?'active buy':''} onClick={()=>setSide('buy')}><TrendingUp size={16}/> Compra</button><button className={side==='sell'?'active sell':''} onClick={()=>setSide('sell')}><TrendingDown size={16}/> Venta</button></div>
      <div className="form-grid"><NumberField label="Equity actual" value={equity} onChange={setEquity} suffix="USD"/><NumberField label="Riesgo de la tesis" value={risk} onChange={setRisk} suffix="%" step="0.05"/><NumberField label="Precio de entrada" value={entry} onChange={setEntry}/><NumberField label="Stop técnico" value={stop} onChange={setStop}/><NumberField label="Objetivo" value={target} onChange={setTarget}/><NumberField label="Riesgo ya abierto" value={openRisk} onChange={setOpenRisk} suffix="%" step="0.05"/><NumberField label="PnL del día" value={daily} onChange={setDaily} suffix="%" step="0.05"/><NumberField label="Pérdidas consecutivas" value={losses} onChange={setLosses} step="1"/></div>
    </article><aside className="result-column"><article className={`risk-result ${result.status}`}><span>TAMAÑO MÁXIMO</span><strong>{result.volume.toFixed(2)}</strong><em>lotes</em><div><span>Riesgo nominal <b>{money.format(result.riskBudget)}</b></span><span>Riesgo real <b>{money.format(result.actualRisk)}</b></span><span>Beneficio potencial <b>{money.format(result.reward)}</b></span><span>Ratio calculado <b>{result.ratio.toFixed(2)}R</b></span></div></article><article className="panel checklist"><h3>Validación automática</h3>{result.checks.map(c=><div className={`check ${c.level}`} key={c.label}>{c.level==='pass'?<Check/>:<AlertTriangle/>}<div><b>{c.label}</b><small>{c.detail}</small></div></div>)}</article></aside></div>
  </section>
}

function MonteCarlo() {
  const [capital,setCapital]=useState(1000),[risk,setRisk]=useState(.25),[win,setWin]=useState(45),[avgWin,setAvgWin]=useState(1.5),[avgLoss,setAvgLoss]=useState(1),[trades,setTrades]=useState(300),[ruin,setRuin]=useState(30),[seed,setSeed]=useState(1)
  const result=useMemo(()=>simulateMonteCarlo({capital,riskPercent:risk,winRate:win,averageWinR:avgWin,averageLossR:avgLoss,trades,simulations:1000,ruinDrawdown:ruin},20260908+seed),[capital,risk,win,avgWin,avgLoss,trades,ruin,seed])
  return <section className="page"><div className="page-title"><div><span className="eyebrow">LABORATORIO DE INCERTIDUMBRE</span><h1>La misma ventaja. Mil futuros distintos.</h1><p>Observa qué puede ocurrir antes de exponer capital real.</p></div><button className="primary" onClick={()=>setSeed(s=>s+1)}><Activity size={18}/> Regenerar secuencias</button></div>
    <div className="mc-grid"><article className="panel mc-controls"><h2>Parámetros</h2><NumberField label="Capital inicial" value={capital} onChange={setCapital} suffix="USD"/><NumberField label="Riesgo por operación" value={risk} onChange={setRisk} suffix="%" step="0.05"/><NumberField label="Tasa de acierto" value={win} onChange={setWin} suffix="%"/><NumberField label="Ganancia promedio" value={avgWin} onChange={setAvgWin} suffix="R" step="0.1"/><NumberField label="Pérdida promedio" value={avgLoss} onChange={setAvgLoss} suffix="R" step="0.1"/><NumberField label="Número de operaciones" value={trades} onChange={setTrades} step="10"/><NumberField label="Umbral de ruina" value={ruin} onChange={setRuin} suffix="% DD"/></article>
      <div className="mc-output"><div className="metric-grid mc"><MetricCard label="Esperanza" value={`${result.expectancyR>=0?'+':''}${result.expectancyR.toFixed(3)}R`} detail="Por operación, antes de costes" tone={result.expectancyR>0?'good':'bad'} icon={CircleDollarSign}/><MetricCard label="Prob. de ruina" value={pct(result.ruinProbability)} detail={`Caer ${ruin}% desde un máximo`} tone={result.ruinProbability>5?'bad':'good'} icon={ShieldAlert}/><MetricCard label="Mediana final" value={money.format(result.medianEnding)} detail={`P5 ${money.format(result.p05)} · P95 ${money.format(result.p95)}`} tone={result.medianEnding>capital?'good':'bad'} icon={BarChart3}/><MetricCard label="Rentables" value={pct(result.profitableProbability)} detail={`Drawdown mediano ${pct(result.medianDrawdown)}`} tone={result.profitableProbability>50?'good':'warn'} icon={Target}/></div>
      <article className="panel chart-panel"><div className="panel-head"><div><span className="eyebrow">DISTRIBUCIÓN</span><h2>Percentiles de equity</h2></div><span className="legend multi"><i></i>P5 <i></i>Mediana <i></i>P95</span></div><ResponsiveContainer width="100%" height={380}><LineChart data={result.paths}><CartesianGrid stroke="#222832" vertical={false}/><XAxis dataKey="trade" stroke="#6f7784"/><YAxis stroke="#6f7784" tickFormatter={v=>`$${Math.round(v)}`}/><Tooltip contentStyle={{background:'#11151b',border:'1px solid #29303b',borderRadius:12}} formatter={v=>money.format(Number(v))}/><Line dataKey="conservative" dot={false} stroke="#ff5b58"/><Line dataKey="median" dot={false} stroke="#ff7b3d" strokeWidth={2}/><Line dataKey="optimistic" dot={false} stroke="#38d99b"/></LineChart></ResponsiveContainer></article></div></div>
  </section>
}

function Journal({ entries, setEntries }: { entries: JournalEntry[]; setEntries:(v:JournalEntry[])=>void }) {
  const [symbol,setSymbol]=useState('BTCUSD'),[side,setSide]=useState<Side>('buy'),[setup,setSetup]=useState(''),[risk,setRisk]=useState(.25),[notes,setNotes]=useState('')
  function add(){if(!setup.trim())return;setEntries([{id:crypto.randomUUID(),createdAt:new Date().toISOString(),symbol,side,setup,plannedRisk:risk,resultR:null,followedPlan:true,notes},...entries]);setSetup('');setNotes('')}
  return <section className="page"><div className="page-title"><div><span className="eyebrow">DIARIO DE PROCESO</span><h1>Una buena operación también puede perder.</h1><p>Registra primero el cumplimiento y después el resultado.</p></div></div><div className="journal-grid"><article className="panel form-panel"><h2>Nueva decisión</h2><div className="form-grid"><label className="field"><span>Instrumento</span><div><select value={symbol} onChange={e=>setSymbol(e.target.value)}><option>BTCUSD</option><option>GOLD</option></select></div></label><label className="field"><span>Dirección</span><div><select value={side} onChange={e=>setSide(e.target.value as Side)}><option value="buy">Compra</option><option value="sell">Venta</option></select></div></label><label className="field full"><span>Setup / hipótesis</span><div><input value={setup} onChange={e=>setSetup(e.target.value)} placeholder="¿Qué condición objetiva observaste?"/></div></label><NumberField label="Riesgo planeado" value={risk} onChange={setRisk} suffix="%" step="0.05"/><label className="field full"><span>Notas previas</span><div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Invalidación, contexto y estado emocional"/></div></label></div><button className="primary wide" onClick={add}>Guardar decisión</button></article><div className="journal-list">{entries.map(e=><article className="panel journal-entry" key={e.id}><div><span className={`side-tag ${e.side}`}>{e.side==='buy'?'COMPRA':'VENTA'}</span><time>{new Date(e.createdAt).toLocaleString('es-MX')}</time><button className="icon-button" onClick={()=>setEntries(entries.filter(x=>x.id!==e.id))}><X size={15}/></button></div><h3>{e.symbol} · {e.setup}</h3><p>{e.notes||'Sin notas adicionales.'}</p><footer><span>Riesgo planeado <b>{e.plannedRisk}%</b></span><span className={e.followedPlan?'good-text':'bad-text'}>{e.followedPlan?'Plan respetado':'Incumplimiento detectado'}</span></footer></article>)}</div></div></section>
}

export default App
