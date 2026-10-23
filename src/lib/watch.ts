import type { ExerciseStats, Session, Unit, Workout } from './types'
import { DAY, isWorking, stalledWeeks, startOfDay } from './analytics'
import { GROUPS, MUSCLES } from './muscles'
import { fmtWeight } from './format'

export type WatchKind = 'stalled' | 'fast' | 'heavy' | 'backwards' | 'balance' | 'load'

export interface Watch {
  kind: WatchKind
  subject: string // the lift or body part
  stat: string // the one number that matters, shown big
  statLabel: string // what that number means
  body: string // the problem, in 3 or 4 words
  tip: string // what to do, short
  lift?: string
}

export const KIND_TITLE: Record<WatchKind, string> = {
  stalled: 'Stalled lifts',
  backwards: 'Going backwards',
  heavy: 'More weight, fewer reps',
  fast: 'Weight going up too fast',
  load: 'Training load',
  balance: 'Balance',
}
export const KIND_ORDER: WatchKind[] = ['backwards', 'heavy', 'fast', 'stalled', 'load', 'balance']

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
const avgReps = (s: Session) => {
  const r = s.workSets.filter((x) => (x.reps ?? 0) > 0 && (x.weightKg ?? 0) > 0)
  return r.length ? r.reduce((n, x) => n + (x.reps ?? 0), 0) / r.length : 0
}
const pctTxt = (f: number) => `${Math.round(Math.abs(f) * 100)}%`

/** Kinds that need action now, not just watching. */
export const URGENT: WatchKind[] = ['backwards', 'heavy', 'fast']

/** Different advice per stalled lift, so the list does not repeat one line. Very long stalls get a swap. */
const STALL_TIPS = [
  'Try 6 to 8 reps for 4 weeks.',
  'Add one set for 4 weeks.',
  'Take a light week, then push.',
  'Rest 2 to 3 minutes between sets.',
]
function stallTip(weeks: number, n: number) {
  if (weeks >= 26) return 'Swap to a similar lift for a month.'
  return STALL_TIPS[n % STALL_TIPS.length]
}

/**
 * Plain rules over the log, as of today. All windows look back from now,
 * so the date range picked elsewhere does not change what shows here.
 */
