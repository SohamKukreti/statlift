import { useApp, type Preset } from '../lib/store'

const OPTS: { v: Preset; label: string }[] = [
  { v: '90', label: '3M' },
  { v: '180', label: '6M' },
  { v: '365', label: '1Y' },
  { v: 'all', label: 'All' },
  { v: 'custom', label: 'Custom' },
]

const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function RangeControl() {
  const { preset, setPreset, custom, setCustom, range } = useApp()
  return (
    <div>
      <div className="range" role="radiogroup" aria-label="Date range">
        {OPTS.map((o) => (
          <button
            key={o.v}
            className={preset === o.v ? 'on' : ''}
            role="radio"
            aria-checked={preset === o.v}
            onClick={() => {
              if (o.v === 'custom' && !custom) setCustom({ from: toInput(range.from), to: toInput(range.to) })
              setPreset(o.v)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && custom && (
        <div className="range-custom">
          <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <span className="muted">to</span>
          <input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} aria-label="To" />
        </div>
      )}
    </div>
  )
}
