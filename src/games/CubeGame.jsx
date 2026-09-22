import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

const SYMBOLS = ['▲', '●', '◆', '★', '⬢', '◍', '✦', '⬣']

function makeFaceTexture(symbol, active, matched) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const ctx = cv.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 256, 256)
  if (matched) { g.addColorStop(0, '#3a2f10'); g.addColorStop(1, '#7c5a12') }
  else if (active) { g.addColorStop(0, '#0e3a4d'); g.addColorStop(1, '#1c2a5e') }
  else { g.addColorStop(0, '#1d1850'); g.addColorStop(1, '#0d0a28') }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = matched ? '#fcd34d' : 'rgba(103,232,249,.7)'
  ctx.lineWidth = 10
  ctx.strokeRect(12, 12, 232, 232)
  ctx.fillStyle = matched ? '#fde68a' : '#eafcff'
  ctx.font = '150px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(active || matched ? symbol : '✦', 128, 140)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * True 3D memory: 16 cubes floating in a 4x4 disc.
 * Drag to orbit, click to flip. Raycast picking.
 */
export default function CubeGame({ onWin, play }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const [moves, setMoves] = useState(0)
  const [matched, setMatched] = useState(0)
  const [openIds, setOpenIds] = useState([])
  const [won, setWon] = useState(false)
  const [secs, resetSecs] = useTimer(!won && moves > 0)
  const movesRef = useRef(0)

  // resettable deck
  const [deckKey, setDeckKey] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const order = [...SYMBOLS, ...SYMBOLS]
      .map((s, i) => ({ s, r: Math.random(), i }))
      .sort((a, b) => a.r - b.r)
      .map((o) => o.s)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    const W = () => canvas.clientWidth || 600
    const H = () => canvas.clientHeight || 420
    renderer.setSize(W(), H(), false)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, W() / H(), 0.1, 100)
    camera.position.set(0, 4.6, 9.5)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0x8899ff, 0.9))
    const key = new THREE.DirectionalLight(0x67e8f9, 1.6)
    key.position.set(5, 8, 6)
    scene.add(key)
    const rim = new THREE.PointLight(0xa78bfa, 60, 40)
    rim.position.set(-6, 3, -4)
    scene.add(rim)

    const group = new THREE.Group()
    scene.add(group)

    const cubes = []
    const geo = new THREE.BoxGeometry(1.15, 1.15, 1.15)
    const edgeGeo = new THREE.EdgesGeometry(geo)
    order.forEach((symbol, idx) => {
      const row = Math.floor(idx / 4)
      const col = idx % 4
      const face = makeFaceTexture(symbol, false, false)
      const side = new THREE.MeshStandardMaterial({ color: 0x241d63, roughness: 0.4, metalness: 0.55 })
      const front = new THREE.MeshStandardMaterial({ map: face, roughness: 0.35, metalness: 0.2, emissive: 0x0b1230, emissiveIntensity: 0.6 })
      const mats = [side, side, side, side, front, side]
      const mesh = new THREE.Mesh(geo, mats)
      mesh.position.set((col - 1.5) * 1.65, (1.5 - row) * 1.6 + Math.sin(idx) * 0.08, Math.cos(idx * 0.7) * 0.35)
      mesh.rotation.set(-0.12, 0.35, 0)
      mesh.userData = { idx, symbol, open: false, matched: false, spin: 0, float: Math.random() * Math.PI * 2 }
      const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.5 }))
      mesh.add(edge)
      group.add(mesh)
      cubes.push(mesh)
    })

    // starfield inside game view
    const starGeo = new THREE.BufferGeometry()
    const N = 320
    const sp = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 30
      sp[i * 3 + 1] = (Math.random() - 0.5) * 18
      sp[i * 3 + 2] = -Math.random() * 14 - 3
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.08, color: 0x9be9ff, transparent: true, opacity: 0.8 }))
    scene.add(stars)

    const ray = new THREE.Raycaster()
    const ptr = new THREE.Vector2()
    let rotX = 0.15, rotY = 0, tRotX = 0.15, tRotY = 0
    let dragging = false, px = 0, py = 0, moved = 0
    let open = []
    let lock = false
    let alive = true
    let raf = 0

    function refreshTexture(mesh) {
      const { symbol, open: o, matched: m } = mesh.userData
      const t = makeFaceTexture(symbol, o, m)
      mesh.material[4].map.dispose()
      mesh.material[4].map = t
      mesh.material[4].needsUpdate = true
      mesh.children[0].material.color.set(m ? 0xfcd34d : 0x67e8f9)
    }

    function pick(e) {
      const r = canvas.getBoundingClientRect()
      const x = (e.clientX ?? e.touches?.[0]?.clientX) - r.left
      const y = (e.clientY ?? e.touches?.[0]?.clientY) - r.top
      ptr.x = (x / r.width) * 2 - 1
      ptr.y = -(y / r.height) * 2 + 1
      ray.setFromCamera(ptr, camera)
      const hit = ray.intersectObjects(cubes, false)[0]
      return hit?.object || null
    }

    function onDown(e) { dragging = true; moved = 0; px = e.clientX ?? e.touches?.[0]?.clientX; py = e.clientY ?? e.touches?.[0]?.clientY }
    function onMove(e) {
      if (!dragging) return
      const x = e.clientX ?? e.touches?.[0]?.clientX
      const y = e.clientY ?? e.touches?.[0]?.clientY
      const dx = x - px, dy = y - py
      moved += Math.abs(dx) + Math.abs(dy)
      tRotY += dx * 0.008
      tRotX += dy * 0.005
      tRotX = Math.max(-0.7, Math.min(0.9, tRotX))
      px = x; py = y
    }
    function onUp(e) {
      if (!dragging) return
      dragging = false
      if (moved > 8 || lock) return
      const mesh = pick(e)
      if (!mesh || mesh.userData.open || mesh.userData.matched) return
      mesh.userData.open = true
      mesh.userData.spin = 1
      refreshTexture(mesh)
      try { play(520, 0.08) } catch { /* noop */ }
      open.push(mesh)
      setOpenIds(open.map((m) => m.userData.idx))
      if (open.length === 2) {
        movesRef.current += 1
        setMoves(movesRef.current)
        const [a, b] = open
        if (a.userData.symbol === b.userData.symbol) {
          lock = true
          setTimeout(() => {
            if (!alive) return
            a.userData.matched = b.userData.matched = true
            refreshTexture(a); refreshTexture(b)
            try { play(780, 0.16) } catch { /* noop */ }
            open = []
            setOpenIds([])
            lock = false
            setMatched((m) => {
              const nm = m + 2
              if (nm >= 16) {
                setWon(true)
              }
              return nm
            })
          }, 420)
        } else {
          lock = true
          setTimeout(() => {
            if (!alive) return
            a.userData.open = b.userData.open = false
            a.userData.spin = b.userData.spin = 1
            refreshTexture(a); refreshTexture(b)
            open = []
            setOpenIds([])
            lock = false
          }, 700)
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)

    function onResize() {
      renderer.setSize(W(), H(), false)
      camera.aspect = W() / H()
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()
    function tick() {
      if (!alive) return
      raf = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      rotX += (tRotX - rotX) * 0.08
      rotY += (tRotY - rotY) * 0.08
      group.rotation.set(rotX, rotY, 0)
      cubes.forEach((m) => {
        m.position.y += Math.sin(t * 1.4 + m.userData.float) * 0.0009
        if (m.userData.spin > 0) {
          m.rotation.y += 0.28
          m.userData.spin -= 0.06
          if (m.userData.spin <= 0) m.rotation.y = Math.round(m.rotation.y / (Math.PI * 2)) * Math.PI * 2 + 0.35
        } else {
          m.rotation.y += (0.35 - m.rotation.y) * 0.05
        }
      })
      stars.rotation.y = t * 0.01
      renderer.render(scene, camera)
    }
    tick()

    stateRef.current = { cleanup() { alive = false } }

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('resize', onResize)
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose() })
        }
      })
      renderer.dispose()
    }
  }, [deckKey]) // eslint-disable-line

  useEffect(() => {
    if (won) onWin({ score: Math.max(150, 1100 - moves * 12 - secs * 2), moves, time: secs })
  }, [won]) // eslint-disable-line

  void openIds

  return (
    <div className="cube-wrap">
      <div className="hud">
        <span className="chip">Moves <b>{moves}</b></span>
        <span className="chip">Matched <b>{matched}/16</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
      </div>
      <canvas ref={canvasRef} className="cube-canvas" aria-label="3D cube memory board. Drag to rotate, tap a cube to flip." />
      <div className="controls-row">
        <span className="cube-hint">Drag to orbit. Tap two cubes to match runes.</span>
        <button
          className="btn small ghost"
          onClick={() => { setMoves(0); movesRef.current = 0; setMatched(0); setWon(false); resetSecs(); setOpenIds([]); setDeckKey((k) => k + 1) }}
        >
          Restart
        </button>
      </div>
    </div>
  )
}
