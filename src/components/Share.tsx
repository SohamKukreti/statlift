import { Logo } from './Logo'
import { toPng } from 'html-to-image'
import { useMemo, useRef, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { kpis, strengthIndex } from '../lib/analytics'
import { compact, fmtDate, toUnit } from '../lib/format'
import { useApp } from '../lib/store'
import { Icon } from './ui'

/** A fixed light card so the saved image looks the same in any theme. */
export function ShareModal({ onClose }: { onClose: () => void }) {
  const { ws, stats, range, unit } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const k = useMemo(() => kpis(ws, stats, range), [ws, stats, range])
  const idx = useMemo(() => strengthIndex(stats, range), [stats, range])
  const gain = idx.length > 1 ? idx[idx.length - 1].index / idx[0].index - 1 : 0

  const save = async () => {
    if (!ref.current) return
    setBusy(true)
    try {
      const url = await toPng(ref.current, { pixelRatio: 3, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = 'statlift.png'
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Share">
        <div className="modal-head">
          <span className="h2">Share</span>
          <button className="ghost icon" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <div ref={ref} className="share">
          <div className="s-name"><Logo /> Statlift</div>
          <div className="s-big">{gain > 0.01 ? `${Math.round(gain * 100)}% stronger` : `${k.workouts} workouts`}</div>
          <div className="s-sub">{fmtDate(ws[0]?.start ?? range.from)} to {fmtDate(ws.at(-1)?.start ?? range.to)}</div>
          {idx.length > 1 && (
            <div className="s-chart">
              <ResponsiveContainer>
                <AreaChart data={idx} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="share-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2447c7" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="#2447c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Area type="monotone" dataKey="index" stroke="#2447c7" strokeWidth={2.25} fill="url(#share-fill)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="s-grid">
            <div><div className="s-v">{k.workouts}</div><div className="s-k">Workouts</div></div>
            <div><div className="s-v">{compact(toUnit(k.volume, unit))}</div><div className="s-k">{unit} lifted</div></div>
            <div><div className="s-v">{k.prs}</div><div className="s-k">New bests</div></div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 13 }}>Uses the date range you picked.</span>
          <button className="btn solid" onClick={save} disabled={busy}><Icon.download /> {busy ? 'Saving' : 'Save image'}</button>
        </div>
      </div>
    </div>
  )
}
