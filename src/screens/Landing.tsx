import { useRef, useState } from 'react'
import { ParseError } from '../lib/parse'

export function Landing({ onCsv, onSample }: { onCsv: (text: string, name: string) => void; onSample: () => void }) {
  const [over, setOver] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const read = async (f: File | undefined) => {
    if (!f) return
    setErr(null)
    try {
      onCsv(await f.text(), f.name)
    } catch (e) {
      setErr(e instanceof ParseError ? e.message : 'This file could not be read. Use the CSV that Hevy exports.')
    }
  }

  return (
    <section className="landing">
      <h1 className="title">See how strong you have become.</h1>
      <p className="lede">Statlift reads your Hevy workout export and shows your progress on every lift. Your file stays on this device.</p>

      <div
        className={`drop ${over ? 'over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          read(e.dataTransfer.files[0])
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      >
        <p>Drop your Hevy CSV file here</p>
        <div className="drop-row">
          <button className="btn solid" onClick={(e) => { e.stopPropagation(); input.current?.click() }}>Choose file</button>
          <button className="btn" onClick={(e) => { e.stopPropagation(); onSample() }}>Try sample data</button>
        </div>
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => read(e.target.files?.[0])} />
      </div>
      {err && <p className="err">{err}</p>}

      <p className="howto">
        To get the file, open Hevy and go to <b>Profile</b>, then <b>Settings</b>, then <b>Export &amp; Import Data</b>, then <b>Export Workouts</b>.
      </p>
    </section>
  )
}
