import { useMemo } from 'react'
import { Back, Icon } from '../components/ui'
import { go, liftPath } from '../lib/route'
import { useApp } from '../lib/store'
import { KIND_ORDER, KIND_TITLE, URGENT, watchOuts, type Watch as Item } from '../lib/watch'

export function Watch() {
  const { all, stats, unit } = useApp()
  const items = useMemo(() => watchOuts(all, stats, unit), [all, stats, unit])
  const groups = KIND_ORDER.map((k) => ({ k, list: items.filter((i) => i.kind === k) })).filter((g) => g.list.length)
  const jump = (k: string) => document.getElementById(`w-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <Back />
      <section className="hero">
        <div>
          <h1 className="title sm">
            {items.length > 0 && <span className="warn-ic" aria-hidden><Icon.alert /></span>}
            {items.length ? `${items.length} things to watch out for` : 'Nothing to watch out for'}
          </h1>
          <p className="lede">From your recent weights, reps and dates.</p>
        </div>
      </section>

      {items.length > 0 && (
        <nav className="w-summary" aria-label="Sections">
          {groups.map((g) => (
            <button key={g.k} className="w-sum" onClick={() => jump(g.k)}>
              <span className={`w-sum-n ${URGENT.includes(g.k) ? 'urgent' : ''}`}>{g.list.length}</span>
              <span className="w-sum-k">{KIND_TITLE[g.k]}</span>
            </button>
          ))}
        </nav>
      )}

      {groups.map((g) => (
        <section className="panel w-section" key={g.k} id={`w-${g.k}`}>
          <h2 className="h2">{KIND_TITLE[g.k]}</h2>
          <div className="w-card">
            {g.list.map((w, i) => (<Row key={i} w={w} urgent={URGENT.includes(g.k)} />))}
          </div>
        </section>
      ))}
      {!items.length && <p className="empty">No stalled lifts, sudden jumps or gaps in your recent training.</p>}
    </>
  )
}

function Row({ w, urgent }: { w: Item; urgent: boolean }) {
  const inner = (
    <>
      <div className="w-stat">
        <div className={`w-stat-v ${urgent ? 'urgent' : ''}`}>{w.stat}</div>
        <div className="w-stat-k">{w.statLabel}</div>
      </div>
      <div className="w-main">
        <div className="w-subject">{w.subject}</div>
        <p className="w-issue">{w.body}</p>
        <div className="w-tip">
          <span className="w-tip-k">What to do</span>
          {w.tip}
        </div>
      </div>
      <div className="w-go">{w.lift && <Icon.chevron />}</div>
    </>
  )
  return w.lift ? (
    <button className="w-row link" onClick={() => go(liftPath(w.lift!))}>{inner}</button>
  ) : (
    <div className="w-row">{inner}</div>
  )
}
