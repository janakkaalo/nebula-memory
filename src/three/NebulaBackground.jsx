import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * One fixed cosmic environment behind the whole site.
 * Two star layers + nebula shader plane + drifting dust.
 * Scroll drives camera depth, mouse drives small parallax.
 * Pauses off-screen and on hidden tabs, caps pixel ratio for mobile.
 */
export default function NebulaBackground() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x0d0a24, 1)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0d0a24, 0.035)

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200)
    camera.position.set(0, 0, 12)

    // Nebula shader plane far behind
    const nebulaUniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
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
        // cheap value noise
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x),
                     mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0; float a = 0.5;
          for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.02; a *= 0.5; }
          return v;
        }
        void main(){
          vec2 uv = vUv - 0.5;
          uv.x *= 1.6;
          float t = uTime * 0.02;
          float n1 = fbm(uv*2.2 + vec2(t, -t*0.6) + uScroll*0.6);
          float n2 = fbm(uv*3.4 - vec2(t*0.7, t) - uScroll*0.3);
          vec3 deep = vec3(0.05, 0.04, 0.14);
          vec3 cyan = vec3(0.10, 0.45, 0.60);
          vec3 violet = vec3(0.38, 0.22, 0.72);
          vec3 magenta = vec3(0.62, 0.28, 0.72);
          vec3 col = deep;
          col = mix(col, violet, smoothstep(0.28, 0.72, n1));
          col = mix(col, cyan, smoothstep(0.42, 0.85, n2) * 0.65);
          col = mix(col, magenta, smoothstep(0.62, 0.95, n1*n2*1.8) * 0.5);
          float vig = smoothstep(0.95, 0.25, length(uv));
          col *= (0.55 + 0.65 * vig);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(90, 55), nebulaMat)
    nebula.position.z = -28
    scene.add(nebula)

    function makeStars(count, size, spread, opacity, tint) {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(count * 3)
      const col = new Float32Array(count * 3)
      const c = new THREE.Color(tint)
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * spread[0]
        pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1]
        pos[i * 3 + 2] = -Math.random() * 24 - 1
        const b = 0.5 + Math.random() * 0.5
        col[i * 3] = c.r * b
        col[i * 3 + 1] = c.g * b
        col[i * 3 + 2] = c.b * b
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const mat = new THREE.PointsMaterial({
        size, vertexColors: true, transparent: true, opacity,
        sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      return new THREE.Points(geo, mat)
    }

    const starCount = coarse ? 650 : 1300
    const starsFar = makeStars(Math.floor(starCount * 0.65), 0.09, [70, 40], 0.85, '#bfdbfe')
    const starsNear = makeStars(Math.floor(starCount * 0.35), 0.16, [50, 30], 0.95, '#67e8f9')
    scene.add(starsFar, starsNear)

    // dust motes drifting
    const dustGeo = new THREE.BufferGeometry()
    const dustCount = coarse ? 90 : 180
    const dustPos = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 30
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 18
      dustPos[i * 3 + 2] = Math.random() * 8 - 2
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ size: 0.12, color: 0xa78bfa, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    scene.add(dust)

    // soft glow sprites for depth
    const glowTex = (() => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 128
      const ctx = cv.getContext('2d')
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(103,232,249,0.9)')
      g.addColorStop(0.4, 'rgba(139,92,246,0.35)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
      const t = new THREE.CanvasTexture(cv)
      return t
    })()
    const glows = []
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.16 + Math.random() * 0.12, depthWrite: false })
      const s = new THREE.Sprite(m)
      s.position.set((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 18, -14 - Math.random() * 10)
      const sc = 7 + Math.random() * 9
      s.scale.set(sc, sc, 1)
      scene.add(s)
      glows.push(s)
    }

    let targetScroll = 0
    let shownScroll = 0
    let mx = 0, my = 0, smx = 0, smy = 0
    let raf = 0
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
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('resize', onResize)

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    })

    function tick(now) {
      if (!running) return
      raf = requestAnimationFrame(tick)
      const dt = Math.min(100, now - last)
      last = now
      const t = now / 1000

      // ease scroll + mouse
      const k = 1 - Math.pow(1 - 0.08, dt / 16.667)
      shownScroll += (targetScroll - shownScroll) * k
      smx += (mx - smx) * k
      smy += (my - smy) * k

      if (!reduced) {
        nebulaUniforms.uTime.value = t
        nebulaUniforms.uScroll.value = shownScroll
        starsFar.rotation.z = t * 0.004 + shownScroll * 0.15
        starsNear.rotation.z = -t * 0.006 + shownScroll * 0.3
        dust.rotation.y = t * 0.02
        dust.position.y = Math.sin(t * 0.18) * 0.6
        glows.forEach((g, i) => {
          g.position.y += Math.sin(t * 0.3 + i) * 0.0012
        })
        camera.position.z = 12 - shownScroll * 3.2
        camera.position.x = smx * 1.1
        camera.position.y = -smy * 0.7 - shownScroll * 1.4
      } else {
        camera.position.z = 11
        camera.position.x = 0
        camera.position.y = 0
      }
      camera.lookAt(0, 0, -10)
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('resize', onResize)
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
          else o.material.dispose()
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
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
