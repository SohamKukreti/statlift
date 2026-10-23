import { useEffect } from 'react'
import rough from 'roughjs'
import { LITE } from '../lib/lite'
import { useChart } from '../lib/theme'

/** Pattern id for a colour: chart fills use pen hatching, like Excalidraw. The lite look uses a flat tint. */
export const hatch = (color: string) => (LITE ? `${color}38` : `url(#h-${color.replace('#', '')})`)

/**
 * One hidden SVG with the shared chart tools:
 * - `#rough-line` makes chart marks wobble a little, like a line drawn by hand.
 * - `#h-<hex>` is a diagonal hatch fill in that colour.
 */
export function SketchDefs() {
  const t = useChart()
  if (LITE) return null
  const colors = [...new Set([t.primary, t.axis, ...t.series])]
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="rough-line" filterUnits="userSpaceOnUse" x="-20" y="-20" width="2000" height="900">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="1" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {colors.map((c) => (
          <pattern key={c} id={`h-${c.replace('#', '')}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="6" height="6" fill={c} fillOpacity={0.12} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={c} strokeWidth="1.6" />
          </pattern>
        ))}
      </defs>
    </svg>
  )
}

/* ------------------------- hand-drawn box outlines ------------------------- */

/** Elements that get a pen outline. CSS sets the pen with --sk-c (colour), --sk-w (width), --sk-shape and --sk-dash. */
const BOXES = [
  '.panel', 'details.more', '.watch-line', '.momentum', '.w-card', '.numbers > div', '.w-sum', '.btn', '.sample-note',
  '.menu', '.modal', '.tip', '.w-tip', '.drop', '.tile', '.range button.on', '.seg button.on',
].join(',')

const gen = rough.generator()
const seeds = new WeakMap<Element, number>()
let nextSeed = 1
const PAD = 4

function roundedRect(w: number, h: number, r: number, p: number) {
  const x0 = p, y0 = p, x1 = w - p, y1 = h - p
  return `M${x0 + r} ${y0} L${x1 - r} ${y0} Q${x1} ${y0} ${x1} ${y0 + r} L${x1} ${y1 - r} Q${x1} ${y1} ${x1 - r} ${y1} L${x0 + r} ${y1} Q${x0} ${y1} ${x0} ${y1 - r} L${x0} ${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} Z`
}

/** Draws the outline with roughjs (what Excalidraw uses) and hands it to the element's ::before as a background. */
function draw(el: HTMLElement) {
  // The drawing layer reaches PAD px past each edge, so a line that bows outward is not cut off.
  const w = el.offsetWidth + PAD * 2, h = el.offsetHeight + PAD * 2
  if (w <= PAD * 2 || h <= PAD * 2) return
  const cs = getComputedStyle(el)
  const color = cs.getPropertyValue('--sk-c').trim() || '#111'
  const width = parseFloat(cs.getPropertyValue('--sk-w')) || 1.6
  const dash = cs.getPropertyValue('--sk-dash').trim() === 'on'
  if (!seeds.has(el)) seeds.set(el, nextSeed++)
  const opts = { seed: seeds.get(el), stroke: color, strokeWidth: width, roughness: 0.9, bowing: 0.8, disableMultiStroke: dash }
  const shape = cs.getPropertyValue('--sk-shape').trim() === 'ellipse'
    ? gen.ellipse(w / 2, h / 2, w - PAD * 2 - 2, h - PAD * 2 - 1, opts)
    : gen.path(roundedRect(w, h, Math.min(12, h / 3), PAD + 1), opts)
  const paths = gen.toPaths(shape).map((p) => `<path d="${p.d}" fill="none" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round"${dash ? ' stroke-dasharray="6 6"' : ''}/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`
  el.style.setProperty('--sk', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
}

/** Keeps every box outline drawn: new boxes, resized boxes and theme changes all redraw. */
export function useSketchBoxes() {
  useEffect(() => {
    if (LITE) return // the lite look draws plain CSS borders instead
    const sizes = new WeakMap<Element, string>()
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement
        const key = `${el.offsetWidth}x${el.offsetHeight}`
        if (sizes.get(el) === key) continue
        sizes.set(el, key)
        draw(el)
      }
    })
    const watched = new Set<HTMLElement>()
    const scan = () => {
      for (const el of watched) {
        if (el.isConnected && el.matches(BOXES)) continue
        ro.unobserve(el)
        watched.delete(el)
        sizes.delete(el)
        el.style.removeProperty('--sk')
      }
      document.querySelectorAll<HTMLElement>(BOXES).forEach((el) => {
        if (watched.has(el)) return
        watched.add(el)
        ro.observe(el)
      })
    }
    const redrawAll = () => requestAnimationFrame(() => watched.forEach(draw))
    let queued = false
    const mo = new MutationObserver(() => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        scan()
      })
    })
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    const themeMo = new MutationObserver(redrawAll)
    themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-font'] })
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', redrawAll)
    scan()
    return () => {
      ro.disconnect()
      mo.disconnect()
      themeMo.disconnect()
      mq.removeEventListener('change', redrawAll)
    }
  }, [])
}
