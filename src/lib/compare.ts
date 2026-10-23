import { DAY } from './analytics'
import { LEVEL_NAMES, LEVEL_PCT, NORMS, STANDARDS, type LevelRow, type LiftStandard, type Sex } from './standards'
import type { ExerciseStats } from './types'

export interface Profile {
  sex: Sex
  bodyweightKg: number
  age: number | null
}

export interface Ranked {
  std: LiftStandard
  exercise: string // the Hevy exercise it came from
  value: number // your best: 1RM kg, or reps
  levels: number[] // the five level values at your bodyweight
  pct: number // stronger than this % of lifters
  level: string // highest level you reached, or 'Below beginner'
  recent: boolean // false when the best is older than 6 months
  study?: { pct: number; group: string } // percentile in the study norms, when there is one
}

/** The five level values at a bodyweight, by straight-line steps between the table's rows. */
function levelsAt(rows: LevelRow[], bw: number): number[] {
  const r = [...rows].sort((a, b) => a.bw - b.bw)
  if (bw <= r[0].bw) return [...r[0].levels]
  const last = r[r.length - 1]
  if (bw >= last.bw) return [...last.levels]
  const i = r.findIndex((x) => x.bw >= bw)
  const a = r[i - 1], b = r[i]
  const f = (bw - a.bw) / (b.bw - a.bw)
  return a.levels.map((v, k) => v + (b.levels[k] - v) * f)
}

/** Percentile from (value, percentile) points. Past the ends it keeps going, but never under 1 or over 99. */
function pctFrom(value: number, pts: { v: number; p: number }[]) {
  if (value <= pts[0].v) return Math.max(1, (pts[0].p * value) / pts[0].v)
  for (let i = 1; i < pts.length; i++)
    if (value <= pts[i].v) return pts[i - 1].p + ((pts[i].p - pts[i - 1].p) * (value - pts[i - 1].v)) / (pts[i].v - pts[i - 1].v)
  const a = pts[pts.length - 2], b = pts[pts.length - 1]
  return Math.min(99, b.p + ((b.p - a.p) * (value - b.v)) / (b.v - a.v))
}

function studyPct(key: string, p: Profile, value: number) {
  if (!p.age) return undefined
  const t = NORMS.find((n) => n.lift === key && n.sex === p.sex && p.age! >= n.ageFrom && p.age! <= n.ageTo)
  if (!t) return undefined
  const pts = [...t.points].sort((a, b) => a.ratio - b.ratio).map((x) => ({ v: x.ratio, p: x.pct }))
  return { pct: pctFrom(value / p.bodyweightKg, pts), group: `${p.sex === 'male' ? 'men' : 'women'} aged ${t.ageFrom} to ${t.ageTo}` }
}

/** Your best on each popular lift, placed against the standards for your sex and bodyweight. */
export function rankLifts(stats: ExerciseStats[], p: Profile, now = Date.now()): Ranked[] {
  const out: Ranked[] = []
  for (const std of STANDARDS) {
    // a lift done only once or twice says little about where you stand
    const matches = stats.filter((s) => std.match.test(s.name) && s.sessions.length >= 3)
    type Best = { exercise: string; value: number; date: Date } | null
    let best: Best = null
    let bestRecent: Best = null
    for (const s of matches)
      for (const x of s.sessions) {
        const v = std.metric === 'reps' ? x.bestReps : x.e1rm ?? 0
        if (!v) continue
        if (!best || v > best.value) best = { exercise: s.name, value: v, date: x.date }
        if (x.date.getTime() > now - 182 * DAY && (!bestRecent || v > bestRecent.value)) bestRecent = { exercise: s.name, value: v, date: x.date }
      }
    const use = bestRecent ?? best
    if (!use) continue
    const levels = levelsAt(std[p.sex], p.bodyweightKg)
    const pct = pctFrom(use.value, levels.map((v, i) => ({ v, p: LEVEL_PCT[i] })))
    const reached = levels.reduce((n, v, i) => (use.value >= v ? i : n), -1)
    out.push({
      std, exercise: use.exercise, value: use.value, levels, pct,
      level: reached >= 0 ? LEVEL_NAMES[reached] : 'Below beginner',
      recent: !!bestRecent,
      study: std.metric === 'kg' ? studyPct(std.key, p, use.value) : undefined,
    })
  }
  return out.sort((a, b) => b.pct - a.pct)
}
