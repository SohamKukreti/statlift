import { stalledWeeks, type LiftSummary } from '../lib/analytics'
import { distUnit, fmtSeconds, pct, round, toDist, toUnit } from '../lib/format'
import { go, liftPath } from '../lib/route'
import { useChart } from '../lib/theme'
import type { Unit } from '../lib/types'
import { Spark } from './ui'

function runningBest(v: number[]) {
  let m = 0
  return v.map((x) => (m = Math.max(m, x)))
}

export function liftValue(l: LiftSummary, unit: Unit, v = l.now) {
  const k = l.stat.kind
  if (k === 'weighted') return <>{round(toUnit(v, unit), 1)}<small>{unit}</small></>
  if (k === 'bodyweight') return <>{Math.round(v)}<small>reps</small></>
  if (k === 'cardio') return <>{round(toDist(v, unit), 1)}<small>{distUnit(unit)}</small></>
  return <>{fmtSeconds(v)}</>
}

export function LiftRow({ l, unit }: { l: LiftSummary; unit: Unit }) {
  const t = useChart()
  const stall = stalledWeeks(l.stat)
  const showChg = l.sessions.length >= 3 && Math.abs(l.change) >= 0.005
  return (
    <button className="lift-row" onClick={() => go(liftPath(l.stat.name))}>
      <div style={{ minWidth: 0 }}>
        <div className="lift-name">{l.stat.name}</div>
        <div className="lift-meta">
          {stall ? `No new best in ${stall} weeks` : `${l.stat.muscle}, ${l.sessions.length} sessions`}
        </div>
      </div>
      <Spark data={runningBest(l.sessions.map((s) => l.metric(s) ?? 0).filter((v) => v > 0))} color={t.primary} />
      <div className="lift-val">{liftValue(l, unit)}</div>
      <div className={`lift-chg ${showChg && l.change > 0 ? 'up' : ''}`}>{showChg ? pct(l.change) : ''}</div>
    </button>
  )
}