export function watchOuts(all: Workout[], stats: ExerciseStats[], unit: Unit, now = Date.now()): Watch[] {
  const out: Watch[] = []
  const weighted = stats.filter((s) => s.kind === 'weighted')
  const flagged = new Set<string>()

  // going backwards: best e1RM in the last 4 weeks is 5%+ under the 8 weeks before
  for (const s of weighted) {
    const recent = s.sessions.filter((x) => x.e1rm && x.date.getTime() > now - 28 * DAY)
    const before = s.sessions.filter((x) => x.e1rm && x.date.getTime() <= now - 28 * DAY && x.date.getTime() > now - 84 * DAY)
    if (recent.length < 3 || before.length < 3) continue
    const r = Math.max(...recent.map((x) => x.e1rm!)), b = Math.max(...before.map((x) => x.e1rm!))
    if (r < b * 0.95) {
      flagged.add(s.name)
      out.push({
        kind: 'backwards', lift: s.name,
        subject: s.name, stat: `-${pctTxt(r / b - 1)}`, statLabel: 'in 4 weeks',
        body: 'Your best lifts are dropping',
        tip: 'Check sleep and food, then take a light week.',
      })
    }
  }

  for (const s of weighted) {
    const ses = s.sessions
    if (ses.length < 5) continue
    const last = ses[ses.length - 1]
    if (last.date.getTime() < now - 21 * DAY || !last.topWeight || !last.e1rm) continue
    const prev = ses.slice(-5, -1).filter((x) => x.topWeight && x.e1rm)
    if (prev.length < 3) continue

    // more weight, fewer reps: load up 7.5%+, reps down 25%+, and no real gain in the estimate
    const wPrev = median(prev.map((x) => x.topWeight!))
    const rPrev = median(prev.map(avgReps))
    const ePrev = median(prev.map((x) => x.e1rm!))
    const rNow = avgReps(last)
    const noGain = last.topWeight >= wPrev * 1.075 && rPrev > 0 && rNow <= rPrev * 0.75 && last.e1rm <= ePrev * 1.02
    const outOfRange = last.topWeight >= wPrev * 1.1 && rPrev >= 8 && rNow < 5 // far below your usual rep range
    if (noGain || outOfRange) {
      flagged.add(s.name)
      out.push({
        kind: 'heavy', lift: s.name,
        subject: s.name, stat: `${Math.round(rPrev)}→${Math.round(rNow)}`, statLabel: 'reps per set',
        body: 'Weight up, reps down',
        tip: 'Go back to the old weight and add reps.',
      })
      continue
    }

    // too fast: top weight in the last 2 weeks is 10%+ over anything in the 4 weeks before
    const last2 = ses.filter((x) => x.topWeight && x.date.getTime() > now - 14 * DAY)
    const base = ses.filter((x) => x.topWeight && x.date.getTime() <= now - 14 * DAY && x.date.getTime() > now - 42 * DAY)
    if (last2.length && base.length >= 2) {
      const w = Math.max(...last2.map((x) => x.topWeight!)), b = Math.max(...base.map((x) => x.topWeight!))
      if (w >= b * 1.1 && w - b >= 2) {
        flagged.add(s.name)
        out.push({
          kind: 'fast', lift: s.name,
          subject: s.name, stat: `+${pctTxt(w / b - 1)}`, statLabel: 'weight in 2 weeks',
          body: 'Weight jumped too fast',
          tip: 'Stay at this weight until every set hits your reps.',
        })
      }
    }
  }

  // stalled: no new best in 8+ weeks, or the exact same top set 4 sessions running
  let stallN = 0
  const byStall = weighted.map((s) => ({ s, wk: stalledWeeks(s, now) })).sort((a, b) => (b.wk ?? 0) - (a.wk ?? 0))
  for (const { s, wk } of byStall) {
    if (flagged.has(s.name)) continue
    const tail = s.sessions.slice(-4)
    const same = tail.length === 4 && tail[0].date.getTime() > now - 56 * DAY && tail.every((x) => x.topWeight === tail[0].topWeight && x.topWeightReps === tail[0].topWeightReps)
    if (wk)
      out.push({
        kind: 'stalled', lift: s.name,
        subject: s.name, stat: String(wk), statLabel: 'weeks, no new best',
        body: 'No new best lately',
        tip: stallTip(wk, stallN++),
      })
    else if (same)
      out.push({
        kind: 'stalled', lift: s.name,
        subject: s.name, stat: '4×', statLabel: 'same top set',
        body: `Same ${fmtWeight(tail[0].topWeight, unit)} × ${tail[0].topWeightReps} every time`,
        tip: 'Add one rep next time.',
      })
  }

  /* ---------------- load and balance, from sets per body group ---------------- */

  const groupOf = new Map(stats.map((s) => [s.name, s.group]))
  const muscleOf = new Map(stats.map((s) => [s.name, s.muscle]))
  const groupSets = (from: number, to: number) => {
    const m = new Map<string, number>()
    for (const w of all) {
      const t = w.start.getTime()
      if (t <= from || t > to) continue
      for (const e of w.exercises) {
        const g = groupOf.get(e.name) ?? 'Other'
        m.set(g, (m.get(g) ?? 0) + e.sets.filter(isWorking).length)
      }
    }
    return m
  }
  const recent = all.filter((w) => w.start.getTime() > now - 56 * DAY)

  // weekly sets jump: last 7 days vs your usual week (median of trained weeks in the 8 before),
  // and more than any of those weeks, so coming back from a light patch does not count
  const thisWeek = groupSets(now - 7 * DAY, now)
  const priorWeeks = Array.from({ length: 8 }, (_, i) => groupSets(now - (i + 2) * 7 * DAY, now - (i + 1) * 7 * DAY))
  const spikes: { g: string; cur: number; usual: number }[] = []
  for (const g of GROUPS) {
    if (g === 'Cardio' || g === 'Other') continue
    const cur = thisWeek.get(g) ?? 0
    const weeks = priorWeeks.map((m) => m.get(g) ?? 0).filter((n) => n > 0)
    if (weeks.length < 4) continue
    const usual = median(weeks)
    if (cur >= usual * 1.3 && cur > Math.max(...weeks) && cur - usual >= 4) spikes.push({ g, cur, usual })
  }
  for (const x of spikes)
    out.push({
      kind: 'load',
      subject: x.g, stat: `+${pctTxt(x.cur / x.usual - 1)}`, statLabel: 'sets this week',
      body: 'Sets jumped this week',
      tip: 'Add 2 to 4 sets a week at most.',
    })

  // weekly sets per body group over the last 4 weeks: too few or too many
  if (recent.length >= 4) {
    const last4 = groupSets(now - 28 * DAY, now)
    const trainedBefore = groupSets(0, now - 28 * DAY)
    for (const g of ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs']) {
      const perWeek = (last4.get(g) ?? 0) / 4
      if ((trainedBefore.get(g) ?? 0) >= 20 && perWeek < 6 && perWeek > 0)
        out.push({
          kind: 'load',
          subject: g, stat: perWeek.toFixed(1), statLabel: 'sets a week',
          body: 'Too few sets',
          tip: 'Aim for 10 to 20 sets a week.',
        })
    }
    const mSets = new Map<string, number>()
    for (const w of all) {
      if (w.start.getTime() <= now - 28 * DAY) continue
      for (const e of w.exercises) {
        const mu = muscleOf.get(e.name) ?? 'Other'
        mSets.set(mu, (mSets.get(mu) ?? 0) + e.sets.filter(isWorking).length)
      }
    }
    for (const [mu, n] of mSets)
      if (mu !== 'Cardio' && mu !== 'Other' && n / 4 > 25)
        out.push({
          kind: 'load',
          subject: mu, stat: String(Math.round(n / 4)), statLabel: 'sets a week',
          body: 'Too many sets',
          tip: 'Move a few sets to another muscle.',
        })
  }

  // push / pull / legs over the last 8 weeks
  const split = { Push: 0, Pull: 0, Legs: 0 }
  for (const w of recent)
    for (const e of w.exercises) {
      const sp = MUSCLES[muscleOf.get(e.name) ?? 'Other']?.split
      if (sp === 'Push' || sp === 'Pull' || sp === 'Legs') split[sp] += e.sets.filter(isWorking).length
    }
  const tot = split.Push + split.Pull + split.Legs
  if (tot >= 60) {
    const ratio = split.Pull ? split.Push / split.Pull : Infinity
    if (ratio > 1.25)
      out.push({
        kind: 'balance',
        subject: 'Push and pull', stat: `+${Math.round((ratio - 1) * 100)}%`, statLabel: 'more push than pull',
        body: 'More pushing than pulling',
        tip: 'Add rows or pulldowns.',
      })
    const legs = split.Legs / tot
    if (legs < 0.2)
      out.push({
        kind: 'balance',
        subject: 'Legs', stat: `${Math.round(legs * 100)}%`, statLabel: 'of your sets',
        body: 'Too little leg work',
        tip: 'Make a quarter of your sets legs.',
      })
  }

  // body groups you usually train but have not touched for 9+ days
  const lastSeen = new Map<string, number>(), count = new Map<string, number>()
  for (const w of all)
    for (const e of w.exercises) {
      const g = groupOf.get(e.name) ?? 'Other'
      lastSeen.set(g, Math.max(lastSeen.get(g) ?? 0, w.start.getTime()))
      count.set(g, (count.get(g) ?? 0) + 1)
    }
  const today = startOfDay(new Date(now)).getTime()
  const lastWorkout = all.at(-1)?.start.getTime() ?? 0
  const sinceAny = Math.floor((today - startOfDay(new Date(lastWorkout)).getTime()) / DAY)
  if (sinceAny >= 10) {
    out.push({
      kind: 'load',
      subject: 'All training', stat: String(sinceAny), statLabel: 'days since last workout',
      body: 'Long break from training',
      tip: 'Start back 10% lighter.',
    })
  } else {
    for (const g of GROUPS) {
      if (g === 'Cardio' || g === 'Other' || (count.get(g) ?? 0) < 8) continue
      const days = Math.floor((today - startOfDay(new Date(lastSeen.get(g)!)).getTime()) / DAY)
      if (days >= 9)
        out.push({
          kind: 'balance',
          subject: g, stat: String(days), statLabel: 'days since trained',
          body: 'Not trained lately',
          tip: 'Train it twice a week.',
        })
    }
  }

  return out.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}
