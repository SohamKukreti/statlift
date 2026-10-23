import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, cursorBar, cursorLine, grid, STILL } from '../components/chart'
import { RangeControl } from '../components/RangeControl'
import { Back, Legend, More, Tip } from '../components/ui'
import { DAY, inRange, setsByMuscle, splitShare, startOfDay, weeklyGroupSets } from '../lib/analytics'
import { compact, fmtDay, fmtMonth, round, toUnit } from '../lib/format'
import { GROUPS, guessMuscle, MUSCLE_NAMES, type Group } from '../lib/muscles'
import { go, liftPath } from '../lib/route'
import { useApp } from '../lib/store'
import { useChart } from '../lib/theme'

export function Balance() {
  const { all, ws, stats, range, unit, overrides, setOverride } = useApp()
  const t = useChart()
  const color = (g: string) => t.series[Math.max(0, GROUPS.indexOf(g as Group))]
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const muscles = useMemo(() => setsByMuscle(ws, stats), [ws, stats])
  const weeks = useMemo(() => weeklyGroupSets(ws, stats, range), [ws, stats, range])
  const split = useMemo(() => splitShare(ws, stats), [ws, stats])
  const used = stats.filter((s) => s.sessions.some((x) => inRange(x.date, range)))

  // body groups you normally train but have not trained in 9+ days
  const neglected = useMemo(() => {
    const last = new Map<string, number>(), count = new Map<string, number>()
    const groupOf = new Map(stats.map((s) => [s.name, s.group]))
    for (const w of all)
      for (const e of w.exercises) {
        const g = groupOf.get(e.name) ?? 'Other'
        last.set(g, Math.max(last.get(g) ?? 0, w.start.getTime()))
        count.set(g, (count.get(g) ?? 0) + 1)
      }
    const today = startOfDay(new Date()).getTime()
    return GROUPS.filter((g) => g !== 'Other' && g !== 'Cardio' && (count.get(g) ?? 0) >= 8)
      .map((g) => ({ g, days: Math.floor((today - startOfDay(new Date(last.get(g)!)).getTime()) / DAY) }))
      .filter((x) => x.days >= 9)
  }, [all, stats])

  if (!ws.length) return (<><Back /><p className="empty">No workouts in this range.</p></>)

  const ppl = (['Push', 'Pull', 'Legs'] as const).map((k) => ({ k, v: split[k] }))
  const total = ppl.reduce((s, x) => s + x.v, 0) || 1
  const ratio = split.Pull ? split.Push / split.Pull : 0
  const verdict = !split.Pull || !split.Push ? '' : ratio > 1.25 ? 'You do more pushing than pulling.' : ratio < 0.8 ? 'You do more pulling than pushing.' : 'Your pushing and pulling are even.'
  const legs = split.Legs / total
  const present = GROUPS.filter((g) => weeks.some((w) => w[g] > 0))
  const pplColor = [t.primary, t.text2, t.axis]

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">{muscles[0]?.muscle} gets the most sets</h1>
          <p className="lede">
            {verdict}{legs < 0.22 ? ` Legs get ${Math.round(legs * 100)}% of your sets.` : ''}
            {neglected.length ? ` No ${neglected.map((n) => n.g.toLowerCase()).join(' or ')} for ${neglected[0].days} days.` : ''}
          </p>
        </div>
        <RangeControl />
      </section>

      <section className="panel">
        <h2 className="h2">Push, pull and legs</h2>
        <p className="sub">Share of your working sets</p>
        <div className="bar-split" style={{ margin: '18px 0 16px' }}>
          {ppl.map((x, i) => (<div key={x.k} style={{ flex: x.v || 0.0001, background: pplColor[i] }} />))}
        </div>
        <div className="row" style={{ gap: 40 }}>
          {ppl.map((x, i) => (
            <div key={x.k}>
              <div className="num-v">{Math.round((x.v / total) * 100)}<small>%</small></div>
              <div className="num-k row" style={{ gap: 7 }}><i className="sw" style={{ background: pplColor[i] }} />{x.k}, {x.v.toLocaleString()} sets</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="h2">Sets per muscle</h2>
        <div style={{ height: Math.max(200, muscles.length * 32), marginTop: 16 }}>
          <ResponsiveContainer>
            <BarChart data={muscles} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={7}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="muscle" {...axis(t)} tick={{ fill: t.text2, fontSize: 13 }} width={104} />
              <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={payload[0].payload.muscle} rows={[{ label: 'Sets', value: String(payload[0].payload.sets) }, { label: 'Weight lifted', value: `${compact(toUnit(payload[0].payload.volume, unit))} ${unit}` }]} /> : null)} />
              <Bar dataKey="sets" fill={t.primary} radius={[0, 3, 3, 0]} label={{ position: 'right', fill: t.text2, fontSize: 12 }} {...STILL} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="sub">Push to pull ratio: {round(ratio, 2)} to 1</p>
      </section>

      <More label="Week by week">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2 className="h2">Sets per week by body part</h2>
            </div>
            <Legend items={present.map((g) => ({ key: g, color: color(g) }))} hidden={hidden} onToggle={(k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n })} />
          </div>
          <div className="chart tall">
            <ResponsiveContainer>
              <AreaChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid {...grid(t)} />
                <XAxis dataKey="week" {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={56} dy={6} />
                <YAxis {...axis(t)} orientation="right" width={36} tickCount={4} />
                <Tooltip cursor={cursorLine(t)} content={({ active, payload, label }) => (active && payload?.length ? <Tip title={`Week of ${fmtDay(label as number)}`} rows={[...payload].reverse().filter((p) => (p.value as number) > 0).map((p) => ({ label: String(p.dataKey), value: String(p.value), color: color(String(p.dataKey)) }))} /> : null)} />
                {present.filter((g) => !hidden.has(g)).map((g) => (
                  <Area key={g} type="monotone" dataKey={g} stackId="1" stroke={t.surface} strokeWidth={1.5} fill={color(g)} fillOpacity={0.85} {...STILL} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </More>

      <More label="Fix which muscle a lift counts toward">
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="t">
            <thead><tr><th>Lift</th><th>Muscle</th><th className="r">Sessions</th></tr></thead>
            <tbody>
              {[...used].sort((a, b) => Number(b.muscle === 'Other') - Number(a.muscle === 'Other') || b.sessions.length - a.sessions.length).map((s) => (
                <tr key={s.name}>
                  <td><button className="linkish" onClick={() => go(liftPath(s.name))}>{s.name}</button></td>
                  <td>
                    <select className="select" value={s.muscle} onChange={(e) => setOverride(s.name, e.target.value === guessMuscle(s.name) ? null : e.target.value)} aria-label={`Muscle for ${s.name}`}>
                      {MUSCLE_NAMES.map((m) => (<option key={m}>{m}</option>))}
                    </select>
                    {overrides[s.name] !== undefined && <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>changed by you</span>}
                    {s.muscle === 'Other' && <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--warn)' }}>pick a muscle</span>}
                  </td>
                  <td className="r">{s.sessions.filter((x) => inRange(x.date, range)).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </More>
    </>
  )
}
