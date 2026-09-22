import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import NebulaBackground from './three/NebulaBackground.jsx'
const FlipGame = lazy(() => import('./games/FlipGame.jsx'))
const PulseGame = lazy(() => import('./games/PulseGame.jsx'))
const CubeGame = lazy(() => import('./games/CubeGame.jsx'))
const FlashGame = lazy(() => import('./games/FlashGame.jsx'))
import { formatTime, useBestScores } from './hooks/useMemoryStats.js'
import { useSound } from './hooks/useSound.js'

const GAMES = [
  { id: 'flip', name: 'Nebula Flip', desc: 'Classic pair match with 3D flip. Easy 12 cards, hard 24.', art: 'art-1', icon: '🪐', tag: 'Matching' },
  { id: 'pulse', name: 'Pulse Sequence', desc: 'Watch the orbs glow, repeat the pattern to round 10.', art: 'art-2', icon: '🔮', tag: 'Sequence' },
  { id: 'cube', name: 'Cube Pairs 3D', desc: 'Real 3D cubes. Drag to orbit, tap two to match runes.', art: 'art-3', icon: '🧊', tag: 'Spatial 3D' },
  { id: 'flash', name: 'Flash Grid Recall', desc: 'Memorize the flash, recall hidden tiles. 5 levels.', art: 'art-4', icon: '⚡', tag: 'Recall' },
]

