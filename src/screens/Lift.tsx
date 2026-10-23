import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, cursorBar, cursorLine, grid, STILL } from '../components/chart'
import { RangeControl } from '../components/RangeControl'
import { Back, Legend, More, Tip } from '../components/ui'
import { inRange, metricFor, stalledWeeks } from '../lib/analytics'
import { compact, fmtDate, fmtDay, fmtMonth, fmtSeconds, fmtWeight, pct, round, toUnit } from '../lib/format'
import { guessMuscle, MUSCLE_NAMES } from '../lib/muscles'
import { useApp } from '../lib/store'
import { useChart } from '../lib/theme'
import type { ExerciseKind, Unit } from '../lib/types'

export function metricName(kind: ExerciseKind) {
  return kind === 'weighted' ? 'Estimated 1-rep max' : kind === 'bodyweight' ? 'Most reps in a set' : kind === 'cardio' ? 'Distance' : 'Time'
}

export function fmtMetric(v: number, kind: ExerciseKind, unit: Unit) {
  if (kind === 'weighted') return fmtWeight(v, unit)
  if (kind === 'bodyweight') return `${Math.round(v)} reps`
  if (kind === 'cardio') return `${round(v, 2)} km`
  return fmtSeconds(v)
}

export function Lift({ name }: { name: string }) {
  const { stats, range, unit, overrides, setOverride } = useApp()
  const t = useChart()
  const stat = stats.find((s) => s.name === name)
  const [allRows, setAllRows] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const sessions = useMemo(() => stat?.sessions.filter((s) => inRange(s.date, range)) ?? [], [stat, range])

  if (!stat)
    return (
      <>
        <Back />
        <p className="empty">This lift is not in your file.</p>
      </>
    )

  const kind = stat.kind
  const weighted = kind === 'weighted'
  const metric = metricFor(kind)
  const vals = sessions.map(metric).filter((v): v is number => v !== null)
  const first = vals.length ? Math.max(...vals.slice(0, 2)) : 0
  const now = vals.length ? Math.max(...vals.slice(-3)) : 0
  const best = vals.length ? Math.max(...vals) : 0
  const change = vals.length >= 3 && first ? now / first - 1 : null
  const stall = stalledWeeks(stat)
  const conv = (v: number | null) => (v === null ? null : weighted ? toUnit(v, unit) : v)
  const big = (v: number) => (weighted ? round(toUnit(v, unit), 1) : kind === 'timed' ? fmtSeconds(v) : round(v, kind === 'cardio' ? 2 : 0))
  const bigUnit = weighted ? unit : kind === 'bodyweight' ? 'reps' : kind === 'cardio' ? 'km' : ''

  const chart = sessions.map((s) => ({
    t: s.date.getTime(),
    metric: conv(metric(s)),
    top: weighted && s.topWeight ? toUnit(s.topWeight, unit) : null,
    pr: s.isPR ? conv(metric(s)) : null,
    volume: toUnit(s.volume, unit),
    s,
  }))
  const repBins = [
    { label: '1–5', min: 1, max: 5 }, { label: '6–8', min: 6, max: 8 }, { label: '9–12', min: 9, max: 12 },
    { label: '13–15', min: 13, max: 15 }, { label: '16+', min: 16, max: 1e9 },
  ].map((b) => ({ ...b, sets: sessions.reduce((n, s) => n + s.workSets.filter((x) => (x.reps ?? 0) >= b.min && (x.reps ?? 0) <= b.max).length, 0) }))
  const rows = [...sessions].reverse()

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">{stat.name}</h1>
          <p className="lede">
            {change !== null
              ? `${metricName(kind)} went from ${fmtMetric(first, kind, unit)} to ${fmtMetric(now, kind, unit)}, ${change >= 0 ? 'up' : 'down'} ${pct(Math.abs(change)).replace('+', '')}.`
              : `${sessions.length} session${sessions.length === 1 ? '' : 's'} in this range.`}
            {stall ? ` No new best in ${stall} weeks.` : ''}
          </p>
        </div>
        <RangeControl />
      </section>

      <div className="numbers">
        <div><div className="num-v">{big(now)}<small>{bigUnit}</small></div><div className="num-k">Now</div></div>
        <div><div className="num-v">{big(best)}<small>{bigUnit}</small></div><div className="num-k">Best</div></div>
        <div><div className={`num-v ${change && change > 0 ? 'good' : ''}`}>{change !== null ? pct(change) : '—'}</div><div className="num-k">Change</div></div>
        <div><div className="num-v">{sessions.length}</div><div className="num-k">Sessions</div></div>
      </div>

      <section className="panel">
        <div className="section-head">
          <div>
            <h2 className="h2">{metricName(kind)}</h2>
            <p className="sub">Each dot is a session. Filled dots are new bests.</p>
          </div>
          {weighted && (
            <Legend items={[{ key: 'Estimate', color: t.primary }, { key: 'Heaviest set', color: t.series[1] }]} hidden={showTop ? undefined : new Set(['Heaviest set'])} onToggle={(k) => k === 'Heaviest set' && setShowTop(!showTop)} />
          )}
        </div>
        <div className="chart tall">
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid {...grid(t)} />
              <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={56} dy={6} />
              <YAxis {...axis(t)} orientation="right" domain={['auto', 'auto']} tickFormatter={(v) => (kind === 'timed' ? fmtSeconds(v) : round(v, 0))} width={44} tickCount={5} />
              <Tooltip
                cursor={cursorLine(t)}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null
                  const p = payload[0].payload as (typeof chart)[number]
                  const m = metric(p.s)
                  return (
                    <Tip
                      title={fmtDate(p.t) + (p.s.isPR ? ', new best' : '')}
                      rows={[
                        { label: weighted ? 'Estimate' : metricName(kind), value: m !== null ? fmtMetric(m, kind, unit) : '—' },
                        ...(weighted ? [{ label: 'Heaviest set', value: `${fmtWeight(p.s.topWeight, unit)} × ${p.s.topWeightReps ?? '—'}` }] : []),
                      ]}
                    />
                  )
                }}
              />
              {weighted && showTop && <Line type="stepAfter" dataKey="top" stroke={t.series[1]} strokeWidth={1.5} dot={false} connectNulls {...STILL} />}
              <Line type="monotone" dataKey="metric" stroke={t.primary} strokeWidth={2} connectNulls dot={{ r: 2.5, fill: t.surface, stroke: t.primary, strokeWidth: 1.5 }} activeDot={{ r: 5, fill: t.primary, stroke: t.surface, strokeWidth: 2 }} {...STILL} />
              <Scatter dataKey="pr" shape={(p: { cx?: number; cy?: number }) => (p.cx && p.cy ? <circle cx={p.cx} cy={p.cy} r={4} fill={t.primary} stroke={t.surface} strokeWidth={1.5} /> : <g />)} {...STILL} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2 className="h2" style={{ marginBottom: 8 }}>Sessions</h2>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr><th>Date</th><th>Sets</th><th className="r">{weighted ? 'Estimate' : metricName(kind)}</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, allRows ? undefined : 8).map((s) => {
                const m = metric(s)
                return (
                  <tr key={s.workoutId}>
                    <td className="nowrap">{fmtDay(s.date)}<span className="muted"> {s.date.getFullYear()}</span></td>
                    <td>
                      <div className="sets">
                        {s.workSets.map((x, i) => {
                          const isTop = weighted ? x.weightKg === s.topWeight && x.reps === s.topWeightReps : x.reps === s.bestReps
                          const label = x.weightKg && x.reps ? `${round(toUnit(x.weightKg, unit), 1)} × ${x.reps}` : x.reps ? `${x.reps} reps` : x.distanceKm ? `${round(x.distanceKm, 2)} km` : x.durationS ? fmtSeconds(x.durationS) : '—'
                          return <span key={i} className={isTop ? 'best' : ''}>{label}</span>
                        })}
                      </div>
                    </td>
                    <td className="r nowrap">
                      {m !== null ? fmtMetric(m, kind, unit) : '—'}
                      {s.isPR && <div className="pr-mark">New best</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 8 && (
          <div className="list-foot"><button className="btn" onClick={() => setAllRows(!allRows)}>{allRows ? 'Show fewer' : `Show all ${rows.length} sessions`}</button></div>
        )}
      </section>

      <More label="More detail">
        <div className="grid-2">
          {weighted && (
            <section className="panel">
              <h2 className="h2">Volume per session</h2>
              <p className="sub">Weight × reps of all working sets, in {unit}</p>
              <div className="chart">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
                    <CartesianGrid {...grid(t)} />
                    <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={56} padding={{ left: 6, right: 6 }} dy={6} />
                    <YAxis {...axis(t)} orientation="right" tickFormatter={(v) => compact(v)} width={44} tickCount={4} />
                    <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={fmtDate(payload[0].payload.t)} rows={[{ label: 'Volume', value: `${compact(payload[0].payload.volume)} ${unit}` }]} /> : null)} />
                    <Bar dataKey="volume" fill={t.primary} radius={[2, 2, 0, 0]} maxBarSize={8} {...STILL} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          <section className="panel">
            <h2 className="h2">Reps per set</h2>
            <p className="sub">How many working sets fell in each rep range</p>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={repBins} margin={{ top: 18, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
                  <XAxis dataKey="label" {...axis(t)} dy={6} />
                  <YAxis hide />
                  <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={`${payload[0].payload.label} reps`} rows={[{ label: 'Sets', value: String(payload[0].payload.sets) }]} /> : null)} />
                  <Bar dataKey="sets" fill={t.primary} radius={[3, 3, 0, 0]} label={{ position: 'top', fill: t.text2, fontSize: 12 }} {...STILL} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
        <section className="panel">
          <h2 className="h2">Muscle</h2>
          <p className="sub">Which muscle this lift counts toward on the Body balance page</p>
          <div className="row" style={{ marginTop: 12 }}>
            <select className="select" value={stat.muscle} onChange={(e) => setOverride(stat.name, e.target.value === guessMuscle(stat.name) ? null : e.target.value)} aria-label="Muscle">
              {MUSCLE_NAMES.map((m) => (<option key={m}>{m}</option>))}
            </select>
            {overrides[stat.name] !== undefined && <button className="ghost" onClick={() => setOverride(stat.name, null)}>Reset to {guessMuscle(stat.name)}</button>}
          </div>
        </section>
      </More>
    </>
  )
}
