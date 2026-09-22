import { useEffect, useRef, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

const ORBS = [
  { emoji: '💧', freq: 262, name: 'Tide' },
  { emoji: '🌸', freq: 330, name: 'Bloom' },
  { emoji: '🔮', freq: 392, name: 'Void' },
  { emoji: '⚡', freq: 494, name: 'Spark' },
]

const SPEEDS = {
  chill: { label: 'Chill', step: 780, lit: 420 },
  normal: { label: 'Normal', step: 620, lit: 340 },
  blitz: { label: 'Blitz', step: 460, lit: 260 },
}

function buzz(p) { try { navigator.vibrate?.(p) } catch { /* noop */ } }

export default function PulseGame({ onWin, play }) {
  const [speed, setSpeed] = useState('normal')
  const [seq, setSeq] = useState([])
  const [input, setInput] = useState([])
  const [lit, setLit] = useState(-1)
  const [phase, setPhase] = useState('idle') // idle | showing | input | lost | champion
  const [round, setRound] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [best, setBest] = useState(0)
  const [secs, resetSecs] = useTimer(phase === 'input' || phase === 'showing')
  const timers = useRef([])
  const seqRef = useRef([])
  seqRef.current = seq

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  function start() {
    clearTimers()
    resetSecs()
    setMistakes(0)
    setInput([])
    const first = Math.floor(Math.random() * 4)
    const s = [first]
    setSeq(s)
    setRound(1)
    setBest((b) => Math.max(b, 1))
    showSeq(s)
    buzz(20)
  }

  function showSeq(s) {
    const cfg = SPEEDS[speed]
    // accelerate slightly as sequence grows
    const step = Math.max(340, cfg.step - s.length * 18)
    setPhase('showing')
    setInput([])
    setLit(-1)
    s.forEach((v, i) => {
      timers.current.push(setTimeout(() => {
        setLit(v)
        buzz(12)
        play(ORBS[v].freq, 0.28, 'sine', 0.16)
        setTimeout(() => play(ORBS[v].freq * 2, 0.2, 'sine', 0.05), 60)
        timers.current.push(setTimeout(() => setLit(-1), cfg.lit))
      }, step * i + 420))
    })
    timers.current.push(setTimeout(() => {
      setPhase('input')
      setLit(-1)
    }, step * s.length + 480))
  }

  function press(i) {
    if (phase !== 'input') return
    play(ORBS[i].freq, 0.16)
    buzz(10)
    setLit(i)
    setTimeout(() => setLit(-1), 180)
    const next = [...input, i]
    setInput(next)
    const idx = next.length - 1
    if (next[idx] !== seq[idx]) {
      play(140, 0.3, 'sawtooth', 0.1)
      buzz(70)
      const m = mistakes + 1
      setMistakes(m)
      if (m >= 2) {
        setPhase('lost')
        buzz([80, 50, 80])
        onWin({ score: Math.max(20, round * 40 - secs), moves: round, time: secs, lost: true })
      } else {
        setPhase('showing')
        play(300, 0.2, 'sine', 0.08)
        const t = setTimeout(() => showSeq(seqRef.current), 750)
        timers.current.push(t)
      }
      return
    }
    if (next.length === seq.length) {
      if (seq.length >= 10) {
        setPhase('champion')
        buzz([25, 30, 40, 30, 100])
        play(660, 0.15); setTimeout(() => play(880, 0.2), 120); setTimeout(() => play(1174, 0.3), 260)
        onWin({ score: 1000 + Math.max(0, 300 - secs * 2) + (speed === 'blitz' ? 250 : speed === 'chill' ? 0 : 100), moves: seq.length, time: secs })
        return
      }
      const v = Math.floor(Math.random() * 4)
      const s2 = [...seq, v]
      setSeq(s2)
      setRound(s2.length)
      setBest((b) => Math.max(b, s2.length))
      setPhase('showing')
      play(ORBS[v].freq, 0.1, 'sine', 0.06)
      const t = setTimeout(() => showSeq(s2), 820)
      timers.current.push(t)
    }
  }

  const progress = Math.min(1, seq.length / 10)

  return (
    <div>
      <div className="hud">
        <span className="chip">Round <b>{round}/10</b></span>
        <span className="chip">Length <b>{seq.length}</b></span>
        <span className="chip">Lives <b>{'❤'.repeat(Math.max(0, 2 - mistakes)) || '—'}</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
        {best > 0 && <span className="chip live-score">Best {best}</span>}
      </div>
      <div className="progress-wrap" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="round-dots" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={i < seq.length ? 'done' : i === seq.length && phase !== 'idle' ? 'now' : ''} />
        ))}
      </div>
      <div className="controls-row">
        {phase === 'idle' && <button className="btn small primary" onClick={start}>▶ Start pattern</button>}
        {(phase === 'lost' || phase === 'champion') && <button className="btn small primary" onClick={start}>↻ Play again</button>}
        <span style={{ display: 'flex', gap: 6 }}>
          {Object.entries(SPEEDS).map(([k, s]) => (
            <button key={k} className={`btn small ${speed === k ? 'primary' : 'ghost'}`} disabled={phase === 'showing' || phase === 'input'} onClick={() => setSpeed(k)}>{s.label}</button>
          ))}
        </span>
        <span className="cube-hint" style={{
          color: phase === 'input' ? '#67e8f9' : phase === 'showing' ? '#fcd34d' : undefined,
          fontWeight: 700,
        }}>
          {phase === 'idle' && 'Press start. Sound on for full effect.'}
          {phase === 'input' && `● Your turn — ${seq.length - input.length} left`}
          {phase === 'showing' && '◌ Watch closely…'}
          {phase === 'lost' && `Two misses. Round ${round} reached.`}
          {phase === 'champion' && '10 steps cleared. Memory master.'}
        </span>
      </div>
      <div className="pulse-board">
        {ORBS.map((o, i) => (
          <button
            key={i}
            className={`pulse-orb orb-${i} ${lit === i ? 'lit' : ''}`}
            onClick={() => press(i)}
            disabled={phase !== 'input'}
            aria-label={`${o.name} orb ${i + 1}`}
          >
            {o.emoji}
          </button>
        ))}
      </div>
      <p className="cube-hint" style={{ textAlign: 'center', marginTop: 10 }}>
        Blitz pays +250 bonus · Normal +100 · Tip: say the names Tide, Bloom, Void, Spark out loud.
      </p>
    </div>
  )
}
