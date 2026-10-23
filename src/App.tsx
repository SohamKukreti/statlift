import { lazy, Suspense, type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildExerciseStats, DAY, filterWorkouts, startOfDay, type Range } from './lib/analytics'
import { clearCsv, loadCsv, parseCsvText, rowsToDataset, saveCsv } from './lib/parse'
import { loadOverrides, saveOverrides } from './lib/muscles'
import { go, useRoute } from './lib/route'
import { sampleRows } from './lib/sample'
import { AppCtx, pref, setPref, type Preset } from './lib/store'
import { CHART, ThemeCtx, type Mode } from './lib/theme'
import type { Dataset, Unit } from './lib/types'
import { Icon, Seg } from './components/ui'
import { Logo } from './components/Logo'
import { SketchDefs, useSketchBoxes } from './components/Sketch'
import { Landing } from './screens/Landing'
import { Home } from './screens/Home'

// Home loads with the app. The other screens download in the background once it shows, so the first visit is quicker.
const loaders: (() => Promise<unknown>)[] = []
const prefetch = () => loaders.forEach((load) => load())

/** A screen loaded on demand. Once its code is in, it renders at once: React holds a just-loaded lazy screen back ~300ms. */
function screen<P extends object>(load: () => Promise<Record<string, unknown>>, name: string) {
  let Ready: ComponentType<P> | null = null
  const get = () => load().then((m) => (Ready = m[name] as ComponentType<P>))
  loaders.push(get)
  const Lazy = lazy(() => get().then((c) => ({ default: c })))
  return (props: P) => (Ready ? <Ready {...props} /> : <Lazy {...props} />)
}
const Lift = screen<{ name: string }>(() => import('./screens/Lift'), 'Lift')
const Lifts = screen(() => import('./screens/Lifts'), 'Lifts')
const Records = screen(() => import('./screens/Records'), 'Records')
const Calendar = screen(() => import('./screens/Calendar'), 'Calendar')
const Balance = screen(() => import('./screens/Balance'), 'Balance')
const Habits = screen(() => import('./screens/Habits'), 'Habits')
const Watch = screen(() => import('./screens/Watch'), 'Watch')
const Compare = screen(() => import('./screens/Compare'), 'Compare')
const ShareModal = screen<{ onClose: () => void }>(() => import('./components/Share'), 'ShareModal')

type Font = 'hand' | 'plain'

const fromInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}


