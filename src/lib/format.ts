import type { Unit } from './types'

const LB = 0.45359237

export const toUnit = (kg: number, u: Unit) => (u === 'kg' ? kg : kg / LB)

/** Distance follows the weight unit: km with kg, miles with lb. */
export const distUnit = (u: Unit) => (u === 'kg' ? 'km' : 'mi')
export const toDist = (km: number, u: Unit) => (u === 'kg' ? km : km / 1.609344)

export function fmtWeight(kg: number | null | undefined, u: Unit, digits = 1) {
  if (kg === null || kg === undefined || !isFinite(kg)) return '—'
  const v = toUnit(kg, u)
  return `${round(v, digits)} ${u}`
}

export function round(v: number, digits = 1) {
  const p = 10 ** digits
  return (Math.round(v * p) / p).toLocaleString(undefined, { maximumFractionDigits: digits })
}

/** 1,234 -> "1.2k", 1,234,567 -> "1.23M". */
export function compact(v: number) {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(1)}k`
  return Math.round(v).toLocaleString()
}

export function fmtVolume(kg: number, u: Unit) {
  const v = toUnit(kg, u)
  return `${compact(v)} ${u}`
}

export function pct(f: number, digits = 0) {
  const s = (f * 100).toFixed(digits)
  return `${f > 0 ? '+' : ''}${s}%`
}

export function fmtDuration(min: number) {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

export function fmtSeconds(s: number) {
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return r ? `${m}m ${r}s` : `${m}m`
}

const D = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const DS = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const M = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
const MO = new Intl.DateTimeFormat(undefined, { month: 'short' })
export const fmtDate = (d: Date | number) => D.format(d)
export const fmtDay = (d: Date | number) => DS.format(d)
export const fmtMonth = (d: Date | number) => M.format(d)
export const fmtMonthShort = (d: Date | number) => MO.format(d)

export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function fmtHour(h: number) {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

export function plural(n: number, word: string, many = word + 's') {
  return `${n.toLocaleString()} ${n === 1 ? word : many}`
}
