import { hatch } from '../components/Sketch'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, cursorBar, grid, STILL } from '../components/chart'
import { RangeControl } from '../components/RangeControl'
import { Back, Tip } from '../components/ui'
import { inRange, metricFor } from '../lib/analytics'
import { fmtDay, fmtMonth, pct } from '../lib/format'
import { go, liftPath } from '../lib/route'
import { useApp } from '../lib/store'
import { useChart } from '../lib/theme'
import { fmtMetric } from './Lift'

export function Records() {
  const { stats, range, unit } = useApp()
  const t = useChart()
  const [sort, setSort] = useState<'recent' | 'jump'>('recent')
  const [all, setAll] = useState(false)

  const prs = useMemo(() => {
    const out: { date: Date; name: string; kind: (typeof stats)[number]['kind']; value: number; gain: number }[] = []
    for (const s of stats) {
      const m = metricFor(s.kind)
      let best = 0
      for (const x of s.sessions) {
        const v = m(x)
        if (v === null) continue
        if (x.isPR && best > 0 && inRange(x.date, range)) out.push({ date: x.date, name: s.name, kind: s.kind, value: v, gain: v / best - 1 })
        best = Math.max(best, v)
      }
    }
    return out
  }, [stats, range])

  const months = useMemo(() => {
    const m = new Map<number, number>()
    for (const p of prs) {
      const k = new Date(p.date.getFullYear(), p.date.getMonth(), 1).getTime()
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    const out: { t: number; n: number }[] = []
    const start = new Date(range.from.getFullYear(), range.from.getMonth(), 1)
    const end = new Date(Math.min(range.to.getTime(), Date.now()))
    for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) out.push({ t: d.getTime(), n: m.get(d.getTime()) ?? 0 })
    return out
  }, [prs, range])

  const list = [...prs].sort((a, b) => (sort === 'recent' ? b.date.getTime() - a.date.getTime() : b.gain - a.gain))
  const lifts = new Set(prs.map((p) => p.name)).size

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">{prs.length} new bests</h1>
          <p className="lede">Set on {lifts} different lifts. A new best is a session that beats every session before it.</p>
        </div>
        <RangeControl />
      </section>

      <section className="panel">
        <h2 className="h2">New bests per month</h2>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={months} margin={{ top: 18, right: 4, bottom: 0, left: 4 }} barCategoryGap="24%">
              <CartesianGrid {...grid(t)} />
              <XAxis dataKey="t" {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={24} dy={6} />
              <YAxis {...axis(t)} orientation="right" allowDecimals={false} width={32} tickCount={4} />
              <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={fmtMonth(payload[0].payload.t)} rows={[{ label: 'New bests', value: String(payload[0].payload.n) }]} /> : null)} />
              <Bar dataKey="n" fill={hatch(t.primary)} stroke={t.primary} strokeWidth={1.5} radius={[3, 3, 0, 0]} {...STILL} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2 className="h2">All new bests</h2>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'jump')} aria-label="Sort">
            <option value="recent">Newest first</option>
            <option value="jump">Biggest jump first</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="t big">
            <thead><tr><th>Date</th><th>Lift</th><th className="r">New best</th><th className="r">Jump</th></tr></thead>
            <tbody>
              {list.slice(0, all ? undefined : 10).map((p, i) => (
                <tr key={i}>
                  <td className="nowrap">{fmtDay(p.date)}<span className="muted"> {p.date.getFullYear()}</span></td>
                  <td><button className="linkish" onClick={() => go(liftPath(p.name))}>{p.name}</button></td>
                  <td className="r nowrap">{fmtMetric(p.value, p.kind, unit)}</td>
                  <td className="r good nowrap">{pct(p.gain, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > 10 && <div className="list-foot"><button className="btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button></div>}
        {!list.length && <p className="empty">No new bests in this range.</p>}
      </section>
    </>
  )
}
