import { hatch } from '../components/Sketch'
import { useMemo } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { axis, cursorLine } from '../components/chart'
import { LiftRow } from '../components/LiftRow'
import { RangeControl } from '../components/RangeControl'
import { Icon, Tip } from '../components/ui'
import { DAY, habits, kpis, liftSummaries, momentum, setsByMuscle, strengthIndex, weekStreaks } from '../lib/analytics'
import { fmtDay, fmtDuration, fmtHour, fmtMonth, plural, round } from '../lib/format'
import { go } from '../lib/route'
import { useApp } from '../lib/store'
import { useChart } from '../lib/theme'
import { KIND_TITLE, watchOuts } from '../lib/watch'

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

function ago(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return fmtDay(d)
}

export function Lede({ children }: { children: React.ReactNode }) {
  return <p className="lede">{children}</p>
}

export function Home() {
  const { all, ws, stats, range, unit } = useApp()
  const t = useChart()

  const idx = useMemo(() => strengthIndex(stats, range), [stats, range])
  const k = useMemo(() => kpis(ws, stats, range), [ws, stats, range])
  const streak = useMemo(() => weekStreaks(all), [all])
  const lifts = useMemo(() => liftSummaries(stats, range).filter((l) => l.stat.kind !== 'timed' && l.stat.kind !== 'cardio'), [stats, range])
  const top = useMemo(() => [...lifts].sort((a, b) => b.sessions.length - a.sessions.length).slice(0, 5), [lifts])
  const h = useMemo(() => habits(ws), [ws])
  const muscles = useMemo(() => setsByMuscle(ws, stats), [ws, stats])
  const watch = useMemo(() => watchOuts(all, stats, unit), [all, stats, unit])
  const mo = useMemo(() => ({ now: momentum(stats), before: momentum(stats, Date.now() - 28 * DAY) }), [stats])
  const lastPR = useMemo(() => {
    let best: { name: string; date: Date } | null = null
    for (const s of stats) for (const x of s.sessions) if (x.isPR && (!best || x.date > best.date)) best = { name: s.name, date: x.date }
    return best
  }, [stats])

  if (!ws.length)
    return (
      <>
        <div className="hero"><h1 className="title sm">No workouts in this range</h1><RangeControl /></div>
        <p className="lede">Pick a longer range to see your training.</p>
      </>
    )

  const gain = idx.length > 1 ? idx[idx.length - 1].index / idx[0].index - 1 : 0
  const ticks = niceTicks(idx.map((p) => p.index))
  const since = MONTH_YEAR.format(ws[0].start)
  const topHour = h.hour.reduce((a, b) => (b.workouts > a.workouts ? b : a))

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="title">{gain > 0.01 ? `${Math.round(gain * 100)}% stronger` : plural(k.workouts, 'workout')}</h1>
          <Lede>
            {gain > 0.01
              ? `Your lifts have gone up by ${Math.round(gain * 100)}% on average since ${since}.`
              : `Logged since ${since}.`}
          </Lede>
        </div>
        <RangeControl />
      </section>

      <div className="numbers">
        <div><div className="num-v">{k.workouts}</div><div className="num-k">Workouts</div></div>
        <div><div className="num-v">{round(k.hours, 0)}<small>h</small></div><div className="num-k">Time trained</div></div>
        <div><div className="num-v">{round(k.perWeek, 1)}</div><div className="num-k">Workouts a week</div></div>
        <div><div className="num-v">{streak.current}<small>{streak.current === 1 ? 'week' : 'weeks'}</small></div><div className="num-k">Current streak</div></div>
      </div>

      {mo.now.total > 0 && <Momentum now={mo.now} before={mo.before} />}

      {watch.length > 0 && (
        <button className="watch-line" onClick={() => go('watch')}>
          <span className="warn-ic">
            <Icon.alert />
            <span>
            {plural(watch.length, 'thing')} to watch out for{' '}
            <span className="muted">
              {[...new Set(watch.map((w) => KIND_TITLE[w.kind].toLowerCase()))].slice(0, 3).join(', ')}
            </span>
            </span>
          </span>
          <Icon.chevron />
        </button>
      )}

      {idx.length > 1 && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2 className="h2">Strength over time</h2>
              <p className="sub">Average change across all your lifts since your first session</p>
            </div>
          </div>
        <div className="chart-main" aria-label="Strength over time">
          <ResponsiveContainer>
            <ComposedChart data={idx} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
              <XAxis dataKey="week" type="number" scale="time" domain={['dataMin', 'dataMax']} {...axis(t)} tickFormatter={(v) => fmtMonth(v)} minTickGap={56} dy={6} />
              <YAxis {...axis(t)} orientation="right" domain={[ticks[0], ticks[ticks.length - 1]]} ticks={ticks} tickFormatter={(v) => (v === 100 ? 'Start' : `${v > 100 ? '+' : ''}${Math.round(v - 100)}%`)} width={48} />
              <Tooltip
                cursor={cursorLine(t)}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <Tip title={`Week of ${fmtDay(payload[0].payload.week)}`} rows={[{ label: 'Change since start', value: `${round(payload[0].payload.index - 100, 0)}%` }]} />
                  ) : null
                }
              />
              <Area type="monotone" dataKey="index" stroke="none" fill={hatch(t.primary)} fillOpacity={0.55} animationDuration={1200} />
              <Line type="monotone" dataKey="index" stroke={t.primary} strokeWidth={2.25} dot={false} activeDot={{ r: 4.5, fill: t.primary, stroke: t.surface, strokeWidth: 2 }} animationDuration={1200} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        </section>
      )}

      <section className="panel">
        <div className="section-head">
          <div>
            <h2 className="h2">Your lifts</h2>
            <p className="sub">Your {top.length} most trained lifts in this range</p>
          </div>
          {lifts.length > top.length && <button className="btn" onClick={() => go('lifts')}>See all {lifts.length}</button>}
        </div>
        <div className="list-head"><span>Lift</span><span>Trend</span><span>Est. 1-rep max</span><span>Change</span></div>
        <div className="list">
          {top.map((l) => (<LiftRow key={l.stat.name} l={l} unit={unit} />))}
        </div>
      </section>

      <section className="panel">
        <h2 className="h2">Go deeper</h2>
        <div className="list">
          <LinkRow title="Records" to="records" text={lastPR ? `${plural(k.prs, 'new best')}. Latest: ${lastPR.name}, ${ago(lastPR.date)}.` : 'No records yet.'} />
          <LinkRow title="Calendar" to="calendar" text={`Every day you trained. Longest run: ${plural(streak.longest, 'week')} in a row.`} />
          <LinkRow title="Body balance" to="balance" text={muscles[0] ? `${muscles[0].muscle} gets the most sets. See which muscles get the least.` : 'Sets per muscle.'} />
          <LinkRow title="Habits" to="habits" text={`You usually start at ${fmtHour(topHour.hour).replace('a', ' am').replace('p', ' pm')} and train for ${fmtDuration(k.avgDuration)}.`} />
        </div>
      </section>
    </>
  )
}