function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .band-card, .game-card')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in') })
    }, { threshold: 0.12 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [dep])
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#/', '') || 'home')
  const [activeGame, setActiveGame] = useState('flip')
  const [modal, setModal] = useState(null)
  const { best, saveBest, clearAll } = useBestScores()
  const { muted, setMuted, play } = useSound()
  useReveal(route + activeGame)

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#/', '') || 'home')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function go(id) {
    if (id === 'home') { window.location.hash = '#/'; setRoute('home') }
    else { window.location.hash = `#/${id}`; setRoute(id); setModal(null) }
    window.scrollTo({ top: id === 'home' ? 0 : document.getElementById('stage')?.offsetTop - 80 || 0, behavior: 'smooth' })
  }

  const openGame = useCallback((id) => {
    setActiveGame(id)
    go(id)
  }, []) // eslint-disable-line

  const handleWin = useCallback((result) => {
    saveBest(activeGame, { score: result.score, moves: result.moves, time: result.time, date: Date.now() })
    setModal({ ...result, game: activeGame })
  }, [activeGame, saveBest])

  const totalBest = useMemo(() => Object.values(best).reduce((a, b) => a + (b.score || 0), 0), [best])
  const meta = GAMES.find((g) => g.id === activeGame)

  const GameView = activeGame === 'flip' ? FlipGame : activeGame === 'pulse' ? PulseGame : activeGame === 'cube' ? CubeGame : FlashGame

  return (
    <>
      <a className="skip-link" href="#main">Skip to games</a>
      <NebulaBackground />

      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <button className="brand" onClick={() => go('home')} aria-label="Nebula Memory home">
            <span className="brand-mark">✦</span> Nebula Memory
          </button>
          <div className="nav-links">
            <button className={route === 'home' ? 'active' : ''} onClick={() => go('home')}>Arcade</button>
            {GAMES.map((g) => (
              <button key={g.id} className={route === g.id ? 'active' : ''} onClick={() => openGame(g.id)}>{g.name}</button>
            ))}
          </div>
        </div>
      </nav>

      <main id="main" tabIndex="-1">
        <div className="wrap">
          {(route === 'home' || !GAMES.some((g) => g.id === route)) && (
            <>
              <header className="hero-stage">
                <div className="hero-copy">
                  <span className="kicker">Free browser arcade · Mobile ready</span>
                  <h1>Train your memory in a <span className="grad">living nebula</span></h1>
                  <p className="lede">
                    Four medium size memory games in one moving cosmic world. No install, no signup.
                    Flip planets, follow pulses, orbit cubes, recall flashes. Your best scores stay on this device.
                  </p>
                  <div className="hero-cta">
                    <button className="btn primary" onClick={() => openGame('flip')}>Play now</button>
                    <button className="btn" onClick={() => document.getElementById('games').scrollIntoView({ behavior: 'smooth' })}>Browse games</button>
                    <button className="btn ghost small" onClick={() => setMuted(!muted)} aria-pressed={muted}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
                  </div>
                  <div className="hero-stats">
                    <span className="chip">Games <b>4</b></span>
                    <span className="chip">Total best <b>{totalBest}</b></span>
                    <span className="chip">Saves <b>local only</b></span>
                  </div>
                  <div className="scroll-cue"><span className="dot" />Scroll to enter the arcade</div>
                </div>
              </header>

              <section className="story-band" aria-label="How it feels">
                <div className="band-grid">
                  <div className="band-card"><h2>One world, four trials</h2><p>Scroll and the camera dives deeper into the nebula. Each game is a new orbit in the same sky.</p></div>
                  <div className="band-card"><h2>Short rounds, real training</h2><p>Every round is 3 to 5 minutes. Matching, sequence, spatial and recall cover all memory skills.</p></div>
                  <div className="band-card"><h2>Phone first</h2><p>Big touch targets, portrait grids, capped pixels for smooth 60fps on mobile data.</p></div>
                </div>
              </section>

              <div className="section-title" id="games">
                <h2>Choose your trial</h2>
                <span>4 games · click a card to play</span>
              </div>
              <section className="games-grid" aria-label="Games">
                {GAMES.map((g) => (
                  <button key={g.id} className={`game-card ${activeGame === g.id ? 'active' : ''}`} onClick={() => openGame(g.id)}>
                    <div className={`game-art ${g.art}`}><span className="big">{g.icon}</span><span>{g.tag}</span></div>
                    <h3>{g.name}</h3>
                    <p>{g.desc}</p>
                    <div className="game-meta">
                      <span>▶ Play</span>
                      <span className="best">{best[g.id] ? `★ ${best[g.id].score}` : '★ new'}</span>
                    </div>
                  </button>
                ))}
              </section>

              <section className="two-col">
                <div className="panel">
                  <h3>How scoring works</h3>
                  <ul>
                    <li>Flip: fewer moves plus faster time means higher score. Hard board pays double.</li>
                    <li>Pulse: each round adds 40 points. Two lives per run. Clear 10 for champion bonus.</li>
                    <li>Cube 3D: 16 runes, orbit with drag. Match all with fewest moves.</li>
                    <li>Flash: 5 sectors, 3 misses allowed. Recall faster for bonus.</li>
                  </ul>
                </div>
                <div className="panel">
                  <h3>Best scores on this device</h3>
                  {Object.keys(best).length === 0 ? <p>No scores yet. Play a round to set one.</p> : (
                    <table className="score-table">
                      <thead><tr><th>Game</th><th>Score</th><th>Detail</th></tr></thead>
                      <tbody>
                        {GAMES.map((g) => best[g.id] && (
                          <tr key={g.id}><td>{g.name}</td><td>★ {best[g.id].score}</td><td>moves {best[g.id].moves} · {formatTime(best[g.id].time || 0)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </>
          )}

          <section id="stage" className="stage" aria-live="polite" style={{ marginTop: route === 'home' ? 26 : 30 }}>
            <div className="stage-head">
              <h2>{meta.icon} {meta.name}</h2>
              <span className="sub">{meta.desc}</span>
              <span style={{ marginLeft: 'auto' }} className="chip">Best <b>{best[activeGame]?.score ?? '-'}</b></span>
            </div>
            <div className="controls-row">
              {GAMES.map((g) => (
                <button key={g.id} className={`btn small ${activeGame === g.id ? 'primary' : ''}`} onClick={() => { setActiveGame(g.id); setModal(null) }}>{g.icon} {g.name}</button>
              ))}
            </div>
            <Suspense fallback={<p className="cube-hint">Loading game…</p>}>
              <GameView key={activeGame} onWin={handleWin} play={play} />
            </Suspense>
          </section>

          <section className="two-col">
            <div className="panel reveal">
              <h3>Deploy this free on GitHub Pages</h3>
              <p>Build is static. Run npm run build, publish dist. Base is set to ./ so project pages work. Workflow file included at .github/workflows/deploy.yml.</p>
            </div>
            <div className="panel reveal">
              <h3>Tips for smooth play</h3>
              <p>If 3D feels slow on an old phone, play Flip or Flash. They use no WebGL per frame. Cube and the nebula pause when the tab hides.</p>
            </div>
          </section>

          <footer>
            <div className="wrap" style={{ padding: 0 }}>
              <span>✦ Nebula Memory Arcade. Built with React, Vite and Three.js.</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={clearAll}>Reset scores</button>
                <button onClick={() => go('home')}>Back to top</button>
              </span>
            </div>
          </footer>
        </div>
      </main>

      {modal && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Round result">
            <h3>{modal.lost ? 'Run over' : '🎉 New score'}</h3>
            <p>{GAMES.find((g) => g.id === modal.game)?.name} · Score {modal.score} · Moves {modal.moves} · {formatTime(modal.time || 0)}</p>
            <div className="modal-row">
              <button className="btn primary" onClick={() => setModal(null)}>Play again</button>
              <button className="btn" onClick={() => { setModal(null); go('home') }}>Arcade</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
