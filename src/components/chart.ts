import type { ChartTheme } from '../lib/theme'

/** Shared recessive axis + grid styling. */
export const axis = (t: ChartTheme) => ({
  stroke: t.axis,
  tick: { fill: t.axis, fontSize: 12 },
  tickLine: false,
  axisLine: false,
})

export const grid = (t: ChartTheme) => ({ stroke: t.grid, vertical: false })

export const cursorLine = (t: ChartTheme) => ({ stroke: t.axis, strokeWidth: 1 })
export const cursorBar = (t: ChartTheme) => ({ fill: t.grid })

/** Charts stay still. The one exception is the home chart, which draws in once. */
export const STILL = { isAnimationActive: false }
