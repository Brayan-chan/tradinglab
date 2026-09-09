export interface MonteCarloInput {
  capital:number; riskPercent:number; winRate:number; rewardRiskRatio:number; operations:number
  simulations:number; ruinDrawdown:number; costR:number
}
export interface MonteCarloPoint { operation:number; conservative:number; median:number; optimistic:number }
export interface MonteCarloResult {
  ruinProbability:number; profitableProbability:number; medianEnding:number; p05:number; p95:number
  bestEnding:number; worstEnding:number; medianDrawdown:number; p95Drawdown:number
  drawdownProbabilities:{level:number;probability:number}[]; medianLossStreak:number; p95LossStreak:number
  averageOperationsToRuin:number|null; paths:MonteCarloPoint[]; expectancyR:number; breakEvenWinRate:number
  operations:number; simulations:number
}
function mulberry32(seed:number){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const percentile=(values:number[],p:number)=>values[Math.min(values.length-1,Math.floor((values.length-1)*p))]
const bounded=(value:number,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback
export function normalizeMonteCarloInput(input:MonteCarloInput):MonteCarloInput{return{
  capital:bounded(input.capital,1,10_000_000,1000),riskPercent:bounded(input.riskPercent,.01,20,.25),
  winRate:bounded(input.winRate,0,100,45),rewardRiskRatio:bounded(input.rewardRiskRatio,.1,20,2),
  operations:Math.round(bounded(input.operations,1,5000,300)),simulations:Math.round(bounded(input.simulations,100,100_000,1000)),
  ruinDrawdown:bounded(input.ruinDrawdown,1,99,30),costR:bounded(input.costR,0,2,0),
}}
export function simulateMonteCarlo(input:MonteCarloInput,seed=20260908,onProgress?:(progress:number)=>void):MonteCarloResult{
  const safe=normalizeMonteCarloInput(input),random=mulberry32(seed),sampleSize=Math.min(safe.simulations,2000)
  const pointCount=Math.min(50,safe.operations),checkpoints=Array.from({length:pointCount+1},(_,i)=>Math.round(i*safe.operations/pointCount))
  const samples:number[][]=checkpoints.map(()=>[]),endings:number[]=[],drawdowns:number[]=[],lossStreaks:number[]=[]
  const ddLevels=[10,20,30,50],ddCounts=[0,0,0,0]
  let ruined=0,ruinOperationSum=0,best=-Infinity,worst=Infinity
  for(let simulation=0;simulation<safe.simulations;simulation++){
    let equity=safe.capital,peak=equity,maxDrawdown=0,lossStreak=0,maxLossStreak=0,checkpointIndex=1,ruinAt=0
    if(simulation<sampleSize)samples[0].push(equity)
    for(let operation=1;operation<=safe.operations;operation++){
      const won=random()<safe.winRate/100,resultR=won?safe.rewardRiskRatio-safe.costR:-1-safe.costR
      equity=Math.min(1e15,Math.max(0,equity*(1+safe.riskPercent/100*resultR)));peak=Math.max(peak,equity)
      maxDrawdown=Math.max(maxDrawdown,peak?((peak-equity)/peak)*100:100)
      lossStreak=won?0:lossStreak+1;maxLossStreak=Math.max(maxLossStreak,lossStreak)
      while(checkpointIndex<checkpoints.length&&operation>=checkpoints[checkpointIndex]){if(simulation<sampleSize)samples[checkpointIndex].push(equity);checkpointIndex++}
      if(maxDrawdown>=safe.ruinDrawdown){ruinAt=operation;break}
    }
    while(checkpointIndex<checkpoints.length){if(simulation<sampleSize)samples[checkpointIndex].push(equity);checkpointIndex++}
    if(ruinAt){ruined++;ruinOperationSum+=ruinAt}
    for(let i=0;i<ddLevels.length;i++)if(maxDrawdown>=ddLevels[i])ddCounts[i]++
    endings.push(equity);drawdowns.push(maxDrawdown);lossStreaks.push(maxLossStreak);best=Math.max(best,equity);worst=Math.min(worst,equity)
    if(onProgress&&simulation%Math.max(100,Math.floor(safe.simulations/100))===0)onProgress(simulation/safe.simulations*100)
  }
  endings.sort((a,b)=>a-b);drawdowns.sort((a,b)=>a-b);lossStreaks.sort((a,b)=>a-b)
  const paths=checkpoints.map((operation,index)=>{const values=samples[index].sort((a,b)=>a-b);return{operation,conservative:percentile(values,.05),median:percentile(values,.5),optimistic:percentile(values,.95)}})
  const expectancyR=safe.winRate/100*safe.rewardRiskRatio-(1-safe.winRate/100)-safe.costR
  return{ruinProbability:ruined/safe.simulations*100,profitableProbability:endings.filter(v=>v>safe.capital).length/safe.simulations*100,
    medianEnding:percentile(endings,.5),p05:percentile(endings,.05),p95:percentile(endings,.95),bestEnding:best,worstEnding:worst,
    medianDrawdown:percentile(drawdowns,.5),p95Drawdown:percentile(drawdowns,.95),drawdownProbabilities:ddLevels.map((level,i)=>({level,probability:ddCounts[i]/safe.simulations*100})),
    medianLossStreak:percentile(lossStreaks,.5),p95LossStreak:percentile(lossStreaks,.95),averageOperationsToRuin:ruined?ruinOperationSum/ruined:null,
    paths,expectancyR,breakEvenWinRate:(1+safe.costR)/(safe.rewardRiskRatio+1)*100,operations:safe.operations,simulations:safe.simulations}
}
