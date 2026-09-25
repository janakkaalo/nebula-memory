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
  // Refs mirror state so rapid taps never read a stale closure.
  // Synced in effects (not during render) + immediately in handlers.
  const seqRef = useRef(seq)
  const inputRef = useRef(input)
  const phaseRef = useRef(phase)
  const mistakesRef = useRef(mistakes)
  const speedRef = useRef(speed)
  const secsRef = useRef(secs)
  const roundRef = useRef(round)
  const playRef = useRef(play)
  const onWinRef = useRef(onWin)
  useEffect(() => { seqRef.current = seq }, [seq])
  useEffect(() => { inputRef.current = input }, [input])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { mistakesRef.current = mistakes }, [mistakes])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { secsRef.current = secs }, [secs])
  useEffect(() => { roundRef.current = round }, [round])
  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => { onWinRef.current = onWin }, [onWin])

  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id)
      fn()
    }, ms)
    timers.current.push(id)
    return id
  }

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  function start() {
    clearTimers()
    resetSecs()
    setMistakes(0)
    mistakesRef.current = 0
    setInput([])
    inputRef.current = []
    const first = Math.floor(Math.random() * 4)
    const s = [first]
    setSeq(s)
    seqRef.current = s
    setRound(1)
    roundRef.current = 1
    setBest((b) => Math.max(b, 1))
    showSeq(s)
    buzz(20)
  }

  function showSeq(s) {
    clearTimers()
    const cfg = SPEEDS[speedRef.current]
    // accelerate slightly as sequence grows, never below readability floor
    const step = Math.max(340, cfg.step - s.length * 18)
    setPhase('showing')
    phaseRef.current = 'showing'
    setInput([])
    inputRef.current = []
    setLit(-1)
    s.forEach((v, i) => {
      later(() => {
        setLit(v)
        buzz(12)
        try {
          playRef.current(ORBS[v].freq, 0.28, 'sine', 0.16)
          later(() => { try { playRef.current(ORBS[v].freq * 2, 0.2, 'sine', 0.05) } catch { /* noop */ } }, 60)
        } catch { /* noop */ }
        later(() => setLit((cur) => (cur === v ? -1 : cur)), cfg.lit)
      }, step * i + 420)
    })
    later(() => {
      setPhase('input')
      phaseRef.current = 'input'
      setLit(-1)
    }, step * s.length + 480)
  }

  function press(i) {
    if (phaseRef.current !== 'input') return
    try { playRef.current(ORBS[i].freq, 0.16) } catch { /* noop */ }
    buzz(10)
    setLit(i)
    later(() => setLit((cur) => (cur === i ? -1 : cur)), 180)
    const next = [...inputRef.current, i]
    inputRef.current = next
    setInput(next)
    const idx = next.length - 1
    const curSeq = seqRef.current
    if (next[idx] !== curSeq[idx]) {
      try { playRef.current(140, 0.3, 'sawtooth', 0.1) } catch { /* noop */ }
      buzz(70)
      const m = mistakesRef.current + 1
      mistakesRef.current = m
      setMistakes(m)
      if (m >= 2) {
        setPhase('lost')
        phaseRef.current = 'lost'
        clearTimers()
        setLit(-1)
        buzz([80, 50, 80])
        onWinRef.current({ score: Math.max(20, roundRef.current * 40 - secsRef.current), moves: roundRef.current, time: secsRef.current, lost: true })
      } else {
        setPhase('showing')
        phaseRef.current = 'showing'
        try { playRef.current(300, 0.2, 'sine', 0.08) } catch { /* noop */ }
        later(() => showSeq(seqRef.current), 750)
      }
      return
    }
    if (next.length === curSeq.length) {
      if (curSeq.length >= 10) {
        setPhase('champion')
        phaseRef.current = 'champion'
        clearTimers()
        setLit(-1)
        buzz([25, 30, 40, 30, 100])
        try {
          playRef.current(660, 0.15)
          later(() => { try { playRef.current(880, 0.2) } catch { /* noop */ } }, 120)
          later(() => { try { playRef.current(1174, 0.3) } catch { /* noop */ } }, 260)
        } catch { /* noop */ }
        const sp = speedRef.current
        onWinRef.current({ score: 1000 + Math.max(0, 300 - secsRef.current * 2) + (sp === 'blitz' ? 250 : sp === 'chill' ? 0 : 100), moves: curSeq.length, time: secsRef.current })
        return
      }
      const v = Math.floor(Math.random() * 4)
      const s2 = [...curSeq, v]
      seqRef.current = s2
      setSeq(s2)
      setRound(s2.length)
      roundRef.current = s2.length
      setBest((b) => Math.max(b, s2.length))
      setPhase('showing')
      phaseRef.current = 'showing'
      try { playRef.current(ORBS[v].freq, 0.1, 'sine', 0.06) } catch { /* noop */ }
      later(() => showSeq(s2), 820)
    }
  }

  const progress = Math.min(1, seq.length / 10)
  const inputLeft = Math.max(0, seq.length - input.length)

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
        {phase === 'idle' && <button type="button" className="btn small primary" onClick={start}>▶ Start pattern</button>}
        {(phase === 'lost' || phase === 'champion') && <button type="button" className="btn small primary" onClick={start}>↻ Play again</button>}
        <span style={{ display: 'flex', gap: 6 }}>
          {Object.entries(SPEEDS).map(([k, s]) => (
            <button key={k} type="button" className={`btn small ${speed === k ? 'primary' : 'ghost'}`} disabled={phase === 'showing' || phase === 'input'} onClick={() => { setSpeed(k); speedRef.current = k }}>{s.label}</button>
          ))}
        </span>
        <span className="cube-hint" style={{
          color: phase === 'input' ? '#67e8f9' : phase === 'showing' ? '#fcd34d' : undefined,
          fontWeight: 700,
        }}>
          {phase === 'idle' && 'Press start. Sound on for full effect.'}
          {phase === 'input' && `● Your turn — ${inputLeft} left`}
          {phase === 'showing' && '◌ Watch closely…'}
          {phase === 'lost' && `Two misses. Round ${round} reached.`}
          {phase === 'champion' && '10 steps cleared. Memory master.'}
        </span>
      </div>
      <div className="pulse-board">
        {ORBS.map((o, i) => (
          <button
            key={o.name}
            type="button"
            className={`pulse-orb orb-${i} ${lit === i ? 'lit' : ''}`}
            onClick={() => press(i)}
            disabled={phase !== 'input'}
            aria-label={`${o.name} orb ${i + 1}`}
            aria-pressed={lit === i}
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
