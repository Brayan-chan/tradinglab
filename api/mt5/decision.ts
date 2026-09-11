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
  const numeric=['entryPrice','stopLoss','takeProfit','riskPercent','rewardRisk','spreadPoints','h1Fast','h1Slow','m15Ema','m15Atr','m5Ema']
  if(!short(v.login,32)||!short(v.server,100)||!short(v.symbol,40)||!short(v.timeframe,10)||!['shadow','demo'].includes(String(v.mode))||!verdicts.includes(String(v.verdict))||!sides.includes((v.side??null) as null|'buy'|'sell')||!short(v.reason,500)||!short(v.candleTime,40)||!short(v.evaluatedAt,40)||!numeric.every(key=>finiteOrNull(v[key])))return res.status(400).json({ok:false,error:'Invalid decision'})
  const evaluated=new Date(String(v.evaluatedAt)),candle=new Date(String(v.candleTime))
  if(!Number.isFinite(evaluated.getTime())||!Number.isFinite(candle.getTime())||Math.abs(Date.now()-evaluated.getTime())>15*60_000)return res.status(400).json({ok:false,error:'Invalid timestamp'})
  const db=database(),account_key=accountKey(String(v.server),String(v.login))
  const row={account_key,symbol:v.symbol,timeframe:v.timeframe,mode:v.mode,verdict:v.verdict,side:v.side??null,reason:v.reason,candle_time:candle.toISOString(),evaluated_at:evaluated.toISOString(),entry_price:v.entryPrice??null,stop_loss:v.stopLoss??null,take_profit:v.takeProfit??null,risk_percent:v.riskPercent??null,reward_risk:v.rewardRisk??null,spread_points:v.spreadPoints??null,h1_fast:v.h1Fast??null,h1_slow:v.h1Slow??null,m15_ema:v.m15Ema??null,m15_atr:v.m15Atr??null,m5_ema:v.m5Ema??null}
  const {error}=await db.from('mt5_bot_decisions').insert(row)
  if(error)return res.status(500).json({ok:false,error:'Decision sync failed'})
  return res.status(200).json({ok:true,receivedAt:new Date().toISOString()})
}
