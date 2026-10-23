/** Muscle -> body group -> split (push / pull / legs). */
export const MUSCLES: Record<string, { group: Group; split: Split }> = {
  Chest: { group: 'Chest', split: 'Push' },
  'Front Delts': { group: 'Shoulders', split: 'Push' },
  'Side Delts': { group: 'Shoulders', split: 'Push' },
  'Rear Delts': { group: 'Shoulders', split: 'Pull' },
  Triceps: { group: 'Arms', split: 'Push' },
  Biceps: { group: 'Arms', split: 'Pull' },
  Forearms: { group: 'Arms', split: 'Pull' },
  Lats: { group: 'Back', split: 'Pull' },
  'Upper Back': { group: 'Back', split: 'Pull' },
  Traps: { group: 'Back', split: 'Pull' },
  'Lower Back': { group: 'Back', split: 'Pull' },
  Quads: { group: 'Legs', split: 'Legs' },
  Hamstrings: { group: 'Legs', split: 'Legs' },
  Glutes: { group: 'Legs', split: 'Legs' },
  Adductors: { group: 'Legs', split: 'Legs' },
  Abductors: { group: 'Legs', split: 'Legs' },
  Calves: { group: 'Legs', split: 'Legs' },
  Abs: { group: 'Core', split: 'Core' },
  Obliques: { group: 'Core', split: 'Core' },
  Cardio: { group: 'Cardio', split: 'Cardio' },
  'Full Body': { group: 'Other', split: 'Other' },
  Other: { group: 'Other', split: 'Other' },
}

export type Group = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core' | 'Cardio' | 'Other'
export type Split = 'Push' | 'Pull' | 'Legs' | 'Core' | 'Cardio' | 'Other'

/** Fixed order = fixed colour slot. Never re-sorted by value. */
export const GROUPS: Group[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other']
export const SPLITS: Split[] = ['Push', 'Pull', 'Legs']
export const MUSCLE_NAMES = Object.keys(MUSCLES)

/** Ordered keyword rules. First match wins, so specific rules come first. */
const RULES: [RegExp, string][] = [
  [/treadmill|running|^run\b|jog|cycling|bike|elliptical|stair|rowing machine|rower|ergometer|walk|swim|jump rope|skipping|hiit|sprint/i, 'Cardio'],
  [/leg curl|hamstring|nordic|glute ham|romanian|rdl|stiff leg|good morning/i, 'Hamstrings'],
  [/hip thrust|glute|kickback \(machine\)|donkey|frog pump/i, 'Glutes'],
  [/abduction/i, 'Abductors'],
  [/adduction|adductor|copenhagen/i, 'Adductors'],
  [/calf|calves/i, 'Calves'],
  [/back extension|hyperextension|superman|reverse hyper/i, 'Lower Back'],
  [/deadlift/i, 'Hamstrings'],
  [/squat|leg press|leg extension|lunge|step up|hack|wall sit|sissy|pistol|single leg extension/i, 'Quads'],
  [/rear delt|reverse fly|reverse pec|face pull/i, 'Rear Delts'],
  [/lateral raise|side raise|upright row|y raise/i, 'Side Delts'],
  [/shrug/i, 'Traps'],
  [/shoulder press|overhead press|military|arnold|front raise|push press|landmine press/i, 'Front Delts'],
  [/tricep|pushdown|pressdown|skull|close grip bench|jm press|kickback|dip/i, 'Triceps'],
  [/wrist|forearm|farmer|grip|reverse curl/i, 'Forearms'],
  [/curl|chin up/i, 'Biceps'],
  [/pulldown|pull ?up|pullover|straight arm|lat /i, 'Lats'],
  [/row|t-bar|rack pull/i, 'Upper Back'],
  [/bench|chest|fly|flye|crossover|push ?up|pec deck|incline press|decline press/i, 'Chest'],
  [/oblique|russian twist|side plank|wood ?chop|pallof/i, 'Obliques'],
  [/crunch|plank|sit ?up|ab |abs|leg raise|knee raise|hollow|dead bug|rollout|v up|toes to bar/i, 'Abs'],
  [/clean|snatch|thruster|burpee|kettlebell swing|turkish/i, 'Full Body'],
]

const OVERRIDE_KEY = 'liftlog:muscleOverrides'

export function loadOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveOverrides(o: Record<string, string>) {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o))
  } catch {
    /* ignore */
  }
}

export function guessMuscle(name: string): string {
  for (const [re, m] of RULES) if (re.test(name)) return m
  return 'Other'
}

export function muscleFor(name: string, overrides: Record<string, string>): string {
  return overrides[name] ?? guessMuscle(name)
}
