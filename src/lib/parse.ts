import Papa from 'papaparse'
import type { Dataset, SetType, Unit, Workout, WorkSet } from './types'

const LB = 0.45359237
const MILE = 1.609344

/**
 * Month name stems in the languages Hevy exports in (en, de, fr, es, it, pt, nl, pl, tr, ru).
 * A name matches the longest stem it starts with, after lowercasing and dropping accents and dots.
 */
const MONTH_STEMS: string[][] = [
  ['jan', 'ene', 'gen', 'sty', 'oca', 'янв'],
  ['feb', 'fev', 'lut', 'sub', 'фев'],
  ['mar', 'mrz', 'mrt', 'мар'],
  ['apr', 'avr', 'abr', 'kwi', 'nis', 'апр'],
  ['may', 'mai', 'mag', 'mei', 'maj', 'мая', 'май'],
  ['jun', 'juin', 'giu', 'cze', 'haz', 'июн'],
  ['jul', 'juil', 'lug', 'lip', 'tem', 'июл'],
  ['aug', 'aout', 'ago', 'sie', 'agu', 'авг'],
  ['sep', 'set', 'wrz', 'eyl', 'сен'],
  ['oct', 'okt', 'ott', 'out', 'paz', 'eki', 'окт'],
  ['nov', 'lis', 'kas', 'ноя'],
  ['dec', 'dez', 'dic', 'gru', 'ara', 'дек'],
]

function monthOf(word: string): number | null {
  const w = word.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ.]/g, '')
  let best: number | null = null, len = 0
  MONTH_STEMS.forEach((stems, i) => {
    for (const s of stems) if (w.startsWith(s) && s.length > len) (best = i), (len = s.length)
  })
  return best
}

/** Order of an all-number date like 03/12/2023. Only a file-wide look can tell day-first from month-first. */
export type NumOrder = 'dmy' | 'mdy'

/**
 * Hevy writes dates in the language of the app or website, and has changed the format over the years:
 * "23 Oct 2026, 13:56", "Oct 23, 2026, 1:56 PM", "20.01.2025, 12:00", "20 janv. 2025, 12:00",
 * "2025/01/20 12:00", "20 Oca 2025 12:00", ISO. Handle all we know.
 */
