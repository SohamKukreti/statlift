import { useId, type ReactNode } from 'react'
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import { go } from '../lib/route'

/* -------------------------------- tooltip --------------------------------- */

export interface TipRow {
  label: string
  value: string
  color?: string
}

export function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="tip">
      <div className="tip-title">{title}</div>
      {rows.map((r) => (
        <div className="tip-row" key={r.label}>
          <span className="k">
            {r.color && <i className="sw" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="v">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------- controls --------------------------------- */

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} role="radio" aria-checked={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Legend({ items, hidden, onToggle }: { items: { key: string; color: string }[]; hidden?: Set<string>; onToggle?: (k: string) => void }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <button key={it.key} className={hidden?.has(it.key) ? 'off' : ''} onClick={() => onToggle?.(it.key)} type="button">
          <i className="sw" style={{ background: it.color }} />
          {it.key}
        </button>
      ))}
    </div>
  )
}

export function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="spark" />
  return (
    <div className="spark">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 3, right: 2, bottom: 3, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Back({ to = '' }: { to?: string }) {
  return (
    <button className="ghost back" onClick={() => go(to)}>
      <Icon.back /> Back
    </button>
  )
}

/** Collapsed by default: the deeper detail lives here. */
export function More({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <details className="more" id={id}>
      <summary><Icon.chevron /> {label}</summary>
      {children}
    </details>
  )
}

/* --------------------------------- icons ---------------------------------- */

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
export const Icon = {
  sun: () => (<svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>),
  moon: () => (<svg viewBox="0 0 24 24" {...P}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>),
  share: () => (<svg viewBox="0 0 24 24" {...P}><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>),
  gear: () => (<svg viewBox="0 0 24 24" {...P}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>),
  close: () => (<svg viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  download: () => (<svg viewBox="0 0 24 24" {...P}><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>),
  back: () => (<svg viewBox="0 0 24 24" {...P}><path d="M15 18l-6-6 6-6" /></svg>),
  chevron: () => (<svg viewBox="0 0 24 24" {...P}><path d="M9 6l6 6-6 6" /></svg>),
  alert: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>),
  arrow: () => (<svg viewBox="0 0 24 24" {...P}><path d="M7 17L17 7M9 7h8v8" /></svg>),
}
