/**
 * Phones and weak devices get the plain look: no pen wobble on chart lines, no roughjs box outlines,
 * flat fills in place of hatching, and no draw-in animation. Those effects are repainted by the CPU on
 * many phones and make scrolling and charts lag. `?lite=1` or `?lite=0` forces the choice, for testing.
 */
const nav = navigator as Navigator & { deviceMemory?: number }
const forced = new URLSearchParams(location.search).get('lite')

export const LITE = forced !== null
  ? forced !== '0'
  : matchMedia('(pointer: coarse), (max-width: 600px), (prefers-reduced-motion: reduce)').matches
    || (navigator.hardwareConcurrency ?? 8) <= 4
    || (nav.deviceMemory ?? 8) <= 4

if (LITE) document.documentElement.dataset.lite = ''
