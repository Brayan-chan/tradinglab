import type { VercelRequest,VercelResponse } from '@vercel/node'
import { accountKey,bearerToken,tokenMatches } from '../_lib/auth.js'
import { database } from '../_lib/db.js'
import { noStore } from '../_lib/http.js'

export default async function handler(req:VercelRequest,res:VercelResponse){
 noStore(res)
 if(req.method!=='POST'&&req.method!=='GET')return res.status(405).json({ok:false})
 const secret=req.method==='POST'?process.env.MT5_INGEST_TOKEN:process.env.TRADINGLAB_READ_TOKEN
 if(!tokenMatches(bearerToken(req.headers.authorization),secret))return res.status(401).json({ok:false})
 const db=database()
 if(req.method==='GET'){
  const account=await db.from('mt5_accounts').select('account_key').order('snapshot_at',{ascending:false}).limit(1).maybeSingle()
  if(account.error)return res.status(500).json({ok:false})
  if(!account.data)return res.json({ok:true,bars:[]})
  const bars=await db.from('mt5_market_bars').select('*').eq('account_key',account.data.account_key).eq('symbol','BTCUSD').order('time',{ascending:false}).limit(1000)
  if(bars.error)return res.status(500).json({ok:false,error:'Market lookup failed'})
  return res.json({ok:true,bars:bars.data.reverse()})
 }
 if(Number(req.headers['content-length']??0)>100_000)return res.status(413).json({ok:false})
 let v:any
 try{v=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return res.status(400).json({ok:false})}
 const validText=(x:unknown,max:number)=>typeof x==='string'&&x.length>0&&x.length<=max
 if(!v||!validText(v.login,32)||!validText(v.server,100)||v.symbol!=='BTCUSD'||!validText(v.capturedAt,40)||!Array.isArray(v.bars)||!v.bars.length||v.bars.length>300)return res.status(400).json({ok:false,error:'Invalid market payload'})
 const captured=Date.parse(v.capturedAt)
 if(!Number.isFinite(captured)||Math.abs(Date.now()-captured)>900_000)return res.status(400).json({ok:false})
 if(!v.bars.every((b:any)=>b&&[b.time,b.open,b.high,b.low,b.close].every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))&&Number.isInteger(b.time)&&b.time>0&&b.time<=captured/1000+300&&b.low>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)))return res.status(400).json({ok:false,error:'Invalid OHLC'})
 const key=accountKey(v.server,v.login)
 const rows=v.bars.map((b:any)=>({account_key:key,symbol:v.symbol,time:b.time,open:b.open,high:b.high,low:b.low,close:b.close,captured_at:new Date(captured).toISOString()}))
 const result=await db.from('mt5_market_bars').upsert(rows,{onConflict:'account_key,symbol,time'})
 if(result.error){console.error('Market persistence failed',{code:result.error.code??null,message:result.error.message});return res.status(500).json({ok:false,error:'Market persistence failed',code:result.error.code??'DATABASE_TRANSPORT_ERROR'})}
 return res.json({ok:true})
}
