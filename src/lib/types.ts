export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure'

export interface WorkSet {
  index: number
  type: SetType
  weightKg: number | null
  reps: number | null
  distanceKm: number | null
  durationS: number | null
  rpe: number | null
}

export interface ExerciseEntry {
  name: string
  notes: string
  sets: WorkSet[]
}

export interface Workout {
  id: string
  title: string
  start: Date
  end: Date
  durationMin: number
  exercises: ExerciseEntry[]
}

export type Unit = 'kg' | 'lbs'

export interface Dataset {
  workouts: Workout[] // sorted oldest -> newest
  sourceUnit: Unit
  fileName: string
  isSample: boolean
}

/** How an exercise is measured. */
export type ExerciseKind = 'weighted' | 'bodyweight' | 'cardio' | 'timed'

/** One exercise, one workout, boiled down. */
export interface Session {
  workoutId: string
  date: Date
  e1rm: number | null // kg
  topWeight: number | null // kg
  topWeightReps: number | null
  volume: number // kg x reps, working sets
  totalReps: number
  bestReps: number
  sets: number
  distanceKm: number
  durationS: number
  workSets: WorkSet[]
  isPR: boolean
}

export interface ExerciseStats {
  name: string
  kind: ExerciseKind
  muscle: string
  group: string
  sessions: Session[] // all-time, oldest -> newest
}
