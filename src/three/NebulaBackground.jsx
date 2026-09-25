import { useEffect, useRef, useState } from 'react'

/**
 * Cinematic cosmic environment behind the whole site.
 * Three.js loads lazily + idle so first paint never waits for WebGL.
 * Domain-warped nebula shader + twinkling stars + dust + glow sprites +
 * shooting stars + scroll/parallax camera. Pauses on hidden tabs,
 * caps pixel ratio for mobile, honors reduced-motion / save-data.
 */
function NebulaScene() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let alive = true
    let renderer = null
    let raf = 0
    let cleanup = null

    async function init() {
      let THREE
      try {
        THREE = await import('three')
      } catch {
        return
      }
      if (!alive || !mountRef.current) return

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const saveData = navigator.connection?.saveData === true
      const lowMem = (navigator.deviceMemory || 8) <= 4

      try {
        renderer = new THREE.WebGLRenderer({ antialias: !coarse && !lowMem, alpha: true, powerPreference: coarse ? 'low-power' : 'high-performance' })
      } catch {
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse || lowMem ? 1.25 : 1.75))
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setClearColor(0x0a0722, 1)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1
      mount.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x0a0722, 0.03)

      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220)
      camera.position.set(0, 0, 12)

      const nebulaUniforms = {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uAspect: { value: window.innerWidth / window.innerHeight },
      }
      const nebulaMat = new THREE.ShaderMaterial({
        uniforms: nebulaUniforms,
        depthWrite: false,
        transparent: true,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uScroll;
          uniform float uAspect;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float noise(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x),
                       mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
          }
          float fbm(vec2 p){
            float v = 0.0; float a = 0.5;
            mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
            for(int i=0;i<5;i++){ v += a*noise(p); p = r*p; a *= 0.5; }
            return v;
          }
          void main(){
            vec2 uv = vUv - 0.5;
            uv.x *= uAspect * 0.9;
            float t = uTime * 0.025;
            vec2 q = vec2(fbm(uv * 2.0 + t * 0.7), fbm(uv * 2.0 - t * 0.5));
            vec2 r = vec2(fbm(uv * 2.6 + q * 1.8 + vec2(1.7, 9.2) + t * 0.3), fbm(uv * 2.6 + q * 1.8 + vec2(8.3, 2.8) - t * 0.25));
            float n1 = fbm(uv * 2.4 + r * 1.6 + uScroll * 0.9);
            float n2 = fbm(uv * 3.6 - r + uScroll * vec2(-0.4, 0.5));
            float filaments = smoothstep(0.45, 0.9, fbm(uv * 5.0 + q * 2.5 - t * 0.4));
            vec3 deep = vec3(0.035, 0.028, 0.11);
            vec3 indigo = vec3(0.16, 0.12, 0.42);
            vec3 cyan = vec3(0.08, 0.5, 0.66);
            vec3 violet = vec3(0.42, 0.24, 0.78);
            vec3 magenta = vec3(0.68, 0.3, 0.74);
            vec3 gold = vec3(0.85, 0.62, 0.3);
            vec3 col = deep;
            col = mix(col, indigo, smoothstep(0.2, 0.7, n1));
            col = mix(col, violet, smoothstep(0.35, 0.78, r.x));
            col = mix(col, cyan, smoothstep(0.42, 0.85, n2) * 0.7);
            col = mix(col, magenta, smoothstep(0.6, 0.95, n1 * n2 * 2.0) * 0.55);
            col += gold * smoothstep(0.68, 0.98, filaments) * 0.22;
            col += vec3(0.4, 0.7, 1.0) * smoothstep(0.72, 1.0, n2 * filaments) * 0.18;
            float vig = smoothstep(1.05, 0.2, length(uv));
            col *= (0.5 + 0.75 * vig);
            col += vec3(0.1, 0.16, 0.3) * (1.0 - vUv.y) * 0.25;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
      const nebula = new THREE.Mesh(new THREE.PlaneGeometry(110, 68), nebulaMat)
      nebula.position.z = -30
      scene.add(nebula)

      const auroraMat = new THREE.ShaderMaterial({
        uniforms: { uTime: nebulaUniforms.uTime, uScroll: nebulaUniforms.uScroll },
        depthWrite: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv; uniform float uTime; uniform float uScroll;
          void main(){
            float band = exp(-pow((vUv.y - 0.62 - sin(vUv.x*6.0 + uTime*0.4)*0.05 - uScroll*0.2)*9.0, 2.0));
            vec3 col = mix(vec3(0.1,0.9,0.9), vec3(0.6,0.3,1.0), vUv.x);
            gl_FragColor = vec4(col * band * 0.35, band * 0.5);
          }`,
      })
      const aurora = new THREE.Mesh(new THREE.PlaneGeometry(100, 40), auroraMat)
      aurora.position.z = -22
      scene.add(aurora)

      function makeStars(count, size, spread, opacity, tint) {
        const geo = new THREE.BufferGeometry()
        const pos = new Float32Array(count * 3)
        const col = new Float32Array(count * 3)
        const seed = new Float32Array(count)
        const c = new THREE.Color(tint)
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * spread[0]
          pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1]
          pos[i * 3 + 2] = -Math.random() * 26 - 1
          const b = 0.5 + Math.random() * 0.5
          col[i * 3] = c.r * b
          col[i * 3 + 1] = c.g * b
          col[i * 3 + 2] = c.b * b
          seed[i] = Math.random() * Math.PI * 2
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
        const mat = new THREE.PointsMaterial({
          size, vertexColors: true, transparent: true, opacity,
          sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
        })
        const pts = new THREE.Points(geo, mat)
        pts.userData.baseOpacity = opacity
        return pts
      }

      let starCount = coarse ? 700 : 1400
      if (saveData || lowMem) starCount = Math.floor(starCount * 0.45)
      const starsFar = makeStars(Math.floor(starCount * 0.6), 0.09, [80, 44], 0.85, '#bfdbfe')
      const starsNear = makeStars(Math.floor(starCount * 0.4), 0.17, [56, 32], 0.95, '#67e8f9')
      scene.add(starsFar, starsNear)

      const dustGeo = new THREE.BufferGeometry()
      let dustCount = coarse ? 90 : 190
      if (saveData || lowMem) dustCount = 50
      const dustPos = new Float32Array(dustCount * 3)
      for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 32
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 20
        dustPos[i * 3 + 2] = Math.random() * 9 - 2
      }
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
      const dust = new THREE.Points(
        dustGeo,
        new THREE.PointsMaterial({ size: 0.13, color: 0xa78bfa, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
      )
      scene.add(dust)

      const glowTex = (() => {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 128
        const ctx = cv.getContext('2d')
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
        g.addColorStop(0, 'rgba(103,232,249,0.9)')
        g.addColorStop(0.35, 'rgba(139,92,246,0.4)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 128, 128)
        return new THREE.CanvasTexture(cv)
      })()
      const glows = []
      const glowN = saveData || lowMem ? 4 : 8
      for (let i = 0; i < glowN; i++) {
        const m = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.14 + Math.random() * 0.13, depthWrite: false, blending: THREE.AdditiveBlending })
        const s = new THREE.Sprite(m)
        s.position.set((Math.random() - 0.5) * 36, (Math.random() - 0.5) * 20, -14 - Math.random() * 10)
        const sc = 8 + Math.random() * 10
        s.scale.set(sc, sc, 1)
        scene.add(s)
        glows.push(s)
      }

      const shooters = []
      const shooterN = saveData ? 1 : 3
      for (let i = 0; i < shooterN; i++) {
        const g = new THREE.PlaneGeometry(3.2, 0.07)
        const m = new THREE.MeshBasicMaterial({ color: 0xbdf3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const mesh = new THREE.Mesh(g, m)
        mesh.position.z = -6
        mesh.rotation.z = -0.5
        scene.add(mesh)
        shooters.push({ mesh, t: -1, next: 3 + i * 5 + Math.random() * 6, vx: 0, vy: 0 })
      }
      function fireShooter(s) {
        s.t = 0
        s.mesh.position.set(6 + Math.random() * 10, 4 + Math.random() * 6, -6)
        s.vx = -(9 + Math.random() * 6)
        s.vy = -(4 + Math.random() * 3)
        s.mesh.rotation.z = Math.atan2(s.vy, s.vx)
      }

      const planetTex = (() => {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 256
        const ctx = cv.getContext('2d')
        const g = ctx.createRadialGradient(96, 90, 10, 128, 128, 128)
        g.addColorStop(0, '#26407a')
        g.addColorStop(0.5, '#141a45')
        g.addColorStop(0.82, 'rgba(20,16,50,0.9)')
        g.addColorStop(1, 'rgba(20,16,50,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 256, 256)
        ctx.strokeStyle = 'rgba(103,232,249,.5)'
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.ellipse(128, 132, 110, 26, -0.25, 0, Math.PI * 2); ctx.stroke()
        return new THREE.CanvasTexture(cv)
      })()
      const planet = new THREE.Sprite(new THREE.SpriteMaterial({ map: planetTex, transparent: true, opacity: 0.85, depthWrite: false }))
      planet.position.set(13, 5.5, -20)
      planet.scale.set(11, 11, 1)
      scene.add(planet)

      let targetScroll = 0
      let shownScroll = 0
      let mx = 0, my = 0, smx = 0, smy = 0
      let last = performance.now()
      let running = true

      function onScroll() {
        const h = document.documentElement.scrollHeight - window.innerHeight
        targetScroll = h > 0 ? Math.min(1, window.scrollY / h) : 0
      }
      function onMouse(e) {
        mx = (e.clientX / window.innerWidth - 0.5) * 2
        my = (e.clientY / window.innerHeight - 0.5) * 2
      }
      function onTouch(e) {
        if (e.touches && e.touches[0]) {
          mx = (e.touches[0].clientX / window.innerWidth - 0.5) * 1.2
        }
      }
      function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
        nebulaUniforms.uAspect.value = camera.aspect
      }

      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('mousemove', onMouse, { passive: true })
      window.addEventListener('touchmove', onTouch, { passive: true })
      window.addEventListener('resize', onResize)

      function onVis() {
        if (document.hidden) {
          running = false
          cancelAnimationFrame(raf)
          raf = 0
        } else if (!running && alive) {
          running = true
          last = performance.now()
          raf = requestAnimationFrame(tick)
        }
      }
      document.addEventListener('visibilitychange', onVis)

      // Render one static frame immediately so first paint has the nebula,
      // then animate only if motion is allowed.
      function renderFrame(t) {
        shownScroll += (targetScroll - shownScroll) * 0.08
        smx += (mx - smx) * 0.08
        smy += (my - smy) * 0.08
        nebulaUniforms.uTime.value = t
        nebulaUniforms.uScroll.value = shownScroll
        camera.position.z = 12 - shownScroll * 3.4
        camera.position.x = smx * 1.15
        camera.position.y = -smy * 0.7 - shownScroll * 1.5
        camera.lookAt(0, 0, -10)
        renderer.render(scene, camera)
      }

      function tick(now) {
        if (!running || !alive) return
        raf = requestAnimationFrame(tick)
        const dt = Math.min(100, now - last)
        last = now
        const t = now / 1000
        const dts = dt / 1000

        const k = 1 - Math.pow(1 - 0.08, dt / 16.667)
        shownScroll += (targetScroll - shownScroll) * k
        smx += (mx - smx) * k
        smy += (my - smy) * k

        if (!reduced) {
          nebulaUniforms.uTime.value = t
          nebulaUniforms.uScroll.value = shownScroll
          starsFar.rotation.z = t * 0.004 + shownScroll * 0.16
          starsNear.rotation.z = -t * 0.006 + shownScroll * 0.32
          starsFar.material.opacity = starsFar.userData.baseOpacity * (0.82 + Math.sin(t * 1.7) * 0.12)
          starsNear.material.opacity = starsNear.userData.baseOpacity * (0.85 + Math.sin(t * 2.3 + 1) * 0.15)
          dust.rotation.y = t * 0.02
          dust.position.y = Math.sin(t * 0.18) * 0.6
          aurora.position.y = Math.sin(t * 0.22) * 0.5 - shownScroll * 2
          planet.position.y = 5.5 - shownScroll * 3 + Math.sin(t * 0.2) * 0.25
          glows.forEach((g, i) => {
            g.position.y += Math.sin(t * 0.3 + i * 1.7) * 0.0014
            g.material.opacity = 0.13 + Math.sin(t * 0.7 + i) * 0.05 + 0.06
          })
          shooters.forEach((s) => {
            if (s.t < 0) {
              s.next -= dts
              if (s.next <= 0) fireShooter(s)
              else s.mesh.material.opacity = 0
              return
            }
            s.t += dts
            s.mesh.position.x += s.vx * dts
            s.mesh.position.y += s.vy * dts
            const fade = Math.max(0, 0.9 - s.t * 0.55)
            s.mesh.material.opacity = fade
            if (s.t > 1.6 || s.mesh.position.x < -20) {
              s.t = -1
              s.next = 4 + Math.random() * 9
              s.mesh.material.opacity = 0
            }
          })
          camera.position.z = 12 - shownScroll * 3.4
          camera.position.x = smx * 1.15
          camera.position.y = -smy * 0.7 - shownScroll * 1.5
        } else {
          camera.position.z = 11
          camera.position.x = 0
          camera.position.y = 0
        }
        camera.lookAt(0, 0, -10)
        renderer.render(scene, camera)
      }

      if (reduced) {
        // One frame only — no animation loop, same visuals frozen.
        renderFrame(1.2)
        running = false
      } else {
        raf = requestAnimationFrame(tick)
      }

      cleanup = () => {
        running = false
        cancelAnimationFrame(raf)
        raf = 0
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('mousemove', onMouse)
        window.removeEventListener('touchmove', onTouch)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('visibilitychange', onVis)
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose()
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
            else {
              if (o.material.map) o.material.map.dispose()
              o.material.dispose()
            }
          }
        })
        renderer.dispose()
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      }
    }

    init()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      try { cleanup?.() } catch { /* noop */ }
      renderer?.dispose?.()
    }
  }, [])

  return (
    <>
      <div className="nebula-fixed" ref={mountRef} aria-hidden="true" />
      <div className="nebula-vignette" aria-hidden="true" />
      <div className="nebula-grain" aria-hidden="true" />
    </>
  )
}

export default function NebulaBackground() {
  // Defer WebGL until the browser is idle so LCP/FCP never wait for three.js.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReady(true)
      return
    }
    let id = 0
    let to = 0
    if ('requestIdleCallback' in window) {
      id = window.requestIdleCallback(() => setReady(true), { timeout: 1800 })
    } else {
      to = setTimeout(() => setReady(true), 350)
    }
    return () => {
      if ('cancelIdleCallback' in window && id) window.cancelIdleCallback(id)
      clearTimeout(to)
    }
  }, [])
  if (!ready) {
    return (
      <>
        <div className="nebula-fixed" aria-hidden="true" />
        <div className="nebula-vignette" aria-hidden="true" />
        <div className="nebula-grain" aria-hidden="true" />
      </>
    )
  }
  return <NebulaScene />
}
