import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, cursorBar, cursorLine, grid, STILL } from '../components/chart'
import { RangeControl } from '../components/RangeControl'
import { Back, More, Tip } from '../components/ui'
import { habits } from '../lib/analytics'
import { DOW, fmtDate, fmtDuration, fmtHour, fmtMonth, fmtSeconds, round } from '../lib/format'
import { useApp } from '../lib/store'
import { useChart } from '../lib/theme'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const clock = (h: number) => (h === 0 ? '12 am' : h === 12 ? '12 pm' : h < 12 ? `${h} am` : `${h - 12} pm`)

export function Habits() {
  const { ws, stats, range } = useApp()
  const t = useChart()
  const h = useMemo(() => habits(ws), [ws])
  const dur = useMemo(
    () => h.durations.map((d, i, a) => {
      const win = a.slice(Math.max(0, i - 9), i + 1)
      return { ...d, avg: win.reduce((s, x) => s + x.minutes, 0) / win.length }
    }),
    [h.durations],
  )
  const cardio = stats
    .filter((s) => s.kind === 'cardio' || s.kind === 'timed')
    .map((s) => ({ s, sessions: s.sessions.filter((x) => x.date >= range.from && x.date <= range.to) }))
    .filter((c) => c.sessions.length)

  if (!ws.length) return (<><Back /><p className="empty">No workouts in this range.</p></>)

  const topDay = h.dow.reduce((a, b) => (b.workouts > a.workouts ? b : a))
  const topHour = h.hour.reduce((a, b) => (b.workouts > a.workouts ? b : a))
  const avgMin = ws.reduce((s, w) => s + w.durationMin, 0) / ws.length
  const typicalGap = h.gaps.reduce((a, b) => (b.count > a.count ? b : a))
  const used = h.hour.filter((d) => d.workouts > 0).map((d) => d.hour)
  const hours = h.hour.slice(Math.max(0, Math.min(...used) - 1), Math.min(24, Math.max(...used) + 2))
  const dim = t.grid

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">You train most on {DAYS[topDay.day]}s</h1>
          <p className="lede">Most sessions start around {clock(topHour.hour)} and last {fmtDuration(avgMin)}.</p>
        </div>
        <RangeControl />
      </section>

      <div className="numbers">
        <div><div className="num-v">{fmtDuration(avgMin)}</div><div className="num-k">Average session</div></div>
        <div><div className="num-v">{clock(topHour.hour)}</div><div className="num-k">Usual start</div></div>
        <div><div className="num-v">{typicalGap.label}</div><div className="num-k">Usual rest between sessions</div></div>
        <div><div className="num-v">{h.longestGap}<small>days</small></div><div className="num-k">Longest break</div></div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2 className="h2">Day of the week</h2>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={h.dow} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="26%">
                <XAxis dataKey="day" {...axis(t)} tickFormatter={(d) => DOW[d]} dy={6} />
                <YAxis hide />
                <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={DAYS[payload[0].payload.day]} rows={[{ label: 'Workouts', value: String(payload[0].payload.workouts) }]} /> : null)} />
                <Bar dataKey="workouts" radius={[3, 3, 0, 0]} label={{ position: 'top', fill: t.text2, fontSize: 12 }} {...STILL}>
                  {h.dow.map((d) => (<Cell key={d.day} fill={d.day === topDay.day ? t.primary : dim} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2 className="h2">Start time</h2>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={hours} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap={3}>
                <XAxis dataKey="hour" {...axis(t)} tickFormatter={fmtHour} interval={hours.length > 12 ? 2 : 1} dy={6} />
                <YAxis hide />
                <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={`${clock(payload[0].payload.hour)} to ${clock((payload[0].payload.hour + 1) % 24)}`} rows={[{ label: 'Workouts', value: String(payload[0].payload.workouts) }]} /> : null)} />
                <Bar dataKey="workouts" radius={[3, 3, 0, 0]} {...STILL}>
                  {hours.map((d) => (<Cell key={d.hour} fill={d.hour === topHour.hour ? t.primary : dim} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <More label="Session length and rest days">
        <section className="panel">
          <h2 className="h2">Session length</h2>
          <p className="sub">Each dot is one workout. The line is the average of the last 10.</p>
          <div className="chart tall">
            <ResponsiveContainer>
              <ComposedChart data={dur} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid {...grid(t)} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={56} dy={6} />
                <YAxis {...axis(t)} orientation="right" tickFormatter={(v) => `${v}m`} width={40} tickCount={4} />
                <Tooltip cursor={cursorLine(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={fmtDate(payload[0].payload.t)} rows={[{ label: payload[0].payload.title, value: fmtDuration(payload[0].payload.minutes) }, { label: 'Average of last 10', value: fmtDuration(payload[0].payload.avg) }]} /> : null)} />
                <Scatter dataKey="minutes" shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={3} fill={t.axis} fillOpacity={0.55} />} {...STILL} />
                <Line type="monotone" dataKey="avg" stroke={t.primary} strokeWidth={2} dot={false} {...STILL} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2 className="h2">Days between workouts</h2>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={h.gaps} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="26%">
                <XAxis dataKey="label" {...axis(t)} dy={6} />
                <YAxis hide />
                <Tooltip cursor={cursorBar(t)} content={({ active, payload }) => (active && payload?.[0] ? <Tip title={payload[0].payload.label} rows={[{ label: 'Times', value: String(payload[0].payload.count) }]} /> : null)} />
                <Bar dataKey="count" fill={t.primary} radius={[3, 3, 0, 0]} label={{ position: 'top', fill: t.text2, fontSize: 12 }} {...STILL} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </More>

      {cardio.length > 0 && (
        <More label="Cardio and timed exercises">
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="t">
              <thead><tr><th>Exercise</th><th className="r">Sessions</th><th className="r">Distance</th><th className="r">Time</th><th className="r">Pace</th></tr></thead>
              <tbody>
                {cardio.map(({ s, sessions }) => {
                  const km = sessions.reduce((n, x) => n + x.distanceKm, 0)
                  const sec = sessions.reduce((n, x) => n + x.durationS, 0)
                  return (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="r">{sessions.length}</td>
                      <td className="r">{km > 0 ? `${round(km, 1)} km` : '—'}</td>
                      <td className="r">{fmtSeconds(sec)}</td>
                      <td className="r">{km > 0 && sec > 0 ? `${fmtSeconds(sec / km)} per km` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </More>
      )}
    </>
  )
}
