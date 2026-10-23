import type { ExerciseKind, ExerciseStats, Session, Workout, WorkSet } from './types'
import { GROUPS, MUSCLES, muscleFor, type Group, type Split } from './muscles'

export const DAY = 86400000

/* ---------------------------------- basics ---------------------------------- */

/** Epley estimate of a one-rep max. Above 15 reps the guess is too loose to use. */
export function epley(weight: number, reps: number): number | null {
  if (!(weight > 0) || !(reps > 0) || reps > 15) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export const isWorking = (s: WorkSet) => s.type !== 'warmup'

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday-based week start. */
export function startOfWeek(d: Date) {
  const s = startOfDay(d)
  const dow = (s.getDay() + 6) % 7
  return new Date(s.getTime() - dow * DAY)
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export function workoutVolume(w: Workout) {
  let v = 0
  for (const e of w.exercises) for (const s of e.sets) if (isWorking(s) && s.weightKg && s.reps) v += s.weightKg * s.reps
  return v
}

export function workoutSets(w: Workout) {
  let n = 0
  for (const e of w.exercises) for (const s of e.sets) if (isWorking(s)) n++
  return n
}

export function workoutReps(w: Workout) {
  let n = 0
  for (const e of w.exercises) for (const s of e.sets) if (isWorking(s) && s.reps) n += s.reps
  return n
}

/* ------------------------------ exercise stats ------------------------------ */

function kindOf(sets: WorkSet[]): ExerciseKind {
  let weighted = 0, reps = 0, dist = 0, dur = 0
  for (const s of sets) {
    if (s.weightKg && s.weightKg > 0) weighted++
    if (s.reps && s.reps > 0) reps++
    if (s.distanceKm && s.distanceKm > 0) dist++
    if (s.durationS && s.durationS > 0) dur++
  }
  if (weighted > 0 && weighted >= reps * 0.3) return 'weighted'
  if (reps > 0) return 'bodyweight'
  if (dist > 0) return 'cardio'
  if (dur > 0) return 'timed'
  return 'weighted'
}

export function buildExerciseStats(workouts: Workout[], overrides: Record<string, string>): ExerciseStats[] {
  const map = new Map<string, { w: Workout; sets: WorkSet[] }[]>()
  for (const w of workouts) {
    const per = new Map<string, WorkSet[]>()
    for (const e of w.exercises) per.set(e.name, [...(per.get(e.name) ?? []), ...e.sets])
    for (const [name, sets] of per) {
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push({ w, sets })
    }
  }
  const out: ExerciseStats[] = []
  for (const [name, list] of map) {
    const kind = kindOf(list.flatMap((x) => x.sets))
    const muscle = muscleFor(name, overrides)
    const group = MUSCLES[muscle]?.group ?? 'Other'
    let best = -Infinity
    const sessions: Session[] = list.map(({ w, sets }) => {
      const work = sets.filter(isWorking)
      let e1rm: number | null = null, topW: number | null = null, topWR: number | null = null
      let volume = 0, totalReps = 0, bestReps = 0, distanceKm = 0, durationS = 0
      for (const s of work) {
        const wt = s.weightKg ?? 0, r = s.reps ?? 0
        if (wt > 0 && r > 0) volume += wt * r
        totalReps += r
        if (r > bestReps) bestReps = r
        distanceKm += s.distanceKm ?? 0
        durationS += s.durationS ?? 0
        const est = epley(wt, r)
        if (est !== null && (e1rm === null || est > e1rm)) e1rm = est
        if (wt > 0 && r > 0 && (topW === null || wt > topW || (wt === topW && r > (topWR ?? 0)))) {
          topW = wt
          topWR = r
        }
      }
      const score =
        kind === 'weighted' ? e1rm ?? -Infinity : kind === 'bodyweight' ? bestReps : kind === 'cardio' ? distanceKm : durationS
      const isPR = score > best && score > 0 && best !== -Infinity
      if (score > best) best = score
      return {
        workoutId: w.id, date: w.start, e1rm, topWeight: topW, topWeightReps: topWR, volume, totalReps, bestReps,
        sets: work.length, distanceKm, durationS, workSets: work, isPR,
      }
    })
    out.push({ name, kind, muscle, group, sessions })
  }
  return out.sort((a, b) => b.sessions.length - a.sessions.length)
}

/* ---------------------------------- ranges ---------------------------------- */

export interface Range {
  from: Date
  to: Date
}

export const inRange = (d: Date, r: Range) => d >= r.from && d <= r.to

export function filterWorkouts(ws: Workout[], r: Range) {
  return ws.filter((w) => inRange(w.start, r))
}

/* ----------------------------------- KPIs ----------------------------------- */

export interface Kpis {
  workouts: number
  hours: number
  volume: number
  sets: number
  reps: number
  avgDuration: number
  perWeek: number
  prs: number
  exercises: number
}

export function kpis(ws: Workout[], stats: ExerciseStats[], r: Range): Kpis {
  const weeks = Math.max(1, (Math.min(r.to.getTime(), Date.now()) - r.from.getTime()) / (7 * DAY))
  let hours = 0, volume = 0, sets = 0, reps = 0
  const names = new Set<string>()
  for (const w of ws) {
    hours += w.durationMin / 60
    volume += workoutVolume(w)
    sets += workoutSets(w)
    reps += workoutReps(w)
    for (const e of w.exercises) names.add(e.name)
  }
  let prs = 0
  for (const s of stats) for (const x of s.sessions) if (x.isPR && inRange(x.date, r)) prs++
  return {
    workouts: ws.length, hours, volume, sets, reps, avgDuration: ws.length ? (hours * 60) / ws.length : 0,
    perWeek: ws.length / weeks, prs, exercises: names.size,
  }
}

/** Weekly streaks: a week counts if it holds at least one workout. */
export function weekStreaks(ws: Workout[]) {
  if (!ws.length) return { current: 0, longest: 0 }
  const weeks = new Set(ws.map((w) => startOfWeek(w.start).getTime()))
  const sorted = [...weeks].sort((a, b) => a - b)
  let longest = 1, run = 1
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((sorted[i] - sorted[i - 1]) / (7 * DAY))
    run = gap === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  let current = 0
  let wk = startOfWeek(new Date()).getTime()
  if (!weeks.has(wk)) wk -= 7 * DAY // this week not trained yet: still count the streak up to last week
  while (weeks.has(wk)) {
    current++
    wk -= 7 * DAY
  }
  return { current, longest }
}

/* --------------------------------- series ----------------------------------- */

export interface DayCell {
  date: Date
  volume: number
  workouts: number
  titles: string[]
}

export function dailyMap(ws: Workout[]) {
  const m = new Map<string, DayCell>()
  for (const w of ws) {
    const k = dayKey(w.start)
    const c = m.get(k) ?? { date: startOfDay(w.start), volume: 0, workouts: 0, titles: [] }
    c.volume += workoutVolume(w)
    c.workouts++
    c.titles.push(w.title)
    m.set(k, c)
  }
  return m
}

export interface WeekPoint {
  week: number // ms
  volume: number
  sets: number
  workouts: number
  minutes: number
}

export function weekly(ws: Workout[], r: Range): WeekPoint[] {
  const m = new Map<number, WeekPoint>()
  const first = startOfWeek(ws.length ? (ws[0].start > r.from ? ws[0].start : r.from) : r.from).getTime()
  const last = startOfWeek(r.to > new Date() ? new Date() : r.to).getTime()
  for (let wk = first; wk <= last; wk = startOfWeek(new Date(wk + 10 * DAY)).getTime())
    m.set(wk, { week: wk, volume: 0, sets: 0, workouts: 0, minutes: 0 })
  for (const w of ws) {
    const wk = startOfWeek(w.start).getTime()
    const p = m.get(wk) ?? { week: wk, volume: 0, sets: 0, workouts: 0, minutes: 0 }
    p.volume += workoutVolume(w)
    p.sets += workoutSets(w)
    p.workouts++
    p.minutes += w.durationMin
    m.set(wk, p)
  }
  return [...m.values()].sort((a, b) => a.week - b.week)
}

/* -------------------------------- strength ---------------------------------- */

export interface LiftSummary {
  stat: ExerciseStats
  sessions: Session[] // in range
  metric: (s: Session) => number | null
  first: number
  now: number
  best: number
  change: number // fraction
  prs: number
}

export function metricFor(kind: ExerciseKind): (s: Session) => number | null {
  if (kind === 'weighted') return (s) => s.e1rm
  if (kind === 'bodyweight') return (s) => (s.bestReps > 0 ? s.bestReps : null)
  if (kind === 'cardio') return (s) => (s.distanceKm > 0 ? s.distanceKm : null)
  return (s) => (s.durationS > 0 ? s.durationS : null)
}

/** Start = best of first two sessions, now = best of last three. Damps one-off good/bad days. */
export function liftSummaries(stats: ExerciseStats[], r: Range): LiftSummary[] {
  const out: LiftSummary[] = []
  for (const stat of stats) {
    const sessions = stat.sessions.filter((s) => inRange(s.date, r))
    const metric = metricFor(stat.kind)
    const vals = sessions.map(metric).filter((v): v is number => v !== null)
    if (!vals.length) continue
    const first = Math.max(...vals.slice(0, 2))
    const now = Math.max(...vals.slice(-3))
    out.push({
      stat, sessions, metric, first, now, best: Math.max(...vals),
      change: vals.length >= 3 && first > 0 ? now / first - 1 : 0,
      prs: sessions.filter((s) => s.isPR).length,
    })
  }
  return out
}

/** Weeks since the last PR, if the lift is still trained often (4+ sessions in 6 weeks) and that is over 8 weeks. */
export function stalledWeeks(stat: ExerciseStats, now = Date.now()): number | null {
  if (stat.kind !== 'weighted') return null
  const recent = stat.sessions.filter((s) => s.date.getTime() > now - 42 * DAY).length
  const lastPR = [...stat.sessions].reverse().find((s) => s.isPR)
  const since = lastPR ? (now - lastPR.date.getTime()) / DAY : Infinity
  return recent >= 4 && since > 56 && isFinite(since) ? Math.round(since / 7) : null
}

/**
 * Strength index: every weighted lift is indexed to 100 at its first session,
 * then the index is the mean of all lifts' latest values each week.
 */
export function strengthIndex(stats: ExerciseStats[], r: Range) {
  const lifts = stats.filter((s) => s.kind === 'weighted' && s.sessions.filter((x) => x.e1rm).length >= 4)
  if (!lifts.length) return []
  const base = new Map<string, number>()
  const latest = new Map<string, number>()
  const events: { t: number; name: string; v: number }[] = []
  for (const l of lifts) for (const s of l.sessions) if (s.e1rm) events.push({ t: s.date.getTime(), name: l.name, v: s.e1rm })
  events.sort((a, b) => a.t - b.t)
  const points: { week: number; index: number; lifts: number }[] = []
  let i = 0
  const end = startOfWeek(new Date()).getTime()
  // step via +3 days then snap, so DST shifts never skip or repeat a week
  for (let wkN = startOfWeek(new Date(events[0].t)).getTime(); wkN <= end; wkN = startOfWeek(new Date(wkN + 10 * DAY)).getTime()) {
    const next = startOfWeek(new Date(wkN + 10 * DAY)).getTime()
    while (i < events.length && events[i].t < next) {
      const e = events[i++]
      if (!base.has(e.name)) base.set(e.name, e.v)
      // running max so a bad day does not dent the index
      latest.set(e.name, Math.max(latest.get(e.name) ?? 0, e.v))
    }
    if (!latest.size) continue
    let sum = 0
    for (const [n, v] of latest) sum += (v / base.get(n)!) * 100
    if (wkN >= startOfWeek(r.from).getTime() && wkN <= r.to.getTime())
      points.push({ week: wkN, index: sum / latest.size, lifts: latest.size })
  }
  return points
}

/* ------------------------------ muscle balance ------------------------------ */

export function setsByMuscle(ws: Workout[], stats: ExerciseStats[]) {
  const muscleOf = new Map(stats.map((s) => [s.name, s.muscle]))
  const m = new Map<string, { sets: number; volume: number }>()
  for (const w of ws)
    for (const e of w.exercises) {
      const mu = muscleOf.get(e.name) ?? 'Other'
      const c = m.get(mu) ?? { sets: 0, volume: 0 }
      for (const s of e.sets)
        if (isWorking(s)) {
          c.sets++
          if (s.weightKg && s.reps) c.volume += s.weightKg * s.reps
        }
      m.set(mu, c)
    }
  return [...m.entries()].map(([muscle, v]) => ({ muscle, group: MUSCLES[muscle]?.group ?? 'Other', ...v })).sort((a, b) => b.sets - a.sets)
}

export function weeklyGroupSets(ws: Workout[], stats: ExerciseStats[], r: Range) {
  const groupOf = new Map(stats.map((s) => [s.name, s.group as Group]))
  const weeks = weekly(ws, r).map((w) => ({ week: w.week, ...Object.fromEntries(GROUPS.map((g) => [g, 0])) })) as ({ week: number } & Record<Group, number>)[]
  const idx = new Map(weeks.map((w, i) => [w.week, i]))
  for (const w of ws) {
    const i = idx.get(startOfWeek(w.start).getTime())
    if (i === undefined) continue
    for (const e of w.exercises) {
      const g = groupOf.get(e.name) ?? 'Other'
      weeks[i][g] += e.sets.filter(isWorking).length
    }
  }
  return weeks
}

export function splitShare(ws: Workout[], stats: ExerciseStats[]) {
  const splitOf = new Map(stats.map((s) => [s.name, (MUSCLES[s.muscle]?.split ?? 'Other') as Split]))
  const m: Record<Split, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0, Cardio: 0, Other: 0 }
  for (const w of ws) for (const e of w.exercises) m[splitOf.get(e.name) ?? 'Other'] += e.sets.filter(isWorking).length
  return m
}

/* ---------------------------------- habits ---------------------------------- */

export function habits(ws: Workout[]) {
  const dow = Array.from({ length: 7 }, (_, i) => ({ day: i, workouts: 0, minutes: 0 }))
  const hour = Array.from({ length: 24 }, (_, i) => ({ hour: i, workouts: 0 }))
  for (const w of ws) {
    const d = (w.start.getDay() + 6) % 7
    dow[d].workouts++
    dow[d].minutes += w.durationMin
    hour[w.start.getHours()].workouts++
  }
  const buckets = [
    { label: '1 day', min: 0, max: 1.5 },
    { label: '2 days', min: 1.5, max: 2.5 },
    { label: '3 days', min: 2.5, max: 3.5 },
    { label: '4–6', min: 3.5, max: 6.5 },
    { label: '1–2 wks', min: 6.5, max: 13.5 },
    { label: '2+ wks', min: 13.5, max: Infinity },
  ].map((b) => ({ ...b, count: 0 }))
  const days = [...new Set(ws.map((w) => startOfDay(w.start).getTime()))].sort((a, b) => a - b)
  let longestGap = 0
  for (let i = 1; i < days.length; i++) {
    const g = Math.round((days[i] - days[i - 1]) / DAY)
    longestGap = Math.max(longestGap, g)
    const b = buckets.find((b) => g >= b.min && g < b.max)
    if (b) b.count++
  }
  const durations = ws.map((w) => ({ t: w.start.getTime(), minutes: Math.round(w.durationMin), title: w.title }))
  return { dow, hour, gaps: buckets, longestGap, durations }
}

export function monthly(ws: Workout[]) {
  const m = new Map<string, { month: Date; workouts: number; volume: number }>()
  for (const w of ws) {
    const k = `${w.start.getFullYear()}-${w.start.getMonth()}`
    const c = m.get(k) ?? { month: new Date(w.start.getFullYear(), w.start.getMonth(), 1), workouts: 0, volume: 0 }
    c.workouts++
    c.volume += workoutVolume(w)
    m.set(k, c)
  }
  return [...m.values()].sort((a, b) => a.month.getTime() - b.month.getTime())
}
