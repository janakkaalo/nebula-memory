import { useCallback, useEffect, useState } from 'react'

const KEY = 'nebula-memory-best-v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export function useBestScores() {
  const [best, setBest] = useState(load)

  const saveBest = useCallback((gameId, entry) => {
    setBest((prev) => {
      const cur = prev[gameId]
      const better =
        !cur ||
        (entry.score ?? 0) > (cur.score ?? 0) ||
        ((entry.score ?? 0) === (cur.score ?? 0) && (entry.moves ?? 9999) < (cur.moves ?? 9999))
      if (!better) return prev
      const next = { ...prev, [gameId]: entry }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    setBest({})
  }, [])

  return { best, saveBest, clearAll }
}

export function useTimer(running) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const reset = useCallback(() => setSecs(0), [])
  return [secs, reset]
}

export function formatTime(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}
