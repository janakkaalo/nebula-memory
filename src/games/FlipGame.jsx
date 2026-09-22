import { useEffect, useMemo, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

const SETS = {
  easy: { label: 'Easy 4×3', symbols: ['🪐', '🌟', '🌙', '🚀', '👾', '☄️'] },
  medium: { label: 'Medium 4×4', symbols: ['🪐', '🌟', '🌙', '🚀', '👾', '☄️', '🛸', '🌌'] },
  hard: { label: 'Hard 6×4', symbols: ['🪐', '🌟', '🌙', '🚀', '👾', '☄️', '🛸', '🌌', '🔭', '👩‍🚀', '🌠', '🛰️'] },
}

function shuffled(pairs) {
  const deck = [...pairs, ...pairs]
    .map((symbol, i) => ({ id: `${symbol}-${i}-${Math.random().toString(36).slice(2)}`, symbol, matched: false }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function buzz(pattern) { try { navigator.vibrate?.(pattern) } catch { /* noop */ } }

export default function FlipGame({ onWin, play }) {
  const [level, setLevel] = useState('easy')
  const [cards, setCards] = useState(() => shuffled(SETS.easy.symbols))
  const [open, setOpen] = useState([])
  const [moves, setMoves] = useState(0)
  const [lock, setLock] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const matched = cards.filter((c) => c.matched).length
  const won = matched === cards.length
  const [secs, resetSecs] = useTimer(!won && moves > 0)
  const progress = cards.length ? matched / cards.length : 0

  const liveScore = useMemo(() => {
    const base = level === 'hard' ? 1200 : level === 'medium' ? 900 : 600
    return Math.max(0, base - moves * 8 - secs * 2 + bestStreak * 25 + streak * 10)
  }, [moves, secs, streak, bestStreak, level])

  const score = useMemo(() => {
    if (!won) return 0
    const base = level === 'hard' ? 1200 : level === 'medium' ? 900 : 600
    return Math.max(100, base - moves * 8 - secs * 2 + bestStreak * 30)
  }, [won, moves, secs, level, bestStreak])

  function restart(lv = level) {
    const set = SETS[lv].symbols
    setCards(shuffled(set))
    setOpen([])
    setMoves(0)
    setLock(false)
    setStreak(0)
    setBestStreak(0)
    resetSecs()
  }

  useEffect(() => { restart(level) }, [level]) // eslint-disable-line
  useEffect(() => {
    if (won && score > 0) {
      buzz([30, 40, 30, 40, 90])
      onWin({ score, moves, time: secs })
    }
  }, [won]) // eslint-disable-line

  function flip(card) {
    if (lock || card.matched || open.includes(card.id)) return
    play(520 + streak * 40, 0.08)
    buzz(12)
    const next = [...open, card.id]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next.map((id) => cards.find((c) => c.id === id))
      if (a.symbol === b.symbol) {
        const ns = streak + 1
        setStreak(ns)
        setBestStreak((s) => Math.max(s, ns))
        play(660 + ns * 60, 0.1)
        setTimeout(() => play(880 + ns * 40, 0.14), 90)
        buzz(ns >= 3 ? [20, 30, 50] : 25)
        setCards((prev) => prev.map((c) => (next.includes(c.id) ? { ...c, matched: true } : c)))
        setOpen([])
      } else {
        setStreak(0)
        play(180, 0.12, 'sawtooth', 0.06)
        setLock(true)
        setTimeout(() => {
          setOpen([])
          setLock(false)
        }, 620)
      }
    }
  }

  const cols = level === 'hard' ? 'cols-6' : 'cols-4'

  return (
    <div>
      <div className="hud" aria-live="polite">
        <span className="chip">Moves <b>{moves}</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
        <span className="chip">Matched <b>{matched}/{cards.length}</b></span>
        <span className="chip live-score">◈ {liveScore} pts</span>
        {streak >= 2 && <span className="streak">🔥 Combo ×{streak}</span>}
      </div>
      <div className="progress-wrap" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="controls-row">
        {Object.entries(SETS).map(([key, s]) => (
          <button key={key} className={`btn small ${level === key ? 'primary' : ''}`} onClick={() => setLevel(key)}>{s.label}</button>
        ))}
        <button className="btn small ghost" onClick={() => restart()}>↻ Restart</button>
      </div>
      <div className={`flip-grid ${cols}`} role="grid" aria-label="Memory cards">
        {cards.map((c, i) => {
          const faceUp = open.includes(c.id) || c.matched
          return (
            <button
              key={c.id}
              role="gridcell"
              className={`flip-card ${faceUp ? 'flipped' : ''} ${c.matched ? 'matched' : ''}`}
              onClick={() => flip(c)}
              aria-label={faceUp ? c.symbol : `hidden card ${i + 1}`}
              style={{ animationDelay: `${Math.min(i * 18, 400)}ms` }}
            >
              <span className="flip-inner">
                <span className="flip-face flip-front" aria-hidden="true" />
                <span className="flip-face flip-back" aria-hidden="true">{c.symbol}</span>
              </span>
            </button>
          )
        })}
      </div>
      {bestStreak >= 3 && <p className="cube-hint" style={{ marginTop: 12 }}>🔥 Best combo ×{bestStreak} — keep the streak for +30 pts each.</p>}
    </div>
  )
}
