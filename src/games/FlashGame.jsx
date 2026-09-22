import { useEffect, useRef, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

function randomTargets(count, size) {
  const set = new Set()
  while (set.size < count) set.add(Math.floor(Math.random() * size))
  return [...set]
}

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

  const need = 5 + level // level 1 needs 6, up to level 5 needs 10

  function setup(lv) {
    clearTimeout(timer.current)
    const t = randomTargets(5 + lv, SIZE)
    setTargets(t)
    setHits([])
    setMisses([])
    setPhase('show')
    setCountdown(3)
    resetSecs()
    let c = 3
    const id = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        clearInterval(id)
        setPhase('recall')
      }
    }, 900)
    timer.current = id
  }

  useEffect(() => { setup(1); return () => clearTimeout(timer.current) }, []) // eslint-disable-line

  function tap(i) {
    if (phase !== 'recall') return
    if (hits.includes(i) || misses.includes(i)) return
    if (targets.includes(i)) {
      play(660, 0.09)
      const h = [...hits, i]
      setHits(h)
      if (h.length === targets.length) {
        if (level >= 5) {
          setPhase('done')
          onWin({ score: 900 + Math.max(0, 400 - secs * 3), moves: level, time: secs })
        } else {
          play(880, 0.18)
          const nl = level + 1
          setLevel(nl)
          setTimeout(() => setup(nl), 650)
        }
      }
    } else {
      play(160, 0.2, 'sawtooth', 0.08)
      const m = [...misses, i]
      setMisses(m)
      if (m.length >= 3) {
        setPhase('failed')
        onWin({ score: Math.max(30, level * 80 - secs), moves: level, time: secs, lost: true })
      }
    }
  }

  return (
    <div>
      <div className="hud">
        <span className="chip">Level <b>{level}/5</b></span>
        <span className="chip">Find <b>{targets.length - hits.length}</b></span>
        <span className="chip">Misses <b>{misses.length}/3</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
      </div>
      <div className="controls-row">
        <span className="cube-hint">
          {phase === 'show' && `Memorize the glow. Recall in ${countdown}…`}
          {phase === 'recall' && 'Tap the hidden tiles.'}
          {phase === 'done' && 'All 5 sectors cleared.'}
          {phase === 'failed' && 'Signal lost. Try again.'}
        </span>
        <button className="btn small ghost" onClick={() => { setLevel(1); setup(1) }}>Restart</button>
      </div>
      <div className="flash-grid" role="grid" aria-label="Flash recall grid">
        {Array.from({ length: SIZE }).map((_, i) => {
          const show = phase === 'show' && targets.includes(i)
          const hit = hits.includes(i)
          const miss = misses.includes(i)
          return (
            <button
              key={i}
              role="gridcell"
              className={`flash-cell ${show ? 'show' : ''} ${hit ? 'hit' : ''} ${miss ? 'miss' : ''}`}
              onClick={() => tap(i)}
              disabled={phase !== 'recall'}
              aria-label={hit ? 'found' : `cell ${i + 1}`}
            >
              {hit ? '✦' : ''}
            </button>
          )
        })}
      </div>
      <p style={{ display: 'none' }}>{need}</p>
    </div>
  )
}
