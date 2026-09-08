export interface MonteCarloInput { capital: number; riskPercent: number; winRate: number; averageWinR: number; averageLossR: number; trades: number; simulations: number; ruinDrawdown: number }
export interface MonteCarloResult { ruinProbability: number; profitableProbability: number; medianEnding: number; p05: number; p95: number; medianDrawdown: number; paths: { trade: number; conservative: number; median: number; optimistic: number }[]; expectancyR: number }

function mulberry32(seed: number) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const percentile = (values: number[], p: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]

export function simulateMonteCarlo(input: MonteCarloInput, seed = 20260908): MonteCarloResult {
  const random = mulberry32(seed)
  const allPaths: number[][] = []
  const drawdowns: number[] = []
  let ruined = 0
  for (let s = 0; s < input.simulations; s++) {
    let equity = input.capital, peak = equity, maxDd = 0
    const path = [equity]
    for (let t = 0; t < input.trades; t++) {
      const resultR = random() < input.winRate / 100 ? input.averageWinR : -input.averageLossR
      equity *= 1 + input.riskPercent / 100 * resultR
      peak = Math.max(peak, equity)
      maxDd = Math.max(maxDd, (peak - equity) / peak * 100)
      path.push(equity)
    }
    if (maxDd >= input.ruinDrawdown) ruined++
    drawdowns.push(maxDd); allPaths.push(path)
  }
  const endings = allPaths.map(p => p[p.length - 1]).sort((a, b) => a - b)
  drawdowns.sort((a, b) => a - b)
  const checkpoints = Array.from({ length: Math.min(51, input.trades + 1) }, (_, i) => Math.round(i * input.trades / Math.min(50, input.trades)))
  const paths = checkpoints.map(trade => {
    const values = allPaths.map(p => p[trade]).sort((a, b) => a - b)
    return { trade, conservative: percentile(values, .05), median: percentile(values, .5), optimistic: percentile(values, .95) }
  })
  return { ruinProbability: ruined / input.simulations * 100, profitableProbability: endings.filter(v => v > input.capital).length / input.simulations * 100, medianEnding: percentile(endings, .5), p05: percentile(endings, .05), p95: percentile(endings, .95), medianDrawdown: percentile(drawdowns, .5), paths, expectancyR: input.winRate / 100 * input.averageWinR - (1 - input.winRate / 100) * input.averageLossR }
}
