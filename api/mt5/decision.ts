import type { VercelRequest, VercelResponse } from '@vercel/node'
import { accountKey, bearerToken, tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { method, noStore } from '../_lib/http.js'

const finiteOrNull=(value:unknown)=>value===null||value===undefined||(typeof value==='number'&&Number.isFinite(value))
const short=(value:unknown,max=200)=>typeof value==='string'&&value.length>0&&value.length<=max

export default async function handler(req:VercelRequest,res:VercelResponse){
  noStore(res)
  if(!method(req,res,'POST'))return
  if(!tokenMatches(bearerToken(req.headers.authorization),process.env.MT5_INGEST_TOKEN))return res.status(401).json({ok:false,error:'Unauthorized'})
  if(Number(req.headers['content-length']??0)>32_000)return res.status(413).json({ok:false,error:'Payload too large'})
  let value:unknown
  try{value=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return res.status(400).json({ok:false,error:'Invalid JSON'})}
  if(!value||typeof value!=='object')return res.status(400).json({ok:false,error:'Invalid decision'})
  const v=value as Record<string,unknown>
  const verdicts=['outside_session','blocked','no_setup','signal','order_sent','error']
  const sides=[null,'buy','sell']
  const numeric=['entryPrice','stopLoss','takeProfit','riskPercent','rewardRisk','spreadPoints','h1Fast','h1Slow','m15Ema','m15Atr','m5Ema','volume']
  if(!short(v.login,32)||!short(v.server,100)||!short(v.symbol,40)||!short(v.timeframe,10)||!['shadow','demo'].includes(String(v.mode))||!verdicts.includes(String(v.verdict))||!sides.includes((v.side??null) as null|'buy'|'sell')||!short(v.reason,500)||!short(v.candleTime,40)||!short(v.evaluatedAt,40)||!numeric.every(key=>finiteOrNull(v[key])))return res.status(400).json({ok:false,error:'Invalid decision'})
  if(v.matchScore!==null&&v.matchScore!==undefined&&(!Number.isInteger(v.matchScore)||(v.matchScore as number)<0||(v.matchScore as number)>3))return res.status(400).json({ok:false,error:'Invalid matchScore'})
  const evaluated=new Date(String(v.evaluatedAt)),candle=new Date(String(v.candleTime))
  if(!Number.isFinite(evaluated.getTime())||!Number.isFinite(candle.getTime())||Math.abs(Date.now()-evaluated.getTime())>15*60_000)return res.status(400).json({ok:false,error:'Invalid timestamp'})
  const db=database(),account_key=accountKey(String(v.server),String(v.login))
  const row={account_key,symbol:v.symbol,timeframe:v.timeframe,mode:v.mode,verdict:v.verdict,side:v.side??null,reason:v.reason,candle_time:candle.toISOString(),evaluated_at:evaluated.toISOString(),entry_price:v.entryPrice??null,stop_loss:v.stopLoss??null,take_profit:v.takeProfit??null,risk_percent:v.riskPercent??null,reward_risk:v.rewardRisk??null,spread_points:v.spreadPoints??null,h1_fast:v.h1Fast??null,h1_slow:v.h1Slow??null,m15_ema:v.m15Ema??null,m15_atr:v.m15Atr??null,m5_ema:v.m5Ema??null,volume:v.volume??null,match_score:v.matchScore??null}
  const inserted=await db.from('mt5_bot_decisions').insert(row).select('id').single()
  if(inserted.error){console.error('Decision sync failed',{code:inserted.error.code??null,message:inserted.error.message});return res.status(500).json({ok:false,error:'Decision sync failed',code:inserted.error.code??'DATABASE_TRANSPORT_ERROR'})}
  // Una señal en sombra con niveles y volumen completos queda a la espera de tu aprobación explícita.
  // No es una orden: es una propuesta que expira sola si no la revisas a tiempo.
  if(v.verdict==='signal'&&v.mode==='shadow'&&v.side&&finiteOrNull(v.entryPrice)&&v.entryPrice!==null&&finiteOrNull(v.stopLoss)&&v.stopLoss!==null&&finiteOrNull(v.takeProfit)&&v.takeProfit!==null&&finiteOrNull(v.volume)&&v.volume!==null){
    const pending={account_key,decision_id:inserted.data.id,symbol:v.symbol,side:v.side,entry_price:v.entryPrice,stop_loss:v.stopLoss,take_profit:v.takeProfit,volume:v.volume,candle_time:candle.toISOString(),status:'pending',expires_at:new Date(evaluated.getTime()+5*60_000).toISOString()}
    const {error:pendingError}=await db.from('mt5_bot_pending_orders').insert(pending)
    if(pendingError)console.error('Pending order insert failed',{code:pendingError.code??null,message:pendingError.message})
  }
  return res.status(200).json({ok:true,receivedAt:new Date().toISOString()})
}
