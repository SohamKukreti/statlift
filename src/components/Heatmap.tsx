import { useEffect, useMemo, useRef, useState } from 'react'
import { DAY, dailyMap, dayKey, startOfDay, startOfWeek, type Range } from '../lib/analytics'
import { fmtDate, fmtMonthShort, fmtVolume } from '../lib/format'
import { useChart } from '../lib/theme'
import type { Unit, Workout } from '../lib/types'
import { Tip } from './ui'

/** One column per week, colour = weight lifted that day (quartile steps). */
export function Heatmap({ ws, range, unit }: { ws: Workout[]; range: Range; unit: Unit }) {
  const t = useChart()
  const [hover, setHover] = useState<{ x: number; y: number; key: string } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const { cells, months, days } = useMemo(() => {
    const days = dailyMap(ws)
    const vols = [...days.values()].map((d) => d.volume).filter((v) => v > 0).sort((a, b) => a - b)
    const q = (p: number) => vols[Math.min(vols.length - 1, Math.floor(p * vols.length))] ?? 0
    const cuts = [q(0.25), q(0.5), q(0.75)]
    const endD = startOfDay(range.to > new Date() ? new Date() : range.to)
    let startD = startOfWeek(range.from)
    if ((endD.getTime() - startD.getTime()) / DAY > 740) startD = startOfWeek(new Date(endD.getTime() - 730 * DAY))
    const cells: { key: string; date: Date; level: number; future: boolean }[] = []
    const months: { col: number; label: string }[] = []
    let col = 0, lastMonth = -1
    for (let d = new Date(startD); d <= endD || (d.getDay() + 6) % 7 !== 0; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const dow = (d.getDay() + 6) % 7
      if (dow === 0 && cells.length) col++
      if (dow === 0 && d.getMonth() !== lastMonth) {
        months.push({ col, label: fmtMonthShort(d) })
        lastMonth = d.getMonth()
      }
      const k = dayKey(d)
      const c = days.get(k)
      let level = 0
      if (c) level = c.volume <= 0 ? 1 : c.volume <= cuts[0] ? 2 : c.volume <= cuts[1] ? 3 : c.volume <= cuts[2] ? 4 : 5
      cells.push({ key: k, date: d, level, future: d > endD })
    }
    return { cells, months, days }
  }, [ws, range])

  useEffect(() => {
    if (wrap.current) wrap.current.scrollLeft = wrap.current.scrollWidth
  }, [cells])

  const cols = Math.ceil(cells.length / 7)
  const monthRow = Array.from({ length: cols }, (_, i) => months.find((m) => m.col === i)?.label ?? '')
  const hov = hover ? days.get(hover.key) : null
  const hovDate = hover ? cells.find((c) => c.key === hover.key)?.date : null

  return (
    <div style={{ position: 'relative' }} data-heat>
      <div className="heat-wrap" ref={wrap}>
        <div className="heat-months">{monthRow.map((m, i) => (<span key={i}>{m}</span>))}</div>
        <div className="heat" onMouseLeave={() => setHover(null)}>
          {cells.map((c) => (
            <div
              key={c.key}
              className="heat-cell"
              style={{ background: c.future ? 'transparent' : t.seq[c.level] }}
              onMouseEnter={(e) => {
                if (c.future) return
                const r = (e.target as HTMLElement).getBoundingClientRect()
                const p = (e.currentTarget.closest('[data-heat]') as HTMLElement).getBoundingClientRect()
                setHover({ x: r.left - p.left + 6, y: r.top - p.top, key: c.key })
              }}
              aria-label={fmtDate(c.date)}
            />
          ))}
        </div>
      </div>
      <div className="heat-scale" style={{ marginTop: 12 }}>
        Rest {t.seq.map((c, i) => (<i key={i} style={{ background: c }} />))} Heavy
      </div>
      {hover && hovDate && (
        <div style={{ position: 'absolute', left: hover.x, top: hover.y - 6, transform: 'translate(-50%,-100%)', zIndex: 10, pointerEvents: 'none' }}>
          <Tip title={fmtDate(hovDate)} rows={hov ? [{ label: hov.titles.join(', '), value: '' }, { label: 'Weight lifted', value: fmtVolume(hov.volume, unit) }] : [{ label: 'Rest day', value: '' }]} />
        </div>
      )}
    </div>
  )
}
