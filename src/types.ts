export type Side = 'buy' | 'sell'

export interface Trade {
  id: string
  openedAt: string
  closedAt: string
  symbol: string
  side: Side
  volume: number
  entry: number
  stopLoss: number | null
  takeProfit: number | null
  exit: number
  commission: number
  swap: number
  pnl: number
}

export interface TradeMetrics {
  trades: number
  wins: number
  losses: number
  winRate: number
  grossProfit: number
  grossLoss: number
  netProfit: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  expectancy: number
  maxDrawdown: number
  withStop: number
  withTarget: number
}

export interface JournalEntry {
  id: string
  createdAt: string
  symbol: string
  side: Side
  setup: string
  plannedRisk: number
  resultR: number | null
  followedPlan: boolean
  notes: string
}
