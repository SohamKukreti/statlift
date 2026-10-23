import { useMemo, useState } from 'react'
import { Back, Seg } from '../components/ui'
import { rankLifts, type Ranked } from '../lib/compare'
import { fmtWeight, toUnit } from '../lib/format'
import { go, liftPath } from '../lib/route'
import { LEVEL_NAMES, LEVEL_PCT, NORMS, STRENGTH_LEVEL, STUDY, type Sex } from '../lib/standards'
import { pref, setPref, useApp } from '../lib/store'

const LB = 0.45359237

/** Your profile for the comparison. It is kept in this browser only. */
export function useProfile() {
  const [sex, setSexS] = useState<Sex>(() => pref<Sex>('sex', 'male'))
  const [bw, setBwS] = useState(() => Number(pref('bodyweightKg', '0')) || 0)
  const [age, setAgeS] = useState(() => Number(pref('age', '0')) || 0)
  return {
    sex, bw, age,
    setSex: (v: Sex) => { setSexS(v); setPref('sex', v) },
    setBw: (kg: number) => { setBwS(kg); setPref('bodyweightKg', String(kg || '')) },
    setAge: (v: number) => { setAgeS(v); setPref('age', String(v || '')) },
  }
}

export function Compare() {
  const { stats, unit } = useApp()
  const p = useProfile()
  const { sex, bw, age } = p
  const ranked = useMemo(() => (bw > 0 ? rankLifts(stats, { sex, bodyweightKg: bw, age: age || null }) : []), [stats, sex, bw, age])
  const mid = ranked.length ? [...ranked].sort((a, b) => a.pct - b.pct)[Math.floor(ranked.length / 2)].pct : 0
  const [bwText, setBwText] = useState(() => (p.bw ? String(Math.round(toUnit(p.bw, unit) * 10) / 10) : ''))

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">{ranked.length ? `Stronger than ${Math.round(mid)}% of lifters` : 'How you compare'}</h1>
          <p className="lede">
            {ranked.length
              ? `On a typical lift of yours, against ${p.sex === 'male' ? 'men' : 'women'} at your bodyweight who log their lifts.`
              : 'Your best lifts against real data from other lifters at your bodyweight.'}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2 className="h2">About you</h2>
        <p className="sub">Strength depends on sex and bodyweight. This stays in this browser.</p>
        <div className="cmp-form">
          <label>
            <span>Sex</span>
            <Seg value={p.sex} onChange={p.setSex} options={[{ v: 'male', label: 'Male' }, { v: 'female', label: 'Female' }]} />
          </label>
          <label>
            <span>Bodyweight</span>
            <span className="cmp-in">
              <input
                className="search" inputMode="decimal" value={bwText} placeholder={unit === 'kg' ? '75' : '165'}
                onChange={(e) => {
                  setBwText(e.target.value)
                  const n = parseFloat(e.target.value)
                  p.setBw(n > 0 ? (unit === 'kg' ? n : n * LB) : 0)
                }}
              />
              {unit === 'kg' ? 'kg' : 'lb'}
            </span>
          </label>
          <label>
            <span>Age <small className="muted">(for the study)</small></span>
            <input className="search" inputMode="numeric" defaultValue={p.age || ''} placeholder="30" onChange={(e) => p.setAge(parseInt(e.target.value) || 0)} />
          </label>
        </div>
      </section>

      {!bw && <p className="empty">Enter your bodyweight to see where you stand.</p>}

      {bw > 0 && !ranked.length && <p className="empty">None of your lifts are in the comparison data yet.</p>}

      {ranked.length > 0 && (
        <section className="panel">
          <h2 className="h2">Your lifts against other lifters</h2>
          <p className="sub">Your best estimated 1-rep max in the last 6 months, for lifts you did at least 3 times</p>
          <div className="list-head cmp-grid"><span>Lift</span><span>Where you are</span><span>Level</span><span>Stronger than</span></div>
          <div className="list">
            {ranked.map((r) => (<Row key={r.std.key} r={r} unit={unit} />))}
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="h2">Where the numbers come from</h2>
        <div className="cmp-src">
          <p>
            <a href={STRENGTH_LEVEL.url} target="_blank" rel="noreferrer">{STRENGTH_LEVEL.name}</a>: millions of 1-rep maxes that people log on the
            site, checked for fake entries. Each level means you are stronger than{' '}
            {LEVEL_NAMES.map((n, i) => `${LEVEL_PCT[i]}% (${n.toLowerCase()})`).join(', ')} of those lifters (
            <a href={STRENGTH_LEVEL.pctUrl} target="_blank" rel="noreferrer">their explanation</a>). People who log lifts are stronger than most people.
          </p>
          {NORMS.length > 0 && (
            <p>
              Study, bench press only: <a href={STUDY.url} target="_blank" rel="noreferrer">{STUDY.name}</a> norms for 1-rep max per kg of bodyweight, by age
              and sex. {p.age ? '' : 'Enter your age to see it.'}
            </p>
          )}
          <p className="muted">Your 1-rep max is an estimate from your sets (Epley formula). Machines differ between gyms, so machine lifts are rougher.</p>
        </div>
      </section>
    </>
  )
}

function Row({ r, unit }: { r: Ranked; unit: 'kg' | 'lbs' }) {
  const val = r.std.metric === 'reps' ? `${r.value} reps` : fmtWeight(r.value, unit)
  return (
    <div className="lift-row cmp-grid cmp-row">
      <div>
        <button className="linkish lift-name" onClick={() => go(liftPath(r.exercise))}>{r.std.name}</button>
        <div className="lift-meta">
          {val}{r.std.perDumbbell ? ' per dumbbell' : ''}{!r.recent && ', older than 6 months'}.{' '}
          <a href={r.std.url} target="_blank" rel="noreferrer">Source</a>
        </div>
        {r.study && <div className="lift-meta">Study: stronger than {Math.round(r.study.pct)}% of {r.study.group}</div>}
      </div>
      <Scale pct={r.pct} />
      <div className="cmp-level">{r.level}</div>
      <div className="lift-val">{Math.round(r.pct)}%</div>
    </div>
  )
}

/** A line from 0 to 100% with the five level marks; the dot is you. */
function Scale({ pct }: { pct: number }) {
  return (
    <div className="scale" aria-label={`Stronger than ${Math.round(pct)}% of lifters`}>
      <div className="scale-line" />
      {LEVEL_PCT.map((p, i) => (<i key={p} className="scale-tick" style={{ left: `${p}%` }} title={LEVEL_NAMES[i]} />))}
      <b className="scale-dot" style={{ left: `${pct}%` }} />
    </div>
  )
}
