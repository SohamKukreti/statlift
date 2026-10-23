import type { Row } from './parse'

/** Seeded random so the demo looks the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

interface Lift {
  name: string
  start: number // kg
  gain: number // kg per month
  step: number
  reps: [number, number]
  sets: number
  bodyweight?: boolean
}

const PLAN: Record<string, Lift[]> = {
  Push: [
    { name: 'Bench Press (Barbell)', start: 50, gain: 2.2, step: 2.5, reps: [5, 8], sets: 4 },
    { name: 'Incline Bench Press (Dumbbell)', start: 18, gain: 0.8, step: 2, reps: [8, 12], sets: 3 },
    { name: 'Overhead Press (Barbell)', start: 30, gain: 1.2, step: 2.5, reps: [5, 8], sets: 3 },
    { name: 'Lateral Raise (Dumbbell)', start: 7, gain: 0.35, step: 1, reps: [12, 15], sets: 4 },
    { name: 'Triceps Pushdown', start: 25, gain: 1, step: 2.5, reps: [10, 12], sets: 3 },
    { name: 'Chest Dip', start: 0, gain: 0, step: 0, reps: [8, 14], sets: 3, bodyweight: true },
  ],
  Pull: [
    { name: 'Deadlift (Barbell)', start: 80, gain: 3.5, step: 5, reps: [3, 5], sets: 3 },
    { name: 'Pull Up', start: 0, gain: 0, step: 0, reps: [5, 12], sets: 3, bodyweight: true },
    { name: 'Bent Over Row (Barbell)', start: 45, gain: 1.8, step: 2.5, reps: [6, 10], sets: 4 },
    { name: 'Lat Pulldown (Cable)', start: 45, gain: 1.5, step: 2.5, reps: [8, 12], sets: 3 },
    { name: 'Face Pull', start: 15, gain: 0.6, step: 2.5, reps: [12, 15], sets: 3 },
    { name: 'Bicep Curl (Dumbbell)', start: 10, gain: 0.5, step: 1, reps: [8, 12], sets: 3 },
  ],
  Legs: [
    { name: 'Squat (Barbell)', start: 60, gain: 3, step: 2.5, reps: [5, 8], sets: 4 },
    { name: 'Romanian Deadlift (Barbell)', start: 50, gain: 2, step: 2.5, reps: [8, 10], sets: 3 },
    { name: 'Leg Press (Machine)', start: 100, gain: 5, step: 10, reps: [10, 12], sets: 3 },
    { name: 'Seated Leg Curl (Machine)', start: 30, gain: 1, step: 2.5, reps: [10, 12], sets: 3 },
    { name: 'Standing Calf Raise', start: 40, gain: 1.5, step: 5, reps: [12, 15], sets: 4 },
    { name: 'Hanging Leg Raise', start: 0, gain: 0, step: 0, reps: [8, 15], sets: 3, bodyweight: true },
  ],
}

const pad = (n: number) => String(n).padStart(2, '0')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const hevyDate = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`

/** ~10 months of a made-up lifter on push / pull / legs, with a holiday and a plateau or two. */
export function sampleRows(): Row[] {
  const rand = rng(42)
  const rows: Row[] = []
  const end = new Date()
  const start = new Date(end.getTime() - 300 * 86400000)
  const order = ['Push', 'Pull', 'Legs'] as const
  let k = 0
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const daysIn = (d.getTime() - start.getTime()) / 86400000
    if (daysIn > 150 && daysIn < 166) continue // holiday
    const dow = d.getDay()
    const p = dow === 0 ? 0.08 : dow === 6 ? 0.35 : 0.62
    if (rand() > p) continue
    const split = order[k++ % 3]
    const st = new Date(d)
    st.setHours(dow === 6 ? 10 : rand() < 0.7 ? 18 : 7, Math.floor(rand() * 60))
    const months = daysIn / 30
    const title = `${split} day`
    const first = rows.length
    let minutes = 0
    for (const l of PLAN[split]) {
      // diminishing returns + small plateau phases
      const prog = l.gain * (months - Math.max(0, months - 6) * 0.55)
      const wobble = (rand() - 0.5) * l.step
      const target = l.bodyweight ? 0 : Math.max(l.step, Math.round((l.start + prog + wobble) / l.step) * l.step)
      const warm = !l.bodyweight && l.start >= 40
      if (warm) {
        rows.push(row(title, st, l.name, 0, 'warmup', Math.round((target * 0.5) / l.step) * l.step, 10))
      }
      for (let s = 0; s < l.sets; s++) {
        const [lo, hi] = l.reps
        const bwBoost = l.bodyweight ? Math.min(hi, lo + Math.floor(months * 0.6)) : hi
        const reps = Math.max(1, Math.round(lo + rand() * (bwBoost - lo)) - s)
        rows.push(row(title, st, l.name, s + (warm ? 1 : 0), 'normal', l.bodyweight ? null : target, reps))
      }
      minutes += l.sets * 3.2 + rand() * 4
    }
    if (rand() < 0.15) {
      const km = Math.round((2 + rand() * 3) * 10) / 10
      rows.push({ ...row(title, st, 'Treadmill', 0, 'normal', null, null), distance_km: String(km), duration_seconds: String(Math.round(km * 340)) })
      minutes += 15
    }
    const en = new Date(st.getTime() + minutes * 60000)
    for (let i = first; i < rows.length; i++) rows[i].end_time = hevyDate(en)
  }
  return rows
}

function row(title: string, st: Date, ex: string, idx: number, type: string, w: number | null, reps: number | null): Row {
  return {
    title, start_time: hevyDate(st), end_time: '', description: '', exercise_title: ex, superset_id: '', exercise_notes: '',
    set_index: String(idx), set_type: type, weight_kg: w === null ? '' : String(w), reps: reps === null ? '' : String(reps),
    distance_km: '', duration_seconds: '', rpe: '',
  }
}
