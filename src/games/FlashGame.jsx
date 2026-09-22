import { useEffect, useRef, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

function randomTargets(count, size) {
  const set = new Set()
  while (set.size < count) set.add(Math.floor(Math.random() * size))
  return [...set]
}

function buzz(p) { try { navigator.vibrate?.(p) } catch { /* noop */ } }

export default function FlashGame({ onWin, play }) {
  const SIZE = 25
  const [level, setLevel] = useState(1)
  const [targets, setTargets] = useState(() => randomTargets(6, SIZE))
  const [hits, setHits] = useState([])
  const [misses, setMisses] = useState([])
  const [phase, setPhase] = useState('show') // show | recall | done | failed
  const [countdown, setCountdown] = useState(3)
  const [secs, resetSecs] = useTimer(phase === 'recall')
  const timer = useRef(null)

  const need = 5 + level
  const left = targets.length - hits.length
  const showPct = phase === 'show' ? Math.round((countdown / 3) * 100) : phase === 'recall' ? Math.round((hits.length / targets.length) * 100) : 100

  function setup(lv) {
    if (timer.current) clearInterval(timer.current)
    const t = randomTargets(5 + lv, SIZE)
    setTargets(t)
    setHits([])
    setMisses([])
    setPhase('show')
    setCountdown(3)
    resetSecs()
    play(440 + lv * 80, 0.1)
    let c = 3
    const id = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c > 0) play(520, 0.07)
      if (c <= 0) {
        clearInterval(id)
        setPhase('recall')
        play(720, 0.14)
      }
    }, 900)
    timer.current = id
  }

  useEffect(() => { setup(1); return () => clearInterval(timer.current) }, []) // eslint-disable-line

  function tap(i) {
    if (phase !== 'recall') return
    if (hits.includes(i) || misses.includes(i)) return
    if (targets.includes(i)) {
      play(620 + hits.length * 45, 0.09)
      buzz(15)
      const h = [...hits, i]
      setHits(h)
      if (h.length === targets.length) {
        if (level >= 5) {
          setPhase('done')
          buzz([30, 40, 60, 40, 100])
          onWin({ score: 900 + Math.max(0, 400 - secs * 3), moves: level, time: secs })
        } else {
          play(880, 0.16)
          setTimeout(() => play(1040, 0.18), 110)
          buzz([25, 30, 50])
          const nl = level + 1
          setLevel(nl)
          setTimeout(() => setup(nl), 700)
        }
      }
    } else {
      play(160, 0.2, 'sawtooth', 0.08)
      buzz(60)
      const m = [...misses, i]
      setMisses(m)
      if (m.length >= 3) {
        setPhase('failed')
        buzz([80, 50, 80])
        onWin({ score: Math.max(30, level * 80 - secs), moves: level, time: secs, lost: true })
      }
    }
  }

  return (
    <div>
      <div className="hud">
        <span className="chip">Sector <b>{level}/5</b></span>
        <span className="chip">Find <b>{left}</b></span>
        <span className="chip">Misses <b>{misses.length}/3</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
      </div>
      <div className="progress-wrap" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${showPct}%` }} />
      </div>
      <div className="controls-row">
        <span className="level-dots" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((l) => <i key={l} className={l <= level ? 'on' : ''} />)}
        </span>
        {phase === 'show' && (
          <span className="count-ring" style={{ '--p': `${(countdown / 3) * 100}%` }} aria-label={`${countdown} seconds to memorize`}>
            <b>{countdown}</b>
          </span>
        )}
        <span className="cube-hint">
          {phase === 'show' && `Memorize ${targets.length} glowing tiles…`}
          {phase === 'recall' && `Tap the ${targets.length} hidden tiles.`}
          {phase === 'done' && 'All 5 sectors cleared. Stellar recall.'}
          {phase === 'failed' && `Signal lost at sector ${level}. Try again.`}
        </span>
        <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => { setLevel(1); setup(1) }}>↻ Restart</button>
      </div>
      <div className="flash-grid" role="grid" aria-label="Flash recall grid">
        {Array.from({ length: SIZE }).map((_, i) => {
          const show = phase === 'show' && targets.includes(i)
          const hit = hits.includes(i)
          const miss = misses.includes(i)
          const dimMiss = phase === 'recall' && misses.length >= 2 && !hit && !miss ? '' : ''
          return (
            <button
              key={i}
              role="gridcell"
              className={`flash-cell ${show ? 'show' : ''} ${hit ? 'hit' : ''} ${miss ? 'miss' : ''} ${dimMiss}`}
              onClick={() => tap(i)}
              disabled={phase !== 'recall'}
              aria-label={hit ? `found tile ${i + 1}` : `cell ${i + 1}`}
            >
              {hit ? '✦' : show ? '●' : ''}
            </button>
          )
        })}
      </div>
      <p style={{ display: 'none' }}>{need}</p>
    </div>
  )
}
