import type { Side } from '../types'

export interface RiskInput {
  equity: number
  riskPercent: number
  openRiskPercent: number
  entry: number
  stop: number
  target: number
  contractSize: number
  minVolume: number
  volumeStep: number
  side: Side
  dailyPnlPercent: number
  consecutiveLosses: number
}

export interface RiskResult {
  riskBudget: number
  rawVolume: number
  volume: number
  actualRisk: number
  actualRiskPercent: number
  reward: number
  ratio: number
  status: 'approved' | 'warning' | 'blocked'
  checks: { level: 'pass' | 'warn' | 'block'; label: string; detail: string }[]
}

const floorStep = (value: number, step: number) => Math.floor((value + 1e-10) / step) * step

export function calculateRisk(input: RiskInput): RiskResult {
  const distance = Math.abs(input.entry - input.stop)
  const targetDistance = Math.abs(input.target - input.entry)
  const riskBudget = input.equity * input.riskPercent / 100
  const rawVolume = distance > 0 && input.contractSize > 0 ? riskBudget / (distance * input.contractSize) : 0
  const volume = floorStep(rawVolume, input.volumeStep)
  const actualRisk = volume * distance * input.contractSize
  const actualRiskPercent = input.equity > 0 ? actualRisk / input.equity * 100 : 0
  const reward = volume * targetDistance * input.contractSize
  const ratio = actualRisk > 0 ? reward / actualRisk : 0
  const stopValid = input.side === 'buy' ? input.stop < input.entry : input.stop > input.entry
  const targetValid = input.side === 'buy' ? input.target > input.entry : input.target < input.entry

  const checks: RiskResult['checks'] = [
    { level: distance > 0 && stopValid ? 'pass' : 'block', label: 'Invalidación técnica', detail: stopValid && distance > 0 ? 'El stop está del lado correcto.' : 'El stop no invalida correctamente la dirección.' },
    { level: targetValid ? 'pass' : 'block', label: 'Objetivo coherente', detail: targetValid ? 'El objetivo está a favor de la operación.' : 'El objetivo está en el lado incorrecto.' },
    { level: input.riskPercent <= 0.25 ? 'pass' : input.riskPercent <= 0.5 ? 'warn' : 'block', label: 'Riesgo por tesis', detail: `${input.riskPercent.toFixed(2)}% solicitado; base de entrenamiento 0.25%.` },
    { level: input.openRiskPercent + actualRiskPercent <= 0.5 ? 'pass' : 'block', label: 'Riesgo agregado', detail: `${(input.openRiskPercent + actualRiskPercent).toFixed(2)}% quedaría abierto.` },
    { level: volume >= input.minVolume ? 'pass' : 'block', label: 'Volumen ejecutable', detail: volume >= input.minVolume ? `${volume.toFixed(2)} lotes, redondeado hacia abajo.` : 'El lote mínimo excede tu presupuesto de riesgo.' },
    { level: input.dailyPnlPercent > -0.75 ? 'pass' : 'block', label: 'Límite diario', detail: input.dailyPnlPercent > -0.75 ? 'Todavía no alcanzaste el bloqueo diario.' : 'La pérdida diaria alcanzó -0.75%.' },
    { level: input.consecutiveLosses < 3 ? 'pass' : 'block', label: 'Pausa por racha', detail: input.consecutiveLosses < 3 ? `${input.consecutiveLosses} pérdidas consecutivas.` : 'Tres pérdidas consecutivas: pausa obligatoria.' },
  ]
  const status = checks.some(c => c.level === 'block') ? 'blocked' : checks.some(c => c.level === 'warn') ? 'warning' : 'approved'
  return { riskBudget, rawVolume, volume, actualRisk, actualRiskPercent, reward, ratio, status, checks }
}
