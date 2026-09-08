import { describe, expect, it } from 'vitest'
import { calculateRisk } from './risk'

const base = { equity: 1000, riskPercent: 0.25, openRiskPercent: 0, entry: 2000, stop: 1995, target: 2010, contractSize: 100, minVolume: 0.01, volumeStep: 0.01, side: 'buy' as const, dailyPnlPercent: 0, consecutiveLosses: 0 }

describe('calculateRisk', () => {
  it('rounds volume down and never exceeds the budget', () => {
    const result = calculateRisk(base)
    expect(result.riskBudget).toBe(2.5)
    expect(result.volume).toBe(0)
    expect(result.actualRisk).toBeLessThanOrEqual(result.riskBudget)
    expect(result.status).toBe('blocked')
  })
  it('blocks a stop on the wrong side', () => {
    expect(calculateRisk({ ...base, stop: 2005 }).status).toBe('blocked')
  })
  it('blocks aggregated risk above the cap', () => {
    const result = calculateRisk({ ...base, equity: 10000, openRiskPercent: 0.4 })
    expect(result.status).toBe('blocked')
  })
})
