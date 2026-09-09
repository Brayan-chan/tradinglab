import {describe,expect,it} from 'vitest'
import {normalizeMonteCarloInput,simulateMonteCarlo} from './monteCarlo'
const base={capital:1000,riskPercent:1,winRate:38,rewardRiskRatio:2,operations:300,simulations:1000,ruinDrawdown:50,costR:0}
describe('Monte Carlo',()=>{
  it('calculates 2:1 expectancy and break-even',()=>{const result=simulateMonteCarlo(base,1);expect(result.expectancyR).toBeCloseTo(.14);expect(result.breakEvenWinRate).toBeCloseTo(33.333,2)})
  it('includes costs in expectancy and break-even',()=>{const result=simulateMonteCarlo({...base,costR:.05},1);expect(result.expectancyR).toBeCloseTo(.09);expect(result.breakEvenWinRate).toBeCloseTo(35)})
  it('is deterministic for the same seed',()=>expect(simulateMonteCarlo(base,42)).toEqual(simulateMonteCarlo(base,42)))
  it('keeps only chart checkpoints',()=>expect(simulateMonteCarlo({...base,operations:5000},1).paths.length).toBeLessThanOrEqual(51))
  it('bounds dangerous inputs',()=>expect(normalizeMonteCarloInput({...base,operations:100000,simulations:1000000})).toMatchObject({operations:5000,simulations:100000}))
})
