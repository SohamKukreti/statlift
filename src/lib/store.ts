import { createContext, useContext } from 'react'
import type { Dataset, ExerciseStats, Unit, Workout } from './types'
import type { Range } from './analytics'

export type Preset = '90' | '180' | '365' | 'all' | 'custom'

export interface AppState {
  data: Dataset
  stats: ExerciseStats[]
  all: Workout[]
  ws: Workout[] // in range
  range: Range
  preset: Preset
  setPreset: (p: Preset) => void
  custom: { from: string; to: string } | null
  setCustom: (c: { from: string; to: string }) => void
  unit: Unit
  overrides: Record<string, string>
  setOverride: (exercise: string, muscle: string | null) => void
}

export const AppCtx = createContext<AppState>(null as unknown as AppState)
export const useApp = () => useContext(AppCtx)

export function pref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem('liftlog:' + key) as T) || fallback
  } catch {
    return fallback
  }
}

export function setPref(key: string, v: string) {
  try {
    localStorage.setItem('liftlog:' + key, v)
  } catch {
    /* ignore */
  }
}
