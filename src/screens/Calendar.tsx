import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, cursorBar, grid, STILL } from '../components/chart'
import { Heatmap } from '../components/Heatmap'
import { RangeControl } from '../components/RangeControl'
import { Back, More, Seg, Tip } from '../components/ui'
import { monthly, weekly, weekStreaks } from '../lib/analytics'
import { compact, fmtDay, fmtDuration, fmtMonth, plural, toUnit } from '../lib/format'
import { useApp } from '../lib/store'
import { useChart } from '../lib/theme'

export function Calendar() {
  const { all, ws, range, unit } = useApp()
  const t = useChart()
  const [metric, setMetric] = useState<'volume' | 'sets' | 'minutes'>('volume')
  const streak = useMemo(() => weekStreaks(all), [all])
  const months = useMemo(() => monthly(ws).map((m) => ({ ...m, t: m.month.getTime() })), [ws])
  const weeks = useMemo(() => weekly(ws, range).map((w) => ({ ...w, volume: toUnit(w.volume, unit) })), [ws, range, unit])
  const avg = weeks.length ? weeks.reduce((s, w) => s + w[metric], 0) / weeks.length : 0
  const fmt = (v: number) => (metric === 'volume' ? `${compact(v)} ${unit}` : metric === 'minutes' ? fmtDuration(v) : String(Math.round(v)))

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">{plural(ws.length, 'workout')}</h1>
          <p className="lede">
            {streak.current > 0 ? `You have trained every week for the last ${plural(streak.current, 'week')}. ` : ''}Your longest run is {plural(streak.longest, 'week')} in a row.
          </p>
        </div>
        <RangeControl />
      </section>

      <section className="panel">
        <h2 className="h2">Every day you trained</h2>
        <p className="sub" style={{ marginBottom: 18 }}>Darker days had more weight lifted</p>
        <Heatmap ws={ws} range={range} unit={unit} />
      </section>

      <section className="panel">
        <h2 className="h2">Workouts per month</h2>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={months} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="24%">
              <XAxis dataKey="t" {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={24} dy={6} />
              <YAxis hide />
              <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={fmtMonth(payload[0].payload.t)} rows={[{ label: 'Workouts', value: String(payload[0].payload.workouts) }]} /> : null)} />
              <Bar dataKey="workouts" fill={t.primary} radius={[3, 3, 0, 0]} label={{ position: 'top', fill: t.text2, fontSize: 12 }} {...STILL} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <More label="Weekly workload">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2 className="h2">{metric === 'volume' ? 'Weight lifted' : metric === 'sets' ? 'Working sets' : 'Time trained'} per week</h2>
              <p className="sub">The line is your weekly average, {fmt(avg)}</p>
            </div>
            <Seg value={metric} onChange={setMetric} options={[{ v: 'volume', label: 'Weight' }, { v: 'sets', label: 'Sets' }, { v: 'minutes', label: 'Time' }]} />
          </div>
          <div className="chart tall">
            <ResponsiveContainer>
              <BarChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
                <CartesianGrid {...grid(t)} />
                <XAxis dataKey="week" {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={56} dy={6} />
                <YAxis {...axis(t)} orientation="right" tickFormatter={(v) => compact(v)} width={44} tickCount={4} />
                <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={`Week of ${fmtDay(payload[0].payload.week)}`} rows={[{ label: 'Weight', value: `${compact(payload[0].payload.volume)} ${unit}` }, { label: 'Sets', value: String(payload[0].payload.sets) }, { label: 'Time', value: fmtDuration(payload[0].payload.minutes) }]} /> : null)} />
                <Bar dataKey={metric} fill={t.primary} radius={[2, 2, 0, 0]} {...STILL} />
                <ReferenceLine y={avg} stroke={t.text2} strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </More>
    </>
  )
}