export function parseHevyDate(raw: string, order: NumOrder = 'dmy'): Date | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  // "2026-10-23 13:56:00" or ISO. With a zone it is an exact time, so the built-in parser is right.
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    if (/[zZ]|[+-]\d{2}(:?\d{2})?$/.test(s.slice(10))) {
      const d = new Date(s.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
      if (!isNaN(d.getTime())) return d
    }
    return mk(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
  }

  // time of day: the last h:mm, with am/pm in any of the forms locales use
  const times = [...s.matchAll(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?!\d)/g)].filter((t) => t.index! > 0 && /\s/.test(s[t.index! - 1]))
  const t = times.at(-1)
  const datePart = t ? s.slice(0, t.index) : s
  const rest = t ? s.slice(t.index! + t[0].length) : ''
  const pm = /\bp\.?\s?m\b\.?|오후|午後|下午/i.test(rest + ' ' + datePart)
  const am = /\ba\.?\s?m\b\.?|오전|午前|上午/i.test(rest + ' ' + datePart)
  let h = t ? +t[1] : 0
  if (pm && h < 12) h += 12
  else if (am && h === 12) h = 0
  const mi = t ? +t[2] : 0, se = t?.[3] ? +t[3] : 0

  const nums = [...datePart.matchAll(/\d+/g)].map((x) => x[0])
  const word = datePart.match(/\p{L}{2,}/u)?.[0]
  const mon = word ? monthOf(word) : null
  const year = (y: string) => (y.length <= 2 ? 2000 + +y : +y)

  if (mon !== null) {
    // "23 Oct 2026", "Oct 23, 2026", "20 de ene. de 2025"
    const y = nums.find((n) => n.length === 4)
    const d = nums.find((n) => n.length <= 2)
    if (y && d) return mk(+y, mon, +d, h, mi, se)
  } else if (nums.length >= 3) {
    const [a, b, c] = nums
    // "2025/01/20", "2025. 1. 20.", "2025年1月20日"
    if (a.length === 4) return mk(+a, +b - 1, +c, h, mi, se)
    // "20.01.2025" is always day first; slashes and dashes follow the file
    const dayFirst = /^\s*\d+\./.test(datePart) || order === 'dmy'
    return dayFirst ? mk(year(c), +b - 1, +a, h, mi, se) : mk(year(c), +a - 1, +b, h, mi, se)
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** For all-number dates, find the order: a first part over 12 means day first, a second part over 12 means month first. */
export function numOrder(raws: string[]): NumOrder {
  for (const r of raws) {
    const m = (r ?? '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}/)
    if (!m) continue
    if (+m[1] > 12) return 'dmy'
    if (+m[2] > 12) return 'mdy'
  }
  return 'dmy'
}

function mk(y: number, mo: number, d: number, h: number, mi: number, se: number) {
  if (!(mo >= 0 && mo <= 11 && d >= 1 && d <= 31 && h <= 23 && mi <= 59)) return null
  return new Date(y, mo, d, h, mi, se)
}

function num(v: unknown): number | null {
  if (v === undefined || v === null) return null
  const s = String(v).trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return isFinite(n) ? n : null
}

function setType(v: unknown): SetType {
  const s = String(v ?? '').trim().toLowerCase()
  if (s.startsWith('warm')) return 'warmup'
  if (s.startsWith('drop')) return 'dropset'
  if (s.startsWith('fail')) return 'failure'
  return 'normal'
}

export class ParseError extends Error {}

export type Row = Record<string, string>

export function parseCsvText(text: string, fileName: string): Dataset {
  const res = Papa.parse<Row>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  return rowsToDataset(res.data, fileName, false)
}

export function rowsToDataset(rows: Row[], fileName: string, isSample: boolean): Dataset {
  if (!rows.length) throw new ParseError('This file has no rows.')
  const cols = Object.keys(rows[0])
  const need = ['title', 'start_time', 'exercise_title']
  const missing = need.filter((c) => !cols.includes(c))
  if (missing.length) {
    throw new ParseError(
      `This does not look like a Hevy export. Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
    )
  }
  // Hevy writes one weight and one distance column. If a file has both, use the one that holds the numbers.
  const filled = (c: string) => (cols.includes(c) ? rows.filter((r) => (num(r[c]) ?? 0) > 0).length : -1)
  const sourceUnit: Unit = filled('weight_lbs') > filled('weight_kg') ? 'lbs' : 'kg'
  const distMiles = filled('distance_miles') > filled('distance_km')

  const order = numOrder(rows.map((r) => r.start_time))
  const byId = new Map<string, Workout>()
  for (const r of rows) {
    const start = parseHevyDate(r.start_time, order)
    if (!start) continue
    const end = parseHevyDate(r.end_time, order) ?? start
    const id = `${start.getTime()}|${r.title}`
    let w = byId.get(id)
    if (!w) {
      const durationMin = Math.max(0, (end.getTime() - start.getTime()) / 60000)
      w = { id, title: (r.title || 'Workout').trim(), start, end, durationMin, exercises: [] }
      byId.set(id, w)
    }
    const name = (r.exercise_title || '').trim()
    if (!name) continue
    // Same exercise can appear twice in a workout; group consecutive rows only.
    let ex = w.exercises[w.exercises.length - 1]
    if (!ex || ex.name !== name) {
      ex = { name, notes: (r.exercise_notes || '').trim(), sets: [] }
      w.exercises.push(ex)
    }
    const wRaw = sourceUnit === 'lbs' ? num(r.weight_lbs) : num(r.weight_kg)
    const dRaw = distMiles ? num(r.distance_miles) : num(r.distance_km)
    const set: WorkSet = {
      index: num(r.set_index) ?? ex.sets.length,
      type: setType(r.set_type),
      weightKg: wRaw === null ? null : sourceUnit === 'lbs' ? wRaw * LB : wRaw,
      reps: num(r.reps),
      distanceKm: dRaw === null ? null : distMiles ? dRaw * MILE : dRaw,
      durationS: num(r.duration_seconds),
      rpe: num(r.rpe),
    }
    ex.sets.push(set)
  }
  const workouts = [...byId.values()].sort((a, b) => a.start.getTime() - b.start.getTime())
  if (!workouts.length) throw new ParseError('Could not read any workouts. The dates in the file may be in an unknown format.')
  return { workouts, sourceUnit, fileName, isSample }
}

/* ---------- storage: keep the raw CSV so a reload restores everything ---------- */

// IndexedDB, not localStorage: localStorage holds about 5 MB, and a few years of Hevy logs is more.
// Older versions kept the file in localStorage, so it is still read from there once.
const KEY = 'liftlog:csv'
const KEY_NAME = 'liftlog:csvName'
type Saved = { text: string; name: string }

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('statlift', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('files')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const req = run(db.transaction('files', mode).objectStore('files'))
      req.onsuccess = () => (resolve(req.result), db.close())
      req.onerror = () => (reject(req.error), db.close())
    }
  })
}

function clearLegacy() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(KEY_NAME)
  } catch {
    /* ignore */
  }
}

export async function saveCsv(text: string, name: string) {
  try {
    await idb('readwrite', (s) => s.put({ text, name } satisfies Saved, 'csv'))
    clearLegacy()
  } catch {
    /* private mode or no space: fine, it just won't persist */
  }
}

export async function loadCsv(): Promise<Saved | null> {
  try {
    const saved = await idb<Saved | undefined>('readonly', (s) => s.get('csv'))
    if (saved?.text) return saved
  } catch {
    /* fall through to the old place */
  }
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return null
    return { text, name: localStorage.getItem(KEY_NAME) || 'workouts.csv' }
  } catch {
    return null
  }
}

export async function clearCsv() {
  clearLegacy()
  try {
    await idb('readwrite', (s) => s.delete('csv'))
  } catch {
    /* ignore */
  }
}
