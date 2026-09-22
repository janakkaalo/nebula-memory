import { useEffect, useMemo, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

const EASY_SET = ['🪐', '🌟', '🌙', '🚀', '👾', '☄️']
const HARD_SET = ['🪐', '🌟', '🌙', '🚀', '👾', '☄️', '🛸', '🌌', '🔭', '👩‍🚀', '🌠', '🛰️']

function shuffled(pairs) {
  const deck = [...pairs, ...pairs]
    .map((symbol, i) => ({ id: `${symbol}-${i}-${Math.random()}`, symbol, matched: false }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export default function FlipGame({ onWin, play }) {
  const [hard, setHard] = useState(false)
  const symbols = hard ? HARD_SET : EASY_SET
  const [cards, setCards] = useState(() => shuffled(EASY_SET))
  const [open, setOpen] = useState([])
  const [moves, setMoves] = useState(0)
  const [lock, setLock] = useState(false)
  const matched = cards.filter((c) => c.matched).length
  const won = matched === cards.length
  const [secs, resetSecs] = useTimer(!won && (moves > 0))

  const score = useMemo(() => {
    if (!won) return 0
    const base = hard ? 1200 : 600
    return Math.max(100, base - moves * 8 - secs * 2)
  }, [won, moves, secs, hard])

  function restart(isHard = hard) {
    const set = isHard ? HARD_SET : EASY_SET
    setCards(shuffled(set))
    setOpen([])
    setMoves(0)
    setLock(false)
    resetSecs()
  }

  useEffect(() => { restart(hard) }, [hard]) // eslint-disable-line
  useEffect(() => {
    if (won && score > 0) onWin({ score, moves, time: secs })
  }, [won]) // eslint-disable-line

  function flip(card) {
    if (lock || card.matched || open.includes(card.id)) return
    play(520, 0.08)
    const next = [...open, card.id]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next.map((id) => cards.find((c) => c.id === id))
      if (a.symbol === b.symbol) {
        play(760, 0.14)
        setCards((prev) => prev.map((c) => (next.includes(c.id) ? { ...c, matched: true } : c)))
        setOpen([])
      } else {
        setLock(true)
        setTimeout(() => {
          setOpen([])
          setLock(false)
        }, 620)
      }
    }
  }

  return (
    <div>
      <div className="hud" aria-live="polite">
        <span className="chip">Moves <b>{moves}</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
        <span className="chip">Matched <b>{matched}/{cards.length}</b></span>
      </div>
      <div className="controls-row">
        <button className={`btn small ${!hard ? 'primary' : ''}`} onClick={() => setHard(false)}>Easy 4x3</button>
        <button className={`btn small ${hard ? 'primary' : ''}`} onClick={() => setHard(true)}>Hard 6x4</button>
        <button className="btn small ghost" onClick={() => restart()}>Restart</button>
      </div>
      <div className={`flip-grid ${hard ? 'cols-6' : 'cols-4'}`} role="grid" aria-label="Memory cards">
        {cards.map((c) => {
          const faceUp = open.includes(c.id) || c.matched
          return (
            <button
              key={c.id}
              role="gridcell"
              className={`flip-card ${faceUp ? 'flipped' : ''} ${c.matched ? 'matched' : ''}`}
              onClick={() => flip(c)}
              aria-label={faceUp ? c.symbol : 'hidden card'}
            >
              <span className="flip-inner">
                <span className="flip-face flip-front" aria-hidden="true" />
                <span className="flip-face flip-back" aria-hidden="true">{c.symbol}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