function niceTicks(vals: number[]) {
  const lo = Math.min(100, ...vals), hi = Math.max(...vals)
  const step = [5, 10, 20, 25, 50, 100].find((s) => (hi - lo) / s <= 4) ?? 100
  const out: number[] = []
  for (let v = 100 - Math.ceil((100 - lo) / step) * step; v < hi + step; v += step) out.push(v)
  return out
}

function LinkRow({ title, text, to }: { title: string; text: string; to: string }) {
  return (
    <button className="link-row" onClick={() => go(to)}>
      <b>{title}</b>
      <span>{text}</span>
      <Icon.chevron />
    </button>
  )
}

type Mo = ReturnType<typeof momentum>

/** Good-news line: how many of your current lifts are still setting new bests. */
function Momentum({ now, before }: { now: Mo; before: Mo }) {
  const pct = Math.round(now.share * 100)
  const diff = before.total ? pct - Math.round(before.share * 100) : 0
  const shown = now.up.slice(0, 3)
  return (
    <button className="momentum" onClick={() => go('records')}>
      <div className={`mo-v ${pct >= 25 ? 'good' : ''}`}>{pct}%</div>
      <div className="mo-main">
        <div className="mo-t">Momentum</div>
        <div className="mo-s">
          {now.up.length} of {now.total} lifts you train set a new best in the last 4 weeks
          {diff !== 0 && <span className={diff > 0 ? 'good' : 'muted'}> ({diff > 0 ? 'up' : 'down'} {Math.abs(diff)} points)</span>}
        </div>
        {shown.length > 0 && (
          <div className="mo-lifts">
            {shown.join(', ')}
            {now.up.length > shown.length && ` and ${now.up.length - shown.length} more`}
          </div>
        )}
      </div>
      <Icon.chevron />
    </button>
  )
}
