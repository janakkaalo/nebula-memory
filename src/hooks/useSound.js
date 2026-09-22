import { useCallback, useEffect, useRef, useState } from 'react'

/** Tiny WebAudio blips, no assets. Respects mute + reduced motion (no auto sound). */
export function useSound() {
  const [muted, setMuted] = useState(false)
  const ctxRef = useRef(null)

  function ctx() {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      ctxRef.current = new AC()
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  const play = useCallback((freq = 440, dur = 0.12, type = 'sine', vol = 0.12) => {
    if (muted) return
    try {
      const ac = ctx()
      if (!ac) return
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = type
      o.frequency.value = freq
      g.gain.setValueAtTime(vol, ac.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur)
      o.connect(g).connect(ac.destination)
      o.start()
      o.stop(ac.currentTime + dur)
    } catch { /* ignore */ }
  }, [muted])

  useEffect(() => () => {
    if (ctxRef.current) ctxRef.current.close().catch(() => {})
  }, [])

  return { muted, setMuted, play }
}
