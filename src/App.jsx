import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import NebulaBackground from './three/NebulaBackground.jsx'
const FlipGame = lazy(() => import('./games/FlipGame.jsx'))
const PulseGame = lazy(() => import('./games/PulseGame.jsx'))
const CubeGame = lazy(() => import('./games/CubeGame.jsx'))
const FlashGame = lazy(() => import('./games/FlashGame.jsx'))
import { formatTime, useBestScores } from './hooks/useMemoryStats.js'
import { useSound } from './hooks/useSound.js'

const GAMES = [
  { id: 'flip', name: 'Nebula Flip', short: 'Flip', desc: 'Classic pair match with 3D flip. Easy 12 cards, hard 24.', art: 'art-1', icon: '🪐', tag: 'Matching', color: '#67e8f9' },
  { id: 'pulse', name: 'Pulse Sequence', short: 'Pulse', desc: 'Watch the orbs glow, repeat the pattern to round 10.', art: 'art-2', icon: '🔮', tag: 'Sequence', color: '#f472b6' },
  { id: 'cube', name: 'Cube Pairs 3D', short: '3D Cubes', desc: 'Real 3D cubes. Drag to orbit, tap two to match runes.', art: 'art-3', icon: '🧊', tag: 'Spatial 3D', color: '#a78bfa' },
  { id: 'flash', name: 'Flash Grid Recall', short: 'Flash', desc: 'Memorize the flash, recall hidden tiles. 5 levels.', art: 'art-4', icon: '⚡', tag: 'Recall', color: '#fcd34d' },
]

