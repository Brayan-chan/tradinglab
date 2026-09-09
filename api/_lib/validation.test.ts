import { describe,expect,it } from 'vitest'
import { validSnapshot } from './validation'

const snapshot={
  login:'12345678',server:'XMGlobal-MT5 2',currency:'USD',capturedAt:'2026-09-08T19:00:00Z',
  balance:1000,equity:995,margin:10,freeMargin:985,marginLevel:9950,
  positions:[{ticket:'1',symbol:'BTCUSD',side:'buy',volume:.01,priceOpen:55000,priceCurrent:54900,sl:54500,tp:56000,profit:-1,swap:0}],
  deals:[{ticket:'2',orderTicket:'1',positionTicket:'1',symbol:'BTCUSD',side:'sell',entry:'out',volume:.01,price:54900,profit:-1,commission:-.08,swap:0,time:'2026-09-08T18:59:00Z'}],symbols:[{symbol:'BTCUSD',contractSize:1,tickSize:.01,tickValue:.01,volumeMin:.01,volumeStep:.01,bid:54900,ask:54910}],
}

describe('validSnapshot',()=>{
  it('accepts a bounded MT5 snapshot',()=>expect(validSnapshot(snapshot)).toBe(true))
  it('rejects invalid directions',()=>expect(validSnapshot({...snapshot,positions:[{...snapshot.positions[0],side:'hold'}]})).toBe(false))
  it('rejects an invalid deal entry',()=>expect(validSnapshot({...snapshot,deals:[{...snapshot.deals[0],entry:'unknown'}]})).toBe(false))
  it('rejects unbounded arrays',()=>expect(validSnapshot({...snapshot,positions:Array(201).fill(snapshot.positions[0])})).toBe(false))
})
