// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { metricsFor, parseXmReport } from './xmParser'

const report = `<table>
  <tr><td>Posiciones</td></tr><tr><td>cabecera</td></tr>
  <tr><td>2026.09.01 10:00:00</td><td>1</td><td>BTCUSD</td><td>sell</td><td></td><td>0.10</td><td>100000</td><td></td><td></td><td>2026.09.01 10:05:00</td><td>100100</td><td>0.00</td><td>0.00</td><td>-10.00</td></tr>
  <tr><td>2026.09.01 11:00:00</td><td>2</td><td>BTCUSD</td><td>sell</td><td></td><td>0.01</td><td>100000</td><td>100200</td><td>99600</td><td>2026.09.01 11:15:00</td><td>99600</td><td>0.00</td><td>0.00</td><td>4.00</td></tr>
  <tr><td>Órdenes</td></tr>
</table>`

describe('XM report parser', () => {
  it('extracts positions and protection levels', () => {
    const trades = parseXmReport(report)
    expect(trades).toHaveLength(2)
    expect(trades[0]).toMatchObject({ symbol: 'BTCUSD', side: 'sell', volume: 0.1, pnl: -10, stopLoss: null })
    expect(trades[1]).toMatchObject({ stopLoss: 100200, takeProfit: 99600, pnl: 4 })
  })

  it('calculates honest metrics', () => {
    const metrics = metricsFor(parseXmReport(report))
    expect(metrics.winRate).toBe(50)
    expect(metrics.profitFactor).toBeCloseTo(4 / 10)
    expect(metrics.withStop).toBe(1)
  })
})
