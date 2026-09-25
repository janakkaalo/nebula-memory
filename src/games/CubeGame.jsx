import { useEffect, useRef, useState } from 'react'
import { formatTime, useTimer } from '../hooks/useMemoryStats.js'

const SYMBOLS = ['▲', '●', '◆', '★', '⬢', '◍', '✦', '⬣']
const DISC_Y = -3.15

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function makeFaceTexture(THREE, symbol, active, matched) {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(S * 0.35, S * 0.3, 20, S / 2, S / 2, S * 0.75)
  if (matched) { g.addColorStop(0, '#6b5316'); g.addColorStop(0.55, '#3a2f10'); g.addColorStop(1, '#171106') }
  else if (active) { g.addColorStop(0, '#155e75'); g.addColorStop(0.55, '#1c2a5e'); g.addColorStop(1, '#0b1030') }
  else { g.addColorStop(0, '#2b2568'); g.addColorStop(0.55, '#191544'); g.addColorStop(1, '#0b0926') }
  ctx.fillStyle = g
  roundRect(ctx, 0, 0, S, S, 28)
  ctx.fill()
  ctx.save()
  roundRect(ctx, 0, 0, S, S, 28)
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  for (let i = 0; i < S; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke()
  }
  ctx.strokeStyle = matched ? '#fcd34d' : active ? '#a5f3fc' : 'rgba(103,232,249,.75)'
  ctx.lineWidth = matched || active ? 7 : 4
  ctx.shadowColor = matched ? '#fcd34d' : '#67e8f9'
  ctx.shadowBlur = matched ? 23 : active ? 18 : 9
  roundRect(ctx, 13, 13, S - 26, S - 26, 18)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = matched ? '#fde68a' : '#eafcff'
  ctx.shadowColor = matched ? '#fbbf24' : '#67e8f9'
  ctx.shadowBlur = 26
  ctx.font = '150px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(active || matched ? symbol : '✦', S / 2, S / 2 + 9)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,.5)'
  ;[[35, 35], [S - 35, 35], [35, S - 35], [S - 35, S - 35]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill()
  })
  ctx.restore()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * 3D memory: 16 physical cubes floating above a glowing disc.
 * Drag to orbit, wheel to zoom, tap to flip. Three.js loads lazily
 * so the landing page never pays for WebGL until this game mounts.
 */
