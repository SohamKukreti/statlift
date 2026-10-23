import { useMemo, useState } from 'react'
import { LiftRow } from '../components/LiftRow'
import { RangeControl } from '../components/RangeControl'
import { Back } from '../components/ui'
import { liftSummaries, type LiftSummary } from '../lib/analytics'
import { GROUPS } from '../lib/muscles'
import { useApp } from '../lib/store'

type Sort = 'sessions' | 'gain' | 'recent' | 'name'

export function Lifts() {
  const { stats, range, unit } = useApp()
  const [sort, setSort] = useState<Sort>('sessions')
  const [group, setGroup] = useState('All')
  const [q, setQ] = useState('')
  const lifts = useMemo(() => liftSummaries(stats, range), [stats, range])

  const shown = useMemo(() => {
    let list = lifts
    if (group !== 'All') list = list.filter((l) => l.stat.group === group)
    if (q) list = list.filter((l) => l.stat.name.toLowerCase().includes(q.toLowerCase()))
    const last = (l: LiftSummary) => l.sessions[l.sessions.length - 1].date.getTime()
    return [...list].sort((a, b) =>
      sort === 'gain' ? b.change - a.change : sort === 'name' ? a.stat.name.localeCompare(b.stat.name) : sort === 'recent' ? last(b) - last(a) : b.sessions.length - a.sessions.length,
    )
  }, [lifts, group, q, sort])

  return (
    <>
      <Back />
      <section className="hero">
        <h1 className="title sm">All lifts</h1>
        <RangeControl />
      </section>
      <section className="panel">
      <div className="row">
        <input className="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lifts" />
        <select className="select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Body part">
          <option value="All">All body parts</option>
          {GROUPS.filter((g) => lifts.some((l) => l.stat.group === g)).map((g) => (<option key={g}>{g}</option>))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="sessions">Most trained</option>
          <option value="gain">Biggest gain</option>
          <option value="recent">Recently trained</option>
          <option value="name">A to Z</option>
        </select>
      </div>
      <div className="list-head"><span>Lift</span><span>Trend</span><span>Est. 1-rep max</span><span>Change</span></div>
      <div className="list">
        {shown.map((l) => (<LiftRow key={l.stat.name} l={l} unit={unit} />))}
        {!shown.length && <p className="empty" style={{ padding: '32px 22px' }}>No lifts match.</p>}
      </div>
      </section>
    </>
  )
}
