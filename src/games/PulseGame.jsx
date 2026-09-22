import { useEffect, useRef, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

const ORBS = [
  { emoji: '💧', freq: 262 },
  { emoji: '🌸', freq: 330 },
  { emoji: '🔮', freq: 392 },
  { emoji: '⚡', freq: 494 },
]

export default function PulseGame({ onWin, play }) {
  const [seq, setSeq] = useState([])
  const [input, setInput] = useState([])
  const [lit, setLit] = useState(-1)
  const [phase, setPhase] = useState('idle') // idle | showing | input | lost | champion
  const [round, setRound] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [secs, resetSecs] = useTimer(phase === 'input' || phase === 'showing')
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  function start() {
    clearTimers()
    resetSecs()
    setMistakes(0)
    const first = Math.floor(Math.random() * 4)
    const s = [first]
    setSeq(s)
    setRound(1)
    showSeq(s)
  }

  function showSeq(s) {
    setPhase('showing')
    setInput([])
    setLit(-1)
    s.forEach((v, i) => {
      timers.current.push(setTimeout(() => {
        setLit(v)
        play(ORBS[v].freq, 0.28, 'sine', 0.16)
        timers.current.push(setTimeout(() => setLit(-1), 340))
      }, 650 * i + 400))
    })
    timers.current.push(setTimeout(() => {
      setPhase('input')
      setLit(-1)
    }, 650 * s.length + 450))
  }

  function press(i) {
    if (phase !== 'input') return
    play(ORBS[i].freq, 0.16)
    setLit(i)
    setTimeout(() => setLit(-1), 180)
    const next = [...input, i]
    setInput(next)
    const idx = next.length - 1
    if (next[idx] !== seq[idx]) {
      play(140, 0.3, 'sawtooth', 0.1)
      const m = mistakes + 1
      setMistakes(m)
      if (m >= 2) {
        setPhase('lost')
        onWin({ score: Math.max(20, round * 40 - secs), moves: round, time: secs, lost: true })
      } else {
        setPhase('showing')
        setTimeout(() => showSeq(seq), 700)
      }
      return
    }
    if (next.length === seq.length) {
      if (seq.length >= 10) {
        setPhase('champion')
        onWin({ score: 1000 + Math.max(0, 300 - secs * 2), moves: seq.length, time: secs })
        return
      }
      const v = Math.floor(Math.random() * 4)
      const s2 = [...seq, v]
      setSeq(s2)
      setRound(s2.length)
      setPhase('showing')
      setTimeout(() => showSeq(s2), 800)
    }
  }

  return (
    <div>
      <div className="hud">
        <span className="chip">Round <b>{round}</b></span>
        <span className="chip">Length <b>{seq.length}</b></span>
        <span className="chip">Lives <b>{2 - mistakes}/2</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
      </div>
      <div className="controls-row">
        {phase === 'idle' && <button className="btn small primary" onClick={start}>Start pattern</button>}
        {(phase === 'lost' || phase === 'champion') && <button className="btn small primary" onClick={start}>Play again</button>}
        {phase === 'input' && <span className="cube-hint">Your turn. Repeat the glow.</span>}
        {phase === 'showing' && <span className="cube-hint">Watch closely…</span>}
        {phase === 'lost' && <span className="cube-hint">Two misses. Round {round} reached.</span>}
        {phase === 'champion' && <span className="cube-hint">10 steps cleared. Memory master.</span>}
      </div>
      <div className="pulse-board">
        {ORBS.map((o, i) => (
          <button
            key={i}
            className={`pulse-orb orb-${i} ${lit === i ? 'lit' : ''}`}
            onClick={() => press(i)}
            disabled={phase !== 'input'}
            aria-label={`orb ${i + 1}`}
          >
            {o.emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
