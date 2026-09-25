/**
 * Fundo ambiente Three.js do PORTAL (Sala de Jogos).
 * Cartões e UI ficam em HTML — aqui só o cenário atrás.
 * Three.js via importmap → js/vendor/three.module.js (r160).
 */
import * as THREE from "three";

export const FAIL_PT =
  "Não foi possível iniciar o fundo 3D. O portal continua no visual clássico (2D).";

const IDLE_MS = 45000;

function detectLowEnd() {
  try {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    if (window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900) return true;
  } catch (_) {}
  return false;
}

function showFail(el, msg) {
  if (!el) return;
  el.hidden = false;
  el.removeAttribute("hidden");
  el.textContent = msg;
  window.setTimeout(() => {
    if (el && el.textContent === msg) {
      el.hidden = true;
      el.setAttribute("hidden", "");
    }
  }, 8000);
}

function useFallback(view3d, failEl, msg) {
  if (msg) showFail(failEl, msg);
  document.body.classList.add("renderer-canvas");
  document.body.classList.remove("renderer-webgl", "has-webgl-bg");
  if (view3d) {
    view3d.hidden = true;
    view3d.setAttribute("hidden", "");
  }
}

class PortalBg {
  constructor(view) {
    this.view = view;
    this.ok = false;
    this.playing = false;
    this.paused = false;
    this.raf = 0;
    this.time = 0;
    this.lastActivity = performance.now();
    this.floats = [];

    this.reducedMotion = false;
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.reducedMotion = !!mq.matches;
      if (mq.addEventListener) {
        mq.addEventListener("change", (e) => {
          this.reducedMotion = !!e.matches;
          this.lowFx = this.isLowEnd || this.reducedMotion;
          if (this.reducedMotion) this.stopLoop(true);
          else {
            this.paused = false;
            this.startLoop();
          }
        });
      }
    } catch (_) {}

    this.isLowEnd = detectLowEnd();
    this.lowFx = this.isLowEnd || this.reducedMotion;
    this.boot();
  }

  boot() {
    if (!THREE?.WebGLRenderer) throw new Error("no-three");
    if (!this.view) throw new Error("no-view3d");
    this.setup();
    this.fit();
    this.renderer.render(this.scene, this.camera);
    this.ok = true;
    this.bind();
    if (!this.reducedMotion) this.startLoop();
  }

  setup() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x08080b);
    this.scene.fog = new THREE.FogExp2(0x0c0c12, this.isLowEnd ? 0.055 : 0.032);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.2, 60);
    this.camera.position.set(0, 0.2, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.view,
      antialias: false,
      alpha: false,
      powerPreference: this.isLowEnd ? "low-power" : "high-performance"
    });
    const dprCap = this.lowFx ? 1 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    this.hemi = new THREE.HemisphereLight(0xb8f0ff, 0x1a1430, 0.95);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.28);
    this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0x5ce1e6, 0.75);
    this.sun.position.set(-5, 7, 9);
    this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight(0x7c5cff, 0.28);
    this.fill.position.set(6, -3, 5);
    this.scene.add(this.fill);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.buildField();

    this._onResize = () => this.fit();
    window.addEventListener("resize", this._onResize, { passive: true });
  }

  mat(hex, em = 0) {
    return new THREE.MeshLambertMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: em,
      flatShading: true
    });
  }

  buildField() {
    const geos = [
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1, 0),
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.TorusGeometry(0.7, 0.2, 5, 8)
    ];
    const colors = [0x5ce1e6, 0x7c5cff, 0xf0b429, 0xd7e7ff, 0x34d399, 0xff6b9d];
    const n = this.lowFx ? 6 : 10;

    for (let i = 0; i < n; i++) {
      const geo = geos[i % geos.length];
      const mesh = new THREE.Mesh(geo, this.mat(colors[i % colors.length], i % 3 === 0 ? 0.18 : 0.06));
      const scale = 0.35 + (i % 5) * 0.12;
      mesh.scale.setScalar(scale);
      const a = (i / n) * Math.PI * 2;
      const r = 3.2 + (i % 4) * 0.7;
      mesh.position.set(Math.cos(a) * r, ((i % 5) - 2) * 0.55, Math.sin(a) * r * 0.55 - 1.2);
      mesh.rotation.set(i * 0.4, i * 0.7, i * 0.2);
      mesh.userData = {
        baseY: mesh.position.y,
        spin: 0.15 + (i % 4) * 0.05,
        bob: 0.2 + (i % 3) * 0.08,
        phase: i * 0.9
      };
      this.world.add(mesh);
      this.floats.push(mesh);
    }
  }

  fit() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  bind() {
    const bump = () => {
      this.lastActivity = performance.now();
      if (this.paused && !this.reducedMotion) {
        this.paused = false;
        this.startLoop();
      }
    };
    ["pointerdown", "touchstart", "keydown", "scroll"].forEach((ev) => {
      window.addEventListener(ev, bump, { passive: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stopLoop(true);
      else if (!this.reducedMotion) {
        this.paused = false;
        this.startLoop();
      }
    });
  }

  startLoop() {
    if (this.playing || this.reducedMotion) return;
    this.playing = true;
    this.paused = false;
    const tick = (now) => {
      if (!this.playing) return;
      if (now - this.lastActivity > IDLE_MS) {
        this.stopLoop(true);
        return;
      }
      const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
      this._last = now;
      this.time += dt;
      this.world.rotation.y = this.time * 0.08;
      for (const mesh of this.floats) {
        const u = mesh.userData;
        mesh.rotation.x += u.spin * dt;
        mesh.rotation.y += u.spin * 0.7 * dt;
        mesh.position.y = u.baseY + Math.sin(this.time * u.bob + u.phase) * 0.35;
      }
      this.camera.position.x = Math.sin(this.time * 0.12) * 0.35;
      this.camera.lookAt(0, 0, 0);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stopLoop(pause = false) {
    this.playing = false;
    this.paused = pause;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

export async function bootPortalBg3D() {
  const view3d = document.getElementById("view3d");
  const failEl = document.getElementById("webgl-fail");
  if (!view3d) {
    useFallback(null, failEl, null);
    return null;
  }
  try {
    const canvasTest = document.createElement("canvas");
    const gl =
      canvasTest.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      canvasTest.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!gl) throw new Error("no-webgl");

    const bg = new PortalBg(view3d);
    if (!bg.ok) throw new Error("three-init-failed");
    document.body.classList.add("renderer-webgl", "has-webgl-bg");
    document.body.classList.remove("renderer-canvas");
    window.PortalBG3D = bg;
    return bg;
  } catch (err) {
    console.warn("[portal-bg3d]", err);
    useFallback(view3d, failEl, FAIL_PT);
    return null;
  }
}

bootPortalBg3D();