export default function App() {
  const [mode, setMode] = useState<Mode>(() => pref<Mode>('theme', 'light')) // light unless the user picks dark
  useSketchBoxes()
  const [font, setFont] = useState<Font>(() => pref<Font>('font', 'hand'))
  useEffect(() => {
    document.documentElement.dataset.font = font
    setPref('font', font)
  }, [font])
  const [data, setData] = useState<Dataset | null>(null)
  const [booting, setBooting] = useState(true) // reading the saved file back
  const [unit, setUnit] = useState<Unit>(() => pref<Unit>('unit', 'kg'))
  const [preset, setPreset] = useState<Preset>(() => pref<Preset>('range2', 'all'))
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>(loadOverrides)
  const [sharing, setSharing] = useState(false)
  const [menu, setMenu] = useState(false)
  const route = useRoute()
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])
  useEffect(() => {
    if (!data) return
    const id = setTimeout(prefetch, 1500)
    return () => clearTimeout(id)
  }, [data])
  useEffect(() => {
    loadCsv()
      .then((saved) => {
        if (!saved) return
        try {
          const d = parseCsvText(saved.text, saved.name)
          setData(d)
          setUnit(pref<Unit>('unit', d.sourceUnit))
        } catch {
          clearCsv()
        }
      })
      .finally(() => setBooting(false))
  }, [])
  useEffect(() => {
    if (!booting) setPref('unit', unit)
  }, [unit, booting])
  useEffect(() => {
    if (preset !== 'custom') setPref('range2', preset)
  }, [preset])
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest('.menu-wrap') && setMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menu])

  const all = useMemo(() => data?.workouts ?? [], [data])
  const stats = useMemo(() => buildExerciseStats(all, overrides), [all, overrides])

  const range: Range = useMemo(() => {
    const first = all[0]?.start ?? new Date()
    const end = new Date(Math.max(Date.now(), all.at(-1)?.start.getTime() ?? 0))
    const to = new Date(startOfDay(end).getTime() + DAY - 1)
    if (preset === 'custom' && custom) return { from: fromInput(custom.from), to: new Date(fromInput(custom.to).getTime() + DAY - 1) }
    if (preset === 'all' || preset === 'custom') return { from: startOfDay(first), to }
    return { from: new Date(startOfDay(new Date()).getTime() - (+preset - 1) * DAY), to }
  }, [preset, custom, all])

  const ws = useMemo(() => filterWorkouts(all, range), [all, range])

  const setOverride = useCallback((ex: string, muscle: string | null) => {
    setOverrides((o) => {
      const n = { ...o }
      if (muscle === null) delete n[ex]
      else n[ex] = muscle
      saveOverrides(n)
      return n
    })
  }, [])

  const onCsv = (text: string, name: string) => {
    const d = parseCsvText(text, name) // throws ParseError with a readable message
    saveCsv(text, name)
    setData(d)
    setUnit(d.sourceUnit)
    go('')
  }
  const onSample = () => {
    setData(rowsToDataset(sampleRows(), 'sample.csv', true))
    go('')
  }
  const reset = () => {
    clearCsv()
    setData(null)
    setMenu(false)
    go('')
  }
  const toggleMode = () => {
    const m = mode === 'dark' ? 'light' : 'dark'
    setMode(m)
    setPref('theme', m)
  }

  const themeBtn = (
    <button className="ghost icon" onClick={toggleMode} aria-label={mode === 'dark' ? 'Use light mode' : 'Use dark mode'}>
      {mode === 'dark' ? <Icon.sun /> : <Icon.moon />}
    </button>
  )

  return (
    <ThemeCtx.Provider value={CHART[mode]}>
      <SketchDefs />
      <div className="page">
        {booting ? null : !data ? (
          <>
            <header className="top">
              <span className="wordmark"><Logo /> Statlift</span>
              {themeBtn}
            </header>
            <Landing onCsv={onCsv} onSample={onSample} />
          </>
        ) : (
          <AppCtx.Provider value={{ data, stats, all, ws, range, preset, setPreset, custom, setCustom, unit, overrides, setOverride }}>
            <header className="top">
              <button className="wordmark" onClick={() => go('')}><Logo /> Statlift</button>
              <button className="ghost" onClick={() => setSharing(true)}><Icon.share /> <span className="lbl">Share</span></button>
              {themeBtn}
              <div className="menu-wrap">
                <button className="ghost icon" onClick={() => setMenu(!menu)} aria-label="Settings" aria-expanded={menu}><Icon.gear /></button>
                {menu && (
                  <div className="menu" role="menu">
                    <div className="menu-row">
                      Units
                      <Seg value={unit} onChange={setUnit} options={[{ v: 'kg', label: 'kg' }, { v: 'lbs', label: 'lb' }]} />
                    </div>
                    <div className="menu-row">
                      Font
                      <Seg value={font} onChange={setFont} options={[{ v: 'hand', label: 'Hand' }, { v: 'plain', label: 'Plain' }]} />
                    </div>
                    <hr />
                    <button className="item" onClick={() => fileInput.current?.click()}>Load a different file</button>
                    <button className="item danger" onClick={reset}>Remove my data from this browser</button>
                  </div>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      onCsv(await f.text(), f.name)
                      setMenu(false)
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Could not read this file.')
                    }
                    e.target.value = ''
                  }}
                />
              </div>
            </header>

            {data.isSample && (
              <div className="sample-note">
                <span>This is made-up sample data.</span>
                <button className="btn" onClick={reset}>Use my own file</button>
              </div>
            )}

            <main>
              <Suspense fallback={null}>
              {route.page === 'home' && <Home />}
              {route.page === 'lift' && <Lift name={route.name} />}
              {route.page === 'lifts' && <Lifts />}
              {route.page === 'records' && <Records />}
              {route.page === 'calendar' && <Calendar />}
              {route.page === 'balance' && <Balance />}
              {route.page === 'habits' && <Habits />}
              {route.page === 'watch' && <Watch />}
              {route.page === 'compare' && <Compare />}
              </Suspense>
            </main>

            <footer className="foot">Your file stays in this browser. Nothing is uploaded.</footer>
            {sharing && <Suspense fallback={null}><ShareModal onClose={() => setSharing(false)} /></Suspense>}
          </AppCtx.Provider>
        )}
      </div>
    </ThemeCtx.Provider>
  )
}
