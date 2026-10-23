import { useEffect, useState } from 'react'

export type Route =
  | { page: 'home' }
  | { page: 'lift'; name: string }
  | { page: 'lifts' }
  | { page: 'records' }
  | { page: 'calendar' }
  | { page: 'balance' }
  | { page: 'habits' }
  | { page: 'watch' }

/** Hash routes so the browser back button works and links can be shared. */
export function parse(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/')
  if (a === 'lift' && b) return { page: 'lift', name: decodeURIComponent(b) }
  if (a === 'lifts' || a === 'records' || a === 'calendar' || a === 'balance' || a === 'habits' || a === 'watch') return { page: a }
  return { page: 'home' }
}

export function go(path: string) {
  window.location.hash = path ? `/${path}` : ''
}

export const liftPath = (name: string) => `lift/${encodeURIComponent(name)}`

export function useRoute(): Route {
  const [r, setR] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const on = () => {
      setR(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
