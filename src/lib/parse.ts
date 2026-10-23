import Papa from 'papaparse'
import type { Dataset, SetType, Unit, Workout, WorkSet } from './types'

const LB = 0.45359237
const MILE = 1.609344

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

/** Hevy has shipped a few date formats over the years. Handle all we know. */
export function parseHevyDate(raw: string): Date | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  // "23 Oct 2026, 13:56"
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (mon !== undefined) return mk(+m[3], mon, +m[1], +m[4], +m[5], m[6] ? +m[6] : 0, m[7])
  }
  // "Oct 23, 2026, 1:56 PM"
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()]
    if (mon !== undefined) return mk(+m[3], mon, +m[2], +m[4], +m[5], m[6] ? +m[6] : 0, m[7])
  }
  // "2026-10-23 13:56:00" or ISO
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) return mk(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0)
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function mk(y: number, mo: number, d: number, h: number, mi: number, se: number, ampm?: string) {
  if (ampm) {
    const pm = ampm.toLowerCase() === 'pm'
    if (h === 12) h = pm ? 12 : 0
    else if (pm) h += 12
  }
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
  const sourceUnit: Unit = cols.includes('weight_lbs') && !cols.includes('weight_kg') ? 'lbs' : 'kg'
  const distMiles = cols.includes('distance_miles') && !cols.includes('distance_km')

  const byId = new Map<string, Workout>()
  for (const r of rows) {
    const start = parseHevyDate(r.start_time)
    if (!start) continue
    const end = parseHevyDate(r.end_time) ?? start
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

const KEY = 'liftlog:csv'
const KEY_NAME = 'liftlog:csvName'

export function saveCsv(text: string, name: string) {
  try {
    localStorage.setItem(KEY, text)
    localStorage.setItem(KEY_NAME, name)
  } catch {
    /* quota or private mode: fine, it just won't persist */
  }
}

export function loadCsv(): { text: string; name: string } | null {
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return null
    return { text, name: localStorage.getItem(KEY_NAME) || 'workouts.csv' }
  } catch {
    return null
  }
}

export function clearCsv() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(KEY_NAME)
  } catch {
    /* ignore */
  }
}