export default function CubeGame({ onWin, play }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [moves, setMoves] = useState(0)
  const [matched, setMatched] = useState(0)
  const [won, setWon] = useState(false)
  const [secs, resetSecs] = useTimer(!won && moves > 0)
  const [deckKey, setDeckKey] = useState(0)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const movesRef = useRef(0)
  const playRef = useRef(play)
  const onWinRef = useRef(onWin)
  const secsRef = useRef(secs)
  const movesStateRef = useRef(moves)
  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => { onWinRef.current = onWin }, [onWin])
  useEffect(() => { secsRef.current = secs }, [secs])
  useEffect(() => { movesStateRef.current = moves }, [moves])
  const progress = matched / 16

  useEffect(() => {
    let alive = true
    let renderer = null
    let raf = 0
    let cleanup = null

    async function init() {
      const canvas = canvasRef.current
      if (!canvas) return
      let THREE
      try {
        THREE = await import('three')
      } catch {
        if (alive) setStatus('error')
        return
      }
      if (!alive || !canvasRef.current) return

      const order = [...SYMBOLS, ...SYMBOLS]
        .map((s) => ({ s, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((o) => o.s)

      const coarse = window.matchMedia('(pointer: coarse)').matches
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75)
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr <= 1.5, alpha: true, powerPreference: coarse ? 'low-power' : 'high-performance' })
      } catch {
        if (alive) setStatus('error')
        return
      }
      renderer.setPixelRatio(dpr)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15
      const W = () => canvas.clientWidth || wrapRef.current?.clientWidth || 600
      const H = () => canvas.clientHeight || 440
      renderer.setSize(W(), H(), false)

      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x07051a, 0.028)
      const aspect0 = W() / H()
      const camera = new THREE.PerspectiveCamera(aspect0 < 0.9 ? 55 : W() < 560 ? 52 : 42, aspect0, 0.1, 120)
      // Frame the whole 4x4 formation + disc with margin on every screen.
      const baseDist = aspect0 < 0.75 ? 15.2 : aspect0 < 1 ? 13.6 : 12.4
      camera.position.set(0, 5.4, baseDist + 3)
      camera.lookAt(0, -0.2, 0)

      scene.add(new THREE.HemisphereLight(0x9be9ff, 0x2a1650, 0.85))
      const key = new THREE.DirectionalLight(0xffffff, 1.5)
      key.position.set(5, 9, 6)
      scene.add(key)
      const cyanPt = new THREE.PointLight(0x67e8f9, 90, 40, 1.8)
      cyanPt.position.set(6, 3, 5)
      scene.add(cyanPt)
      const violetPt = new THREE.PointLight(0xa78bfa, 110, 45, 1.8)
      violetPt.position.set(-6, 3.5, -3)
      scene.add(violetPt)
      const spot = new THREE.SpotLight(0xfcd34d, 60, 30, Math.PI / 6, 0.5, 1.6)
      spot.position.set(0, 10, 2)
      spot.target.position.set(0, 0, 0)
      scene.add(spot, spot.target)
      const flashLight = new THREE.PointLight(0xffffff, 0, 20, 1.6)
      flashLight.position.set(0, 2.5, 3)
      scene.add(flashLight)

      const group = new THREE.Group()
      scene.add(group)

      // Ground disc sits clearly BELOW the lowest cube — never clips faces.
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(7.4, 64),
        new THREE.MeshStandardMaterial({
          color: 0x0d0b2c, roughness: 0.35, metalness: 0.8,
          transparent: true, opacity: 0.92,
          emissive: 0x1a1448, emissiveIntensity: 0.5,
        })
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.y = DISC_Y
      scene.add(disc)
      const grid = new THREE.PolarGridHelper(7.4, 12, 7, 48, 0x67e8f9, 0x4c3a9e)
      grid.position.y = DISC_Y + 0.02
      grid.material.transparent = true
      grid.material.opacity = 0.28
      scene.add(grid)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(7.45, 7.7, 96),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = DISC_Y + 0.03
      scene.add(ring)

      const cubes = []
      const geo = new THREE.BoxGeometry(1.18, 1.18, 1.18)
      const edgeGeo = new THREE.EdgesGeometry(geo)
      order.forEach((symbol, idx) => {
        const row = Math.floor(idx / 4)
        const col = idx % 4
        const face = makeFaceTexture(THREE, symbol, false, false)
        const side = new THREE.MeshPhysicalMaterial({
          color: 0x2a2370, roughness: 0.28, metalness: 0.65,
          clearcoat: 0.7, clearcoatRoughness: 0.25,
          emissive: 0x141040, emissiveIntensity: 0.5,
        })
        const front = new THREE.MeshPhysicalMaterial({
          map: face, roughness: 0.3, metalness: 0.25,
          emissive: 0x67e8f9, emissiveMap: face, emissiveIntensity: 0.42,
          clearcoat: 0.8, clearcoatRoughness: 0.2,
        })
        const mats = [side, side, side, side, front, side]
        const mesh = new THREE.Mesh(geo, mats)
        mesh.position.set(
          (col - 1.5) * 1.62,
          (1.5 - row) * 1.55 + 0.15 + Math.sin(idx * 1.3) * 0.05,
          Math.cos(idx * 0.7) * 0.24
        )
        mesh.rotation.set(-0.12, 0.35, 0)
        mesh.userData = { idx, symbol, open: false, matched: false, spin: 0, float: Math.random() * Math.PI * 2, pop: 0, hover: 0 }
        const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.55 }))
        mesh.add(edge)
        group.add(mesh)
        cubes.push(mesh)
      })

      function makeStars(n, spread, size, color, opacity) {
        const g = new THREE.BufferGeometry()
        const p = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) {
          p[i * 3] = (Math.random() - 0.5) * spread[0]
          p[i * 3 + 1] = (Math.random() - 0.5) * spread[1]
          p[i * 3 + 2] = -Math.random() * 16 - 3
        }
        g.setAttribute('position', new THREE.BufferAttribute(p, 3))
        const m = new THREE.PointsMaterial({ size, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
        return new THREE.Points(g, m)
      }
      const starN = coarse ? 220 : 420
      const starsFar = makeStars(Math.floor(starN * 0.6), [34, 20], 0.07, 0xbfdbfe, 0.8)
      const starsNear = makeStars(Math.floor(starN * 0.4), [26, 16], 0.13, 0x67e8f9, 0.9)
      scene.add(starsFar, starsNear)

      const MAXP = 420
      const pGeo = new THREE.BufferGeometry()
      const pPos = new Float32Array(MAXP * 3)
      const pVel = new Float32Array(MAXP * 3)
      const pLife = new Float32Array(MAXP)
      for (let i = 0; i < MAXP; i++) pPos[i * 3 + 1] = -999
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
      const pMat = new THREE.PointsMaterial({ size: 0.14, color: 0xfcd34d, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
      const bursts = new THREE.Points(pGeo, pMat)
      bursts.frustumCulled = false
      scene.add(bursts)
      let pCursor = 0
      function spawnBurst(worldPos, color = 0xfcd34d, count = 46, speed = 3.4) {
        pMat.color.set(color)
        for (let i = 0; i < count; i++) {
          const k = pCursor = (pCursor + 1) % MAXP
          pPos[k * 3] = worldPos.x; pPos[k * 3 + 1] = worldPos.y; pPos[k * 3 + 2] = worldPos.z
          const th = Math.random() * Math.PI * 2
          const ph = Math.acos(2 * Math.random() - 1)
          const sp = speed * (0.35 + Math.random() * 0.85)
          pVel[k * 3] = Math.sin(ph) * Math.cos(th) * sp
          pVel[k * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.9 + 1.2
          pVel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp
          pLife[k] = 1
        }
      }

      const ray = new THREE.Raycaster()
      const ptr = new THREE.Vector2()
      let rotX = 0.16, rotY = 0, tRotX = 0.16, tRotY = 0
      let dragging = false, px = 0, py = 0, moved = 0
      let tDist = baseDist
      let lastInteract = performance.now()
      let open = []
      let lock = false
      let hovered = null
      let visible = true
      let inView = true

      function refreshTexture(mesh) {
        const { symbol, open: o, matched: m } = mesh.userData
        const t = makeFaceTexture(THREE, symbol, o, m)
        const fm = mesh.material[4]
        const old = fm.map
        fm.map = t
        fm.emissiveMap = t
        if (old && old !== t) old.dispose()
        fm.emissive.set(m ? 0xfcd34d : o ? 0x67e8f9 : 0x0b1030)
        fm.emissiveIntensity = m ? 0.85 : o ? 0.6 : 0.42
        fm.needsUpdate = true
        mesh.children[0].material.color.set(m ? 0xfcd34d : o ? 0xa5f3fc : 0x67e8f9)
        mesh.children[0].material.opacity = m || o ? 0.95 : 0.55
      }

      function setPtr(e) {
        const r = canvas.getBoundingClientRect()
        const x = (e.clientX ?? e.touches?.[0]?.clientX) - r.left
        const y = (e.clientY ?? e.touches?.[0]?.clientY) - r.top
        ptr.x = (x / r.width) * 2 - 1
        ptr.y = -(y / r.height) * 2 + 1
      }
      function pick() {
        ray.setFromCamera(ptr, camera)
        const hit = ray.intersectObjects(cubes, false)[0]
        return hit?.object || null
      }

      function onDown(e) {
        dragging = true; moved = 0
        px = e.clientX ?? e.touches?.[0]?.clientX ?? 0
        py = e.clientY ?? e.touches?.[0]?.clientY ?? 0
        lastInteract = performance.now()
        canvas.style.cursor = 'grabbing'
      }
      function onMove(e) {
        if (!dragging) {
          if (e.pointerType !== 'touch' && e.clientX != null) {
            setPtr(e)
            const h = pick()
            if (hovered && hovered !== h) hovered.userData.hover = 0
            hovered = h
            if (hovered && !hovered.userData.matched) hovered.userData.hover = 1
            canvas.style.cursor = h ? 'pointer' : 'grab'
          }
          return
        }
        const x = e.clientX ?? e.touches?.[0]?.clientX
        const y = e.clientY ?? e.touches?.[0]?.clientY
        if (x == null) return
        const dx = x - px, dy = y - py
        moved += Math.abs(dx) + Math.abs(dy)
        tRotY += dx * 0.0085
        tRotX += dy * 0.005
        tRotX = Math.max(-0.7, Math.min(0.95, tRotX))
        px = x; py = y
        lastInteract = performance.now()
      }
      function onUp(e) {
        canvas.style.cursor = 'grab'
        if (!dragging) return
        dragging = false
        lastInteract = performance.now()
        if (moved > 12 || lock) return
        if (e.clientX == null && !e.changedTouches) return
        setPtr(e.changedTouches ? { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY } : e)
        const mesh = pick()
        if (!mesh || mesh.userData.open || mesh.userData.matched) return
        mesh.userData.open = true
        mesh.userData.spin = 1
        mesh.userData.pop = 1
        refreshTexture(mesh)
        try { playRef.current(520, 0.08) } catch { /* noop */ }
        try { navigator.vibrate?.(12) } catch { /* noop */ }
        const wp = new THREE.Vector3()
        mesh.getWorldPosition(wp)
        spawnBurst(wp, 0x67e8f9, 14, 1.6)
        open.push(mesh)
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
              const pa = new THREE.Vector3(); a.getWorldPosition(pa)
              const pb = new THREE.Vector3(); b.getWorldPosition(pb)
              spawnBurst(pa, 0xfcd34d, 55, 3.6)
              spawnBurst(pb, 0xfcd34d, 55, 3.6)
              flashLight.intensity = 90
              setTimeout(() => { flashLight.intensity = 0 }, 220)
              try { playRef.current(780, 0.16) } catch { /* noop */ }
              try { navigator.vibrate?.([20, 30, 50]) } catch { /* noop */ }
              open = []
              lock = false
              setMatched((m) => {
                const nm = m + 2
                if (nm >= 16) setWon(true)
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
              lock = false
            }, 720)
          }
        }
      }
      function onWheel(e) {
        e.preventDefault()
        tDist = Math.max(8, Math.min(18, tDist + e.deltaY * 0.01))
        lastInteract = performance.now()
      }

      canvas.addEventListener('pointerdown', onDown)
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.style.cursor = 'grab'

      function fitCamera() {
        const w = W(), h = H()
        renderer.setSize(w, h, false)
        const a = w / h
        camera.aspect = a
        camera.fov = a < 0.75 ? 57 : a < 1 ? 52 : w < 560 ? 50 : 42
        const need = a < 0.75 ? 15.4 : a < 1 ? 13.8 : 12.4
        if (tDist < need - 1) tDist = need
        tDist = Math.max(8, Math.min(18, tDist))
        camera.updateProjectionMatrix()
      }
      fitCamera()
      window.addEventListener('resize', fitCamera)

      const io = new IntersectionObserver((entries) => {
        inView = entries[0]?.isIntersecting ?? true
      }, { threshold: 0.05 })
      io.observe(canvas)
      function onVis() {
        visible = !document.hidden
        if (visible && inView && alive && !raf) raf = requestAnimationFrame(tick)
      }
      document.addEventListener('visibilitychange', onVis)

      const clock = new THREE.Clock()
      const LOOK = new THREE.Vector3(0, -0.2, 0)
      let intro = 0
      function tick() {
        if (!alive) return
        if (!visible || !inView) { raf = 0; return }
        raf = requestAnimationFrame(tick)
        const dt = Math.min(0.05, clock.getDelta())
        const t = clock.getElapsedTime()

        if (!dragging && performance.now() - lastInteract > 4500) {
          tRotY += dt * 0.22
        }
        if (intro < 1) {
          intro = Math.min(1, intro + dt * 0.55)
          const e = 1 - Math.pow(1 - intro, 3)
          camera.position.z = (baseDist + 3) + (tDist - (baseDist + 3)) * e
          camera.position.y = 8 + (5.2 - 8) * e
        } else {
          camera.position.z += (tDist - camera.position.z) * 0.08
          camera.position.y += (5.2 - camera.position.y) * 0.06
        }
        rotX += (tRotX - rotX) * 0.09
        rotY += (tRotY - rotY) * 0.09
        group.rotation.set(rotX, rotY, 0)
        // Keep the whole formation + disc framed every frame (fixes bottom cutoff).
        camera.position.x += ((tRotY * 0.15) - camera.position.x) * 0.05
        camera.lookAt(LOOK)

        cubes.forEach((m) => {
          const u = m.userData
          m.position.y += Math.sin(t * 1.5 + u.float) * 0.0011
          if (u.spin > 0) {
            m.rotation.y += 0.3
            u.spin -= 0.065
            if (u.spin <= 0) m.rotation.y = Math.round(m.rotation.y / (Math.PI * 2)) * Math.PI * 2 + 0.35
          } else {
            m.rotation.y += (0.35 - m.rotation.y) * 0.06
          }
          const target = 1 + (u.pop > 0 ? u.pop * 0.16 : 0) + (u.hover ? 0.07 : 0)
          if (u.pop > 0) u.pop = Math.max(0, u.pop - dt * 3.2)
          if (u.hover) u.hover = Math.max(0, u.hover - dt * 2.5)
          const s = m.scale.x + (target - m.scale.x) * 0.18
          m.scale.setScalar(s)
          if (u.matched) {
            m.rotation.z = Math.sin(t * 1.2 + u.float) * 0.05
          }
        })

        for (let i = 0; i < MAXP; i++) {
          if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue }
          pLife[i] -= dt * 1.15
          pVel[i * 3 + 1] -= dt * 2.2
          pPos[i * 3] += pVel[i * 3] * dt
          pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt
          pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt
        }
        pGeo.attributes.position.needsUpdate = true

        starsFar.rotation.y = t * 0.008
        starsNear.rotation.y = -t * 0.012
        ring.material.opacity = 0.35 + Math.sin(t * 1.6) * 0.15
        ring.rotation.z = t * 0.05
        cyanPt.intensity = 90 + Math.sin(t * 2.1) * 18
        violetPt.intensity = 110 + Math.cos(t * 1.7) * 20
        renderer.render(scene, camera)
      }
      if (alive) {
        setStatus('ready')
        raf = requestAnimationFrame(tick)
      }

      cleanup = () => {
        io.disconnect()
        document.removeEventListener('visibilitychange', onVis)
        canvas.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        canvas.removeEventListener('wheel', onWheel)
        window.removeEventListener('resize', fitCamera)
        cancelAnimationFrame(raf)
        raf = 0
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose()
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach((mm) => { if (mm.map) mm.map.dispose(); if (mm.emissiveMap && mm.emissiveMap !== mm.map) mm.emissiveMap.dispose(); mm.dispose() })
          }
        })
        renderer.dispose()
      }
    }

    init()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      try { cleanup?.() } catch { /* noop */ }
      renderer?.dispose?.()
    }
  }, [deckKey])

  useEffect(() => {
    if (won) {
      try { navigator.vibrate?.([30, 40, 30, 40, 100]) } catch { /* noop */ }
      onWinRef.current({ score: Math.max(150, 1100 - movesStateRef.current * 12 - secsRef.current * 2), moves: movesStateRef.current, time: secsRef.current })
    }
  }, [won])

  return (
    <div className="cube-wrap" ref={wrapRef}>
      <div className="hud">
        <span className="chip">Moves <b>{moves}</b></span>
        <span className="chip">Matched <b>{matched}/16</b></span>
        <span className="chip">Time <b>{formatTime(secs)}</b></span>
        <span className="chip live-score">◈ {Math.max(0, 1100 - moves * 12 - secs * 2)} pts</span>
      </div>
      <div className="progress-wrap" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      {status === 'error' ? (
        <div className="cube-error" role="alert">
          <span>3D failed to load (WebGL or network). Flip and Flash still play.</span>
          <button type="button" className="btn small primary" onClick={() => { setStatus('loading'); setDeckKey((k) => k + 1) }}>↻ Retry 3D</button>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="cube-canvas" aria-label="3D cube memory board. Drag to rotate, scroll to zoom, tap a cube to flip." />
          {status === 'loading' && (
            <div className="cube-hint" role="status" style={{ textAlign: 'center' }}>Loading 3D cubes…</div>
          )}
        </>
      )}
      <div className="controls-row">
        <span className="cube-hint">Drag to orbit · Scroll to zoom · Tap two cubes to match runes</span>
        <button
          type="button"
          className="btn small ghost"
          style={{ marginLeft: 'auto' }}
          onClick={() => { setMoves(0); movesRef.current = 0; setMatched(0); setWon(false); resetSecs(); setDeckKey((k) => k + 1) }}
        >
          ↻ Restart
        </button>
      </div>
    </div>
  )
}
