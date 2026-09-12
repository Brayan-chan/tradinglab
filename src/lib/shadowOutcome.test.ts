import { describe,it,expect } from 'vitest'
import { shadowOutcome,type ShadowBar } from './shadowOutcome'
const signal={side:'buy' as const,entry:100,sl:90,tp:120,enteredAt:300}
const bar=(time:number,low=95,high=105):ShadowBar=>({time,open:100,close:100,low,high})
describe('shadow OHLC outcomes',()=>{
  it('does not use the signal candle before entry',()=>expect(shadowOutcome(signal,[bar(0,80,130)])).toMatchObject({status:'pending'}))
  it('records 2R target',()=>expect(shadowOutcome(signal,[bar(300,95,121)])).toMatchObject({status:'tp',r:2}))
  it('records stop',()=>expect(shadowOutcome(signal,[bar(300,89)])).toMatchObject({status:'sl',r:-1}))
  it('does not invent ordering',()=>expect(shadowOutcome(signal,[bar(300,89,121)])).toMatchObject({status:'ambiguous',r:null}))
  it('detects missing candles',()=>expect(shadowOutcome(signal,[bar(600,95,121)])).toMatchObject({status:'incomplete'}))
  it('does not ignore an intrabar entry blind spot',()=>expect(shadowOutcome({...signal,enteredAt:301},[bar(600,95,121)])).toMatchObject({status:'incomplete'}))
  it('supports sells',()=>expect(shadowOutcome({side:'sell',entry:100,sl:110,tp:80,enteredAt:300},[bar(300,79)])).toMatchObject({status:'tp',r:2}))
  it('rejects wrong stop direction',()=>expect(shadowOutcome({...signal,sl:110},[])).toMatchObject({status:'invalid'}))
})
