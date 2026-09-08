import type { Trade, TradeMetrics } from '../types'

const number = (value: string) => {
  const parsed = Number(value.replace(/[^0-9+-.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export function decodeXmReport(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe
  return new TextDecoder(utf16 ? 'utf-16le' : 'utf-8').decode(buffer)
}

export function parseXmReport(source: string): Trade[] {
  const document = new DOMParser().parseFromString(source, 'text/html')
  const rows = [...document.querySelectorAll('tr')]
  const start = rows.findIndex(row => row.textContent?.trim() === 'Posiciones')
  const end = rows.findIndex((row, index) => index > start && row.textContent?.trim() === 'Órdenes')
  if (start < 0 || end < 0) throw new Error('No encontramos la sección Posiciones del reporte XM/MT5.')

  return rows.slice(start + 2, end).flatMap(row => {
    const cells = [...row.querySelectorAll(':scope > td')].map(cell => cell.textContent?.trim() ?? '')
    if (cells.length < 13 || !/^\d{4}\.\d{2}\.\d{2}/.test(cells[0])) return []
    const shift = cells.length >= 14 ? 1 : 0
    const side = cells[3].toLowerCase()
    if (side !== 'buy' && side !== 'sell') return []
    const value = (base: number) => cells[base + shift] ?? ''
    const trade: Trade = {
      id: cells[1], openedAt: cells[0], closedAt: value(8), symbol: cells[2], side,
      volume: number(value(4)), entry: number(value(5)), stopLoss: value(6) ? number(value(6)) : null,
      takeProfit: value(7) ? number(value(7)) : null, exit: number(value(9)),
      commission: number(value(10)), swap: number(value(11)), pnl: number(value(12)),
    }
    return [trade]
  })
}

export function metricsFor(trades: Trade[]): TradeMetrics {
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
  let balance = 0, peak = 0, maxDrawdown = 0
  for (const trade of [...trades].sort((a, b) => a.closedAt.localeCompare(b.closedAt))) {
    balance += trade.pnl + trade.commission + trade.swap
    peak = Math.max(peak, balance)
    maxDrawdown = Math.max(maxDrawdown, peak - balance)
  }
  return {
    trades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length ? wins.length / trades.length * 100 : 0,
    grossProfit, grossLoss, netProfit: trades.reduce((sum, t) => sum + t.pnl + t.commission + t.swap, 0),
    averageWin: wins.length ? grossProfit / wins.length : 0,
    averageLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : 0,
    expectancy: trades.length ? (grossProfit - grossLoss) / trades.length : 0,
    maxDrawdown, withStop: trades.filter(t => t.stopLoss !== null).length,
    withTarget: trades.filter(t => t.takeProfit !== null).length,
  }
}