function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .band-card, .game-card')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in') })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [dep])
}

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#/', '') || 'home')
  const [activeGame, setActiveGame] = useState('flip')
  const [modal, setModal] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { best, saveBest, clearAll } = useBestScores()
  const { muted, setMuted, play } = useSound()
  useReveal(route + activeGame + menuOpen)

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#/', '') || 'home')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // lock body scroll when drawer / modal open
  useEffect(() => {
    document.body.style.overflow = (menuOpen || modal) ? '' : ''
  }, [menuOpen, modal])

  function go(id) {
    setMenuOpen(false)
    if (id === 'home') { window.location.hash = '#/'; setRoute('home') }
    else { window.location.hash = `#/${id}`; setRoute(id); setModal(null) }
    requestAnimationFrame(() => {
      if (id === 'home') window.scrollTo({ top: 0, behavior: 'smooth' })
      else document.getElementById('stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const openGame = useCallback((id) => {
    setActiveGame(id)
    setMenuOpen(false)
    window.location.hash = `#/${id}`
    setRoute(id)
    setModal(null)
    requestAnimationFrame(() => {
      document.getElementById('stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleWin = useCallback((result) => {
    saveBest(activeGame, { score: result.score, moves: result.moves, time: result.time, date: Date.now() })
    setModal({ ...result, game: activeGame })
    try { navigator.vibrate?.(result.lost ? [60, 40, 60] : [20, 30, 40, 30, 80]) } catch { /* noop */ }
  }, [activeGame, saveBest])

  const totalBest = useMemo(() => Object.values(best).reduce((a, b) => a + (b.score || 0), 0), [best])
  const meta = GAMES.find((g) => g.id === activeGame)

  const GameView = activeGame === 'flip' ? FlipGame : activeGame === 'pulse' ? PulseGame : activeGame === 'cube' ? CubeGame : FlashGame

  return (
    <>
      <a className="skip-link" href="#main">Skip to games</a>
      <NebulaBackground />

      {/* ── High-graphics mobile-friendly header ── */}
      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <button className="brand" onClick={() => go('home')} aria-label="Nebula Memory home">
            <span className="brand-mark" aria-hidden="true"><span className="brand-star">✦</span></span>
            <span className="brand-text">Nebula<small>MEMORY ARCADE</small></span>
          </button>

          {/* desktop links */}
          <div className="nav-links" role="menubar">
            <button className={route === 'home' ? 'active' : ''} onClick={() => go('home')}>Arcade</button>
            {GAMES.map((g) => (
              <button key={g.id} className={route === g.id ? 'active' : ''} onClick={() => openGame(g.id)}>
                <span className="nl-ico" aria-hidden="true">{g.icon}</span> {g.name}
              </button>
            ))}
          </div>

          <div className="nav-actions">
            <span className="score-pill" title="Total best score">★ {totalBest}</span>
            <button
              className="icon-btn"
              onClick={() => { setMuted(!muted); if (!muted) play(440, 0.06) }}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              className={`burger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* mobile drawer */}
        <div className={`drawer ${menuOpen ? 'open' : ''}`} id="mobile-menu">
          <button className={route === 'home' ? 'd-link active' : 'd-link'} onClick={() => go('home')}>
            <span className="d-ico">🏠</span><span><b>Arcade Home</b><small>All games + scores</small></span><span className="d-arrow">→</span>
          </button>
          {GAMES.map((g) => (
            <button key={g.id} className={route === g.id ? 'd-link active' : 'd-link'} onClick={() => openGame(g.id)}>
              <span className="d-ico" style={{ '--gc': g.color }}>{g.icon}</span>
              <span><b>{g.name}</b><small>{g.desc}</small></span>
              <span className="d-arrow">→</span>
            </button>
          ))}
          <div className="drawer-foot">
            <button className="btn small ghost" onClick={() => setMuted(!muted)}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            <span className="chip">★ Total {totalBest}</span>
          </div>
        </div>
        {menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      </nav>

      <main id="main" tabIndex="-1">
        <div className="wrap">
          {(route === 'home' || !GAMES.some((g) => g.id === route)) && (
            <>
              <header className="hero-stage">
                <div className="hero-orbs" aria-hidden="true">
                  <span className="orb o1">🪐</span>
                  <span className="orb o2">🔮</span>
                  <span className="orb o3">🧊</span>
                  <span className="orb o4">⚡</span>
                </div>
                <div className="hero-copy">
                  <span className="kicker"><span className="pulse-dot" /> Free browser arcade · Mobile ready · No signup</span>
                  <h1>Train your memory in a <span className="grad">living nebula</span></h1>
                  <p className="lede">
                    Four cinematic memory trials in one moving cosmic world. No install, no signup.
                    Flip planets, follow pulses, orbit cubes, recall flashes. Best scores stay on this device.
                  </p>
                  <div className="hero-cta">
                    <button className="btn primary big" onClick={() => openGame('flip')}><span aria-hidden="true">▶</span> Play now</button>
                    <button className="btn glass" onClick={() => document.getElementById('games').scrollIntoView({ behavior: 'smooth' })}>Browse games</button>
                  </div>
                  <div className="hero-stats">
                    <span className="chip stat"><small>GAMES</small><b>4 trials</b></span>
                    <span className="chip stat"><small>TOTAL BEST</small><b>★ {totalBest}</b></span>
                    <span className="chip stat"><small>SAVES</small><b>local only</b></span>
                    <span className="chip stat"><small>ROUND</small><b>3–5 min</b></span>
                  </div>
                  <div className="scroll-cue"><span className="dot" />Scroll to enter the arcade</div>
                </div>
                <div className="hero-cards" aria-hidden="true">
                  {GAMES.map((g, i) => (
                    <button key={g.id} tabIndex={-1} onClick={() => openGame(g.id)} className={`h-card h${i + 1}`}>
                      <span className="h-ico">{g.icon}</span>
                      <span className="h-name">{g.short}</span>
                      <span className="h-tag">{g.tag}</span>
                    </button>
                  ))}
                </div>
              </header>

              <section className="story-band" aria-label="How it feels">
                <div className="band-grid">
                  <div className="band-card b1"><span className="b-ico">🌌</span><h2>One world, four trials</h2><p>Scroll and the camera dives deeper into the nebula. Each game is a new orbit in the same sky.</p></div>
                  <div className="band-card b2"><span className="b-ico">🧠</span><h2>Short rounds, real training</h2><p>Every round is 3 to 5 minutes. Matching, sequence, spatial and recall cover all memory skills.</p></div>
                  <div className="band-card b3"><span className="b-ico">📱</span><h2>Phone first, 60fps</h2><p>Big touch targets, portrait grids, capped pixels and haptics for smooth play on mobile data.</p></div>
                </div>
              </section>

              <div className="section-title" id="games">
                <div>
                  <p className="eyebrow">The arcade</p>
                  <h2>Choose your trial</h2>
                </div>
                <span className="sec-note">4 games · tap a card to play</span>
              </div>
              <section className="games-grid" aria-label="Games">
                {GAMES.map((g) => (
                  <button key={g.id} className={`game-card ${activeGame === g.id ? 'active' : ''}`} onClick={() => openGame(g.id)} style={{ '--gc': g.color }}>
                    <div className={`game-art ${g.art}`}>
                      <span className="big">{g.icon}</span>
                      <span className="art-tag">{g.tag}</span>
                      <span className="art-shine" aria-hidden="true" />
                    </div>
                    <h3>{g.name}</h3>
                    <p>{g.desc}</p>
                    <div className="game-meta">
                      <span className="play-pill">▶ Play</span>
                      <span className="best">{best[g.id] ? `★ ${best[g.id].score}` : '★ new'}</span>
                    </div>
                  </button>
                ))}
              </section>

              <section className="two-col">
                <div className="panel reveal glow">
                  <p className="eyebrow">Scoring</p>
                  <h3>How scoring works</h3>
                  <ul className="nice-list">
                    <li><b>Flip:</b> fewer moves + faster time = higher score. Hard board pays double. Streaks add combo bonus.</li>
                    <li><b>Pulse:</b> each round adds 40 pts. Two lives per run. Clear 10 for champion bonus + speed levels.</li>
                    <li><b>Cube 3D:</b> 16 runes, orbit with drag. Match all with fewest moves. Golden burst on match.</li>
                    <li><b>Flash:</b> 5 sectors, 3 misses allowed. Recall faster for time bonus.</li>
                  </ul>
                </div>
                <div className="panel reveal">
                  <p className="eyebrow">Local legend</p>
                  <h3>Best scores on this device</h3>
                  {Object.keys(best).length === 0 ? <p className="muted">No scores yet. Play a round to set one. Your first ★ is one tap away.</p> : (
                    <table className="score-table">
                      <thead><tr><th>Game</th><th>Score</th><th>Detail</th></tr></thead>
                      <tbody>
                        {GAMES.map((g) => best[g.id] && (
                          <tr key={g.id}><td>{g.icon} {g.name}</td><td>★ {best[g.id].score}</td><td>moves {best[g.id].moves} · {formatTime(best[g.id].time || 0)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── Game stage ── */}
          <section id="stage" className="stage" aria-live="polite">
            <div className="stage-glow" aria-hidden="true" />
            <div className="stage-head">
              <span className="stage-ico" style={{ '--gc': meta.color }} aria-hidden="true">{meta.icon}</span>
              <div className="stage-titles">
                <h2>{meta.name}</h2>
                <span className="sub">{meta.desc}</span>
              </div>
              <span className="chip best-chip">★ Best <b>{best[activeGame]?.score ?? '-'}</b></span>
            </div>
            <div className="controls-row tabs" role="tablist" aria-label="Switch game">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={activeGame === g.id}
                  className={`tab ${activeGame === g.id ? 'primary' : ''}`}
                  onClick={() => { setActiveGame(g.id); setModal(null) }}
                >{g.icon} {g.short}</button>
              ))}
            </div>
            <Suspense fallback={<div className="loader"><span className="spinner" />Loading game…</div>}>
              <GameView key={activeGame} onWin={handleWin} play={play} />
            </Suspense>
          </section>

          <section className="two-col tight">
            <div className="panel reveal mini">
              <h3>🚀 Deploy free on GitHub Pages</h3>
              <p>Build is static. Run <code>npm run build</code>, publish <code>dist</code>. Base is <code>./</code> so project pages work.</p>
            </div>
            <div className="panel reveal mini">
              <h3>📱 Smooth on old phones</h3>
              <p>If 3D feels slow, play Flip or Flash. They use no WebGL per frame. Cube and nebula pause when the tab hides.</p>
            </div>
          </section>

          {/* ── Rich mobile-friendly footer ── */}
          <footer className="site-footer">
            <div className="foot-grid">
              <div className="f-brand">
                <span className="brand-mark" aria-hidden="true"><span className="brand-star">✦</span></span>
                <div>
                  <b>Nebula Memory Arcade</b>
                  <p>Four cinematic memory games in a living nebula. Built with React, Vite and Three.js. Free forever, no account.</p>
                </div>
              </div>
              <nav className="f-col" aria-label="Games">
                <b>Games</b>
                {GAMES.map((g) => (
                  <button key={g.id} onClick={() => openGame(g.id)}>{g.icon} {g.name}</button>
                ))}
              </nav>
              <nav className="f-col" aria-label="Arcade">
                <b>Arcade</b>
                <button onClick={() => go('home')}>🏠 Home</button>
                <button onClick={() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' })}>🎮 All trials</button>
                <button onClick={() => document.getElementById('stage')?.scrollIntoView({ behavior: 'smooth' })}>▶ Current stage</button>
                <button onClick={() => setMuted(!muted)}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
              </nav>
            </div>
            <div className="foot-bar">
              <span>✦ Nebula Memory · scores save locally only</span>
              <span className="foot-actions">
                <button onClick={clearAll}>Reset scores</button>
                <button className="top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top ↑</button>
              </span>
            </div>
          </footer>
        </div>
      </main>

      {/* mobile bottom tab bar */}
      <nav className="tabbar" aria-label="Quick game switch">
        <button className={route === 'home' ? 'active' : ''} onClick={() => go('home')}><span>🏠</span><small>Home</small></button>
        {GAMES.map((g) => (
          <button key={g.id} className={route === g.id ? 'active' : ''} onClick={() => openGame(g.id)}><span>{g.icon}</span><small>{g.short}</small></button>
        ))}
      </nav>

      {modal && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="confetti" aria-hidden="true">{!modal.lost && <span>🎉✦★🎊✦★🎉</span>}</div>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Round result">
            <span className="m-badge">{modal.lost ? '💫' : '🏆'}</span>
            <h3>{modal.lost ? 'Run over' : 'New score!'}</h3>
            <p className="m-game">{GAMES.find((g) => g.id === modal.game)?.icon} {GAMES.find((g) => g.id === modal.game)?.name}</p>
            <div className="m-grid">
              <div><small>SCORE</small><b>★ {modal.score}</b></div>
              <div><small>MOVES</small><b>{modal.moves}</b></div>
              <div><small>TIME</small><b>{formatTime(modal.time || 0)}</b></div>
            </div>
            <div className="modal-row">
              <button className="btn primary" onClick={() => setModal(null)}>Play again</button>
              <button className="btn glass" onClick={() => { setModal(null); go('home') }}>Arcade</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
