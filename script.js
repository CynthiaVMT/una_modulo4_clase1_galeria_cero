/**
 * GALERÍA CERO — SCRIPT v2.0
 * ─────────────────────────────────────────────────────
 * MEJORAS v2:
 *  - Home Acceso 2: Escultura 3D con materialidad mármol+metal, luces especulares
 *  - Sección 360: Monolito de cristal con reflejos prismáticos internos
 *  - Sección L&S: Pantalla completa immersiva, animación de entrada "vuelo" a la sala,
 *    piso de vidrio oscuro con partículas flotantes, pantallas laterales interactivas
 *    con partículas/ondas al tocar con el mouse, iluminación cenital reactiva
 * ─────────────────────────────────────────────────────
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ══════════════════════════════════════════════════════════════
     1. MOTOR DE AUDIO (Web Audio API + soporte archivo local)
     ══════════════════════════════════════════════════════════════ */
  class GalleryAudioEngine {
    constructor() {
      this.ctx = null; this.isPlaying = false;
      this.oscillators = []; this.gainNode = null;
      this.filterNode = null; this.isInitialized = false;
      this.customAudio = null; this.hasCustomAudio = false;
    }
    init() {
      if (this.isInitialized) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(450, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(4, this.ctx.currentTime);
        this.filterNode.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.customAudio = new Audio('assets/audio/ambient.mp3');
        this.customAudio.loop = true;
        this.customAudio.volume = 0.4;
        this.isInitialized = true;
      } catch (e) { console.warn('Web Audio API:', e); }
    }
    toggle() {
      this.init();
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.isPlaying) { this.stop(); return false; }
      else { this.start(); return true; }
    }
    start() {
      if (this.isPlaying) return;
      if (this.customAudio) {
        const p = this.customAudio.play();
        if (p !== undefined) {
          p.then(() => { this.hasCustomAudio = true; this.isPlaying = true; })
           .catch(() => { this.hasCustomAudio = false; this._startSynth(); });
          return;
        }
      }
      this._startSynth();
    }
    _startSynth() {
      if (!this.ctx) return;
      const freqs = [65.41, 98.00, 155.56, 233.08];
      this.oscillators = freqs.map((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);
        osc.detune.setValueAtTime((i - 1.5) * 4, this.ctx.currentTime);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18 / freqs.length, this.ctx.currentTime);
        osc.connect(g); g.connect(this.filterNode); osc.start();
        return osc;
      });
      this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 2);
      this.isPlaying = true;
    }
    stop() {
      if (!this.isPlaying) return;
      if (this.hasCustomAudio && this.customAudio) {
        this.customAudio.pause(); this.customAudio.currentTime = 0;
        this.isPlaying = false; return;
      }
      if (this.ctx && this.gainNode) {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);
        setTimeout(() => {
          this.oscillators.forEach(o => { try { o.stop(); o.disconnect(); } catch(e){} });
          this.oscillators = []; this.isPlaying = false;
        }, 1200);
      }
    }
    modulate(proximity) {
      if (this.hasCustomAudio && this.customAudio) {
        this.customAudio.volume = Math.max(0.1, Math.min(0.8, 1 - proximity * 0.4));
        return;
      }
      if (!this.ctx || !this.isPlaying || !this.filterNode) return;
      const freq = 250 + (1 - Math.min(1, Math.max(0, proximity))) * 1200;
      this.filterNode.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    }
    playGlintChime(freq = 528) {
      this.init();
      const c = new Audio('assets/audio/chime.mp3');
      c.play().catch(() => this._proceduralChime(freq));
    }
    _proceduralChime(freq) {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      g.gain.setValueAtTime(0.1, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5);
      osc.connect(g); g.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + 1.5);
    }
  }
  const galleryAudio = new GalleryAudioEngine();

  /* ══════════════════════════════════════════════════════════════
     2. NAVEGACIÓN, TOAST, MENÚ MÓVIL
     ══════════════════════════════════════════════════════════════ */
  const mainNavbar    = document.getElementById('mainNavbar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu       = document.getElementById('navMenu');
  const navLinks      = document.querySelectorAll('.nav-link');
  const globalToast   = document.getElementById('globalToast');
  const toastText     = document.getElementById('toastText');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel    = soundToggleBtn ? soundToggleBtn.querySelector('.sound-label') : null;
  let toastTimeout = null;

  function showToast(msg) {
    if (!globalToast || !toastText) return;
    toastText.textContent = msg;
    globalToast.classList.add('active');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => globalToast.classList.remove('active'), 3200);
  }

  function updateSoundUI(active) {
    if (!soundToggleBtn) return;
    soundToggleBtn.classList.toggle('playing', active);
    if (soundLabel) soundLabel.textContent = active ? 'AUDIO ON' : 'AUDIO OFF';
    showToast(active ? 'Paisaje sonoro activado' : 'Audio en silencio');
  }

  if (soundToggleBtn) soundToggleBtn.addEventListener('click', () => updateSoundUI(galleryAudio.toggle()));

  window.addEventListener('scroll', () => {
    mainNavbar.classList.toggle('scrolled', window.scrollY > 40);
    highlightSection();
  }, { passive: true });

  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', () => navMenu.classList.toggle('mobile-open'));
    navLinks.forEach(l => l.addEventListener('click', () => navMenu.classList.remove('mobile-open')));
  }

  const sections = document.querySelectorAll('section[id]');
  function highlightSection() {
    const sp = window.scrollY + 200;
    sections.forEach(s => {
      if (sp >= s.offsetTop && sp < s.offsetTop + s.offsetHeight)
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.nav === s.id));
    });
  }

  /* ══════════════════════════════════════════════════════════════
     3. HOME: CARRUSEL SLIDER 3D VERTICAL (ACCESO 1 - RUEDA 3D)
     ══════════════════════════════════════════════════════════════ */
  const homeSlides       = document.querySelectorAll('.home-slide');
  const homeCarouselMod  = document.getElementById('homeDirectCarousel');
  let curHomeSlide = 0, homeTimer = null, isHomeTransitioning = false;

  function showHomeSlide(nextIdx) {
    if (!homeSlides.length || isHomeTransitioning) return;
    nextIdx = ((nextIdx % homeSlides.length) + homeSlides.length) % homeSlides.length;
    if (nextIdx === curHomeSlide && homeSlides[curHomeSlide].classList.contains('active')) return;

    isHomeTransitioning = true;
    const currentSlide = homeSlides[curHomeSlide];
    const nextSlide = homeSlides[nextIdx];

    // Limpiar clases de slides inactivas para dejarlas en posición de espera superior
    homeSlides.forEach((s, idx) => {
      if (idx !== curHomeSlide && idx !== nextIdx) {
        s.className = 'home-slide';
      }
    });

    // La foto de frente se oculta hacia abajo y hacia atrás como en una rueda
    if (currentSlide && currentSlide !== nextSlide) {
      currentSlide.className = 'home-slide exit-down';
    }

    // La siguiente se incorpora al centro desde arriba y hacia abajo
    nextSlide.className = 'home-slide active';
    curHomeSlide = nextIdx;

    setTimeout(() => {
      homeSlides.forEach((s, idx) => {
        if (idx !== curHomeSlide) {
          s.className = 'home-slide';
        }
      });
      isHomeTransitioning = false;
    }, 1200);
  }

  function startHomeAuto() {
    clearInterval(homeTimer);
    if (homeSlides.length > 1) {
      homeTimer = setInterval(() => {
        showHomeSlide(curHomeSlide + 1);
      }, 4200);
    }
  }

  if (homeCarouselMod) {
    homeCarouselMod.addEventListener('mouseenter', () => clearInterval(homeTimer));
    homeCarouselMod.addEventListener('mouseleave', startHomeAuto);

    // Permitir interacción por toque/swipe vertical
    let startY = 0;
    homeCarouselMod.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    homeCarouselMod.addEventListener('touchend', (e) => {
      const diffY = e.changedTouches[0].clientY - startY;
      if (Math.abs(diffY) > 40) {
        if (diffY < 0) showHomeSlide(curHomeSlide + 1);
        else showHomeSlide(curHomeSlide - 1);
        startHomeAuto();
      }
    }, { passive: true });

    // Clic en la tarjeta avanza suavemente a la siguiente obra
    homeCarouselMod.addEventListener('click', (e) => {
      if (!e.target.closest('a')) {
        showHomeSlide(curHomeSlide + 1);
        startHomeAuto();
      }
    });
  }

  // Inicializar estado del primer slide
  if (homeSlides.length) {
    homeSlides.forEach((s, idx) => {
      s.className = idx === 0 ? 'home-slide active' : 'home-slide';
    });
  }
  startHomeAuto();

  /* ══════════════════════════════════════════════════════════════
     4. HOME ACCESO 2: ESCULTURA 3D CON MATERIALIDAD MÁRMOL + METAL
     ══════════════════════════════════════════════════════════════ */
  const homeCanvas = document.getElementById('homeSculptureCanvas');
  if (homeCanvas) {
    const ctx = homeCanvas.getContext('2d');
    let hAngle = 0, hDrag = false, hLastX = 0;

    // Paleta de materialidad: mármol blanco + acero oscuro
    function drawHomeSculptureMaterial() {
      const W = homeCanvas.width, H = homeCanvas.height;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 - 10;

      const t = performance.now() * 0.001;
      const cosA = Math.cos(hAngle), sinA = Math.sin(hAngle);
      const s = 120; // escala base

      // Definir cara de una columna con torsión vertical (mármol)
      // Vértices de un bloque prismático en el espacio 3D local
      const verts3D = [
        // base inferior (mármol)
        { x: -s*0.55*cosA, y:  s*1.5, z: -s*0.55*sinA },
        { x:  s*0.55*cosA, y:  s*1.5, z:  s*0.55*sinA },
        { x:  s*0.65*cosA, y:  s*0.4, z:  s*0.65*sinA },
        { x: -s*0.65*cosA, y:  s*0.4, z: -s*0.65*sinA },
        // transición a metal (zona central)
        { x: -s*0.45*cosA, y:  s*0.0, z: -s*0.45*sinA },
        { x:  s*0.45*cosA, y:  s*0.0, z:  s*0.45*sinA },
        { x:  s*0.52*cosA, y: -s*0.8, z:  s*0.52*sinA },
        { x: -s*0.52*cosA, y: -s*0.8, z: -s*0.52*sinA },
        // cima piramidal (metal pulido)
        { x:  0,           y: -s*1.7, z:  0 }
      ];

      // Proyección 3D → 2D con perspectiva suave
      const fov = 480;
      const proj = verts3D.map(v => {
        const x1 = v.x; const y1 = v.y;
        const z1 = v.z + 300;
        const sc = fov / z1;
        return { px: cx + x1 * sc, py: cy + y1 * sc, depth: z1, sc };
      });

      // Definir caras con su material y vector de luz
      const lightDir = { x: sinA * 0.7 + 0.3, y: -0.8 };
      const faces = [
        // Mármol (base) — más claro con venas
        { pts: [0,1,2,3],     zone: 'marble', baseL: 0.75 + sinA * 0.2 },
        // Zona de transición mármol→metal
        { pts: [3,2,6,7],     zone: 'transition', baseL: 0.5 + cosA * 0.3 },
        { pts: [2,5,6],       zone: 'transition', baseL: 0.55 - cosA * 0.2 },
        // Metal (zona alta) — con reflejo especular
        { pts: [4,5,6,7],     zone: 'metal', baseL: 0.35 + sinA * 0.4 },
        { pts: [0,4,7,3],     zone: 'metal', baseL: 0.6 - sinA * 0.35 },
        { pts: [1,5,4,0],     zone: 'metal', baseL: 0.4 + cosA * 0.35 },
        // Cima piramidal metálica — alta reflectividad
        { pts: [4,5,8],       zone: 'apex', baseL: 0.9 - sinA * 0.5 },
        { pts: [5,6,8],       zone: 'apex', baseL: 0.6 + cosA * 0.4 },
        { pts: [6,7,8],       zone: 'apex', baseL: 0.4 + sinA * 0.6 },
        { pts: [7,4,8],       zone: 'apex', baseL: 0.75 - cosA * 0.4 },
      ];

      // Ordenar por profundidad media
      faces.forEach(f => {
        f.avgDepth = f.pts.reduce((acc, i) => acc + (proj[i] ? proj[i].depth : 0), 0) / f.pts.length;
      });
      faces.sort((a, b) => b.avgDepth - a.avgDepth);

      faces.forEach(f => {
        const pts = f.pts.map(i => proj[i]).filter(Boolean);
        if (pts.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(pts[0].px, pts[0].py);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py);
        ctx.closePath();

        const l = Math.min(1, Math.max(0.05, f.baseL));

        if (f.zone === 'marble') {
          // Mármol: blanco con gradiente y venas sutiles
          const g = ctx.createLinearGradient(pts[0].px, pts[0].py, pts[2]?.px ?? pts[0].px, pts[2]?.py ?? pts[0].py);
          const b1 = Math.floor(230 * l), b2 = Math.floor(180 * l);
          g.addColorStop(0, `rgb(${b1},${b1},${b1})`);
          g.addColorStop(0.45, `rgb(${b2},${b2},${b2})`);
          g.addColorStop(1, `rgb(${b1},${b1},${b1})`);
          ctx.fillStyle = g;
          ctx.fill();
          // Venas de mármol
          ctx.strokeStyle = `rgba(255,255,255,${0.12 * l})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (f.zone === 'transition') {
          const v = Math.floor(140 * l);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,0.2)`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        } else if (f.zone === 'metal') {
          // Metal: oscuro con reflejo especular brillante
          const dark = Math.floor(60 * l);
          const light = Math.floor(200 * l);
          const g = ctx.createLinearGradient(pts[0].px, pts[0].py, pts[1]?.px ?? pts[0].px, pts[1]?.py ?? pts[0].py);
          g.addColorStop(0, `rgb(${dark},${dark},${dark})`);
          g.addColorStop(0.3 + sinA * 0.2, `rgb(${light},${light},${light})`);
          g.addColorStop(1, `rgb(${Math.floor(dark*0.7)},${Math.floor(dark*0.7)},${Math.floor(dark*0.7)})`);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${0.5 * l})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Cima apex: reflejo especular puro (blanco brillante animado)
          const specular = Math.max(0, Math.min(1, f.baseL + Math.sin(t * 2) * 0.2));
          const sv = Math.floor(255 * specular);
          ctx.fillStyle = `rgb(${sv},${sv},${sv})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,0.8)`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });

      // Reflejo de la escultura en el suelo (mármol)
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.scale(1, -0.35);
      ctx.translate(0, -(cy + s * 1.6) * 2 / 0.35);
      faces.slice(-4).forEach(f => {
        const pts = f.pts.map(i => proj[i]).filter(Boolean);
        if (pts.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].px, pts[0].py);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py);
        ctx.closePath();
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fill();
      });
      ctx.restore();

      // Anillo orbital
      ctx.save();
      ctx.translate(cx, cy + s * 1.55);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.35, s * 0.28, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.08 * Math.sin(t)})`;
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (!hDrag) hAngle += 0.012;
      requestAnimationFrame(drawHomeSculptureMaterial);
    }
    drawHomeSculptureMaterial();

    homeCanvas.addEventListener('mousedown', e => { hDrag = true; hLastX = e.clientX; homeCanvas.style.cursor = 'grabbing'; });
    window.addEventListener('mouseup', () => { hDrag = false; homeCanvas.style.cursor = 'grab'; });
    window.addEventListener('mousemove', e => { if (!hDrag) return; hAngle += (e.clientX - hLastX) * 0.013; hLastX = e.clientX; });
    homeCanvas.addEventListener('touchstart', e => { if (e.touches.length === 1) { hDrag = true; hLastX = e.touches[0].clientX; } }, { passive: true });
    window.addEventListener('touchmove', e => { if (!hDrag || e.touches.length !== 1) return; hAngle += (e.touches[0].clientX - hLastX) * 0.013; hLastX = e.touches[0].clientX; }, { passive: true });
    window.addEventListener('touchend', () => hDrag = false);
  }

  /* ══════════════════════════════════════════════════════════════
     5. HOME ACCESO 3: OBRA INTERACTIVA CON DESTELLO Y PARTÍCULAS
     ══════════════════════════════════════════════════════════════ */
  const glowWrapper   = document.getElementById('glowCardWrapper');
  const subtleFlare   = document.getElementById('subtleFlare');
  const intCanvas     = document.getElementById('interactiveCanvasOverlay');
  const previewTone   = document.getElementById('previewToneBtn');
  let intActive = false;

  if (glowWrapper && subtleFlare) {
    glowWrapper.addEventListener('mousemove', e => {
      const r = glowWrapper.getBoundingClientRect();
      subtleFlare.style.setProperty('--glow-x', `${((e.clientX - r.left) / r.width) * 100}%`);
      subtleFlare.style.setProperty('--glow-y', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    glowWrapper.addEventListener('mouseenter', () => startInteractiveField());
    glowWrapper.addEventListener('mouseleave', () => stopInteractiveField());
  }

  function startInteractiveField() {
    if (intActive || !intCanvas) return;
    intActive = true;
    intCanvas.width = intCanvas.parentElement.clientWidth;
    intCanvas.height = intCanvas.parentElement.clientHeight;
    const ctx = intCanvas.getContext('2d');
    const particles = Array.from({ length: 32 }, () => ({
      x: Math.random() * intCanvas.width, y: Math.random() * intCanvas.height,
      vx: (Math.random() - 0.5) * 1.4, vy: (Math.random() - 0.5) * 1.4,
      r: Math.random() * 2 + 1, a: Math.random() * 0.7 + 0.3
    }));
    (function loop() {
      if (!intActive) { ctx.clearRect(0, 0, intCanvas.width, intCanvas.height); return; }
      ctx.clearRect(0, 0, intCanvas.width, intCanvas.height);
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 95) { ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - d / 95)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        });
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > intCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > intCanvas.height) p.vy *= -1;
        ctx.fillStyle = `rgba(255,255,255,${p.a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(loop);
    })();
  }
  function stopInteractiveField() { intActive = false; }
  if (previewTone) previewTone.addEventListener('click', e => { e.stopPropagation(); galleryAudio.playGlintChime(440); showToast('Frecuencia: 440 Hz'); });

  /* ══════════════════════════════════════════════════════════════
     6. SECCIÓN PICS: CARRUSEL DINÁMICO
     ══════════════════════════════════════════════════════════════ */
  const picsTrack    = document.getElementById('picsTrack');
  const picsItems    = document.querySelectorAll('.carousel-item');
  const picsPrevBtn  = document.getElementById('picsPrevBtn');
  const picsNextBtn  = document.getElementById('picsNextBtn');
  const picsProgress = document.getElementById('picsProgressBar');
  const picsThumbStrip = document.getElementById('picsThumbStrip');
  const picsAutoplayBtn = document.getElementById('picsAutoplayBtn');
  const filterTabs   = document.querySelectorAll('.filter-tab');
  let curPics = 0, picsAutoplay = true, picsTimer = null;
  let visiblePics = Array.from(picsItems);

  function initThumbs() {
    if (!picsThumbStrip) return;
    picsThumbStrip.innerHTML = '';
    visiblePics.forEach((item, i) => {
      const img = item.querySelector('img');
      const t = document.createElement('div');
      t.className = `thumb-item ${i === curPics ? 'active' : ''}`;
      t.innerHTML = `<img src="${img.src}" alt="">`;
      t.addEventListener('click', () => { goToPics(i); resetAuto(); });
      picsThumbStrip.appendChild(t);
    });
  }
  function updatePicsUI() {
    if (!visiblePics.length || !picsTrack) return;
    if (picsProgress) picsProgress.style.width = `${((curPics + 1) / visiblePics.length) * 100}%`;
    const cur = document.getElementById('picsCurrentDisplay'), tot = document.getElementById('picsTotalDisplay');
    if (cur) cur.textContent = String(curPics + 1).padStart(2, '0');
    if (tot) tot.textContent = String(visiblePics.length).padStart(2, '0');
    picsTrack.style.transform = `translateX(-${curPics * 100}%)`;
    document.querySelectorAll('.thumb-item').forEach((t, i) => t.classList.toggle('active', i === curPics));
  }
  function goToPics(i) { curPics = ((i % visiblePics.length) + visiblePics.length) % visiblePics.length; updatePicsUI(); }
  function resetAuto() { clearInterval(picsTimer); if (picsAutoplay && visiblePics.length > 1) picsTimer = setInterval(() => goToPics(curPics + 1), 5000); }

  if (picsNextBtn) picsNextBtn.addEventListener('click', () => { goToPics(curPics + 1); resetAuto(); });
  if (picsPrevBtn) picsPrevBtn.addEventListener('click', () => { goToPics(curPics - 1); resetAuto(); });
  if (picsAutoplayBtn) picsAutoplayBtn.addEventListener('click', () => {
    picsAutoplay = !picsAutoplay;
    picsAutoplayBtn.classList.toggle('active', picsAutoplay);
    const sym = picsAutoplayBtn.querySelector('.status-symbol');
    if (sym) sym.textContent = picsAutoplay ? '❚❚' : '▶';
    resetAuto();
  });
  filterTabs.forEach(tab => tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const f = tab.dataset.filter;
    picsItems.forEach(item => item.style.display = (f === 'all' || item.dataset.category === f) ? 'block' : 'none');
    visiblePics = Array.from(picsItems).filter(item => item.style.display !== 'none');
    curPics = 0; initThumbs(); updatePicsUI(); resetAuto();
  }));
  initThumbs(); updatePicsUI(); resetAuto();

  /* ══════════════════════════════════════════════════════════════
     7. LIGHTBOX MODAL
     ══════════════════════════════════════════════════════════════ */
  const lightbox   = document.getElementById('lightboxModal');
  const lbBackdrop = document.getElementById('lightboxBackdrop');
  const lbClose    = document.getElementById('lightboxCloseBtn');
  const lbImg      = document.getElementById('lightboxImg');

  function openLightbox(item) {
    if (!lightbox || !item) return;
    const img = item.querySelector('img');
    if (lbImg) lbImg.src = img.src;
    ['lightboxTitle','lightboxArtist','lightboxCategory','lightboxYear','lightboxCamera'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const map = { lightboxTitle: 'data-title', lightboxArtist: 'data-artist', lightboxCategory: 'data-category', lightboxYear: 'data-year', lightboxCamera: 'data-camera' };
      el.textContent = item.getAttribute(map[id]) || '';
    });
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { if (!lightbox) return; lightbox.classList.remove('active'); document.body.style.overflow = ''; }

  picsItems.forEach((item, i) => {
    const btn = item.querySelector('.btn-inspect');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); curPics = i; openLightbox(item); });
    const card = item.querySelector('.carousel-card');
    if (card) card.addEventListener('click', () => { curPics = i; openLightbox(item); });
  });
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbBackdrop) lbBackdrop.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
    if (lightbox?.classList.contains('active')) {
      if (e.key === 'ArrowRight') { goToPics(curPics + 1); openLightbox(visiblePics[curPics]); }
      if (e.key === 'ArrowLeft')  { goToPics(curPics - 1); openLightbox(visiblePics[curPics]); }
    }
  });
  const lbPrev = document.getElementById('lightboxPrevBtn'), lbNext = document.getElementById('lightboxNextBtn');
  if (lbPrev) lbPrev.addEventListener('click', () => { goToPics(curPics - 1); openLightbox(visiblePics[curPics]); });
  if (lbNext) lbNext.addEventListener('click', () => { goToPics(curPics + 1); openLightbox(visiblePics[curPics]); });

  /* ══════════════════════════════════════════════════════════════
     8. SECCIÓN 360°: MONOLITO DE CRISTAL CON REFLEJOS PRISMÁTICOS
     ══════════════════════════════════════════════════════════════ */
  const canvas360    = document.getElementById('canvas360');
  const angleDegree  = document.getElementById('angleDegree');
  const sculptureTabs = document.querySelectorAll('.sculpture-tab-btn');
  const sculptureNameLabel = document.getElementById('sculptureNameLabel');
  const toggle360AutoBtn   = document.getElementById('toggle360AutoBtn');
  const autoRotateIcon     = document.getElementById('autoRotateIcon');
  const reset360Btn        = document.getElementById('reset360Btn');
  const speedSlider        = document.getElementById('speedSlider');
  const wireframeToggleBtn = document.getElementById('wireframeToggleBtn');

  if (canvas360) {
    const ctx = canvas360.getContext('2d');
    let cModel = 'monolith', angleY = 0, angleX = 0.18;
    let autoRot = true, rotSpd = 1, wireframe = false;
    let drag360 = false, s360X = 0, s360Y = 0, vel360 = 0;

    // ── Geometrías ──────────────────────────────────────────────
    function getGeom(type) {
      if (type === 'prism') {
        const H = 180, R = 90, L = 6;
        const verts = [], edges = [];
        for (let i = 0; i <= L; i++) {
          const y = -H/2 + (i/L)*H, twist = (i/L)*Math.PI;
          const r = R * (1 - 0.25 * Math.sin((i/L)*Math.PI));
          for (let j = 0; j < 4; j++) { const th = twist + j*Math.PI/2; verts.push({ x: r*Math.cos(th), y, z: r*Math.sin(th) }); }
        }
        for (let i = 0; i < L; i++) {
          const b = i*4, n = (i+1)*4;
          for (let j = 0; j < 4; j++) { const jn = (j+1)%4; edges.push([b+j,b+jn],[b+j,n+j],[b+j,n+jn]); }
        }
        return { verts, edges, faces: null, material: 'metal' };
      }
      if (type === 'sphere') {
        const t2 = (1+Math.sqrt(5))/2, R = 100;
        const rawV = [[-1,t2,0],[1,t2,0],[-1,-t2,0],[1,-t2,0],[0,-1,t2],[0,1,t2],[0,-1,-t2],[0,1,-t2],[t2,0,-1],[t2,0,1],[-t2,0,-1],[-t2,0,1]];
        const verts = rawV.map(p => { const len=Math.hypot(...p); return {x:(p[0]/len)*R,y:(p[1]/len)*R,z:(p[2]/len)*R}; });
        const edges = [[0,11],[0,5],[0,1],[0,7],[0,10],[1,5],[5,11],[11,10],[10,7],[7,1],[3,9],[3,4],[3,2],[3,6],[3,8],[4,9],[9,8],[8,6],[6,2],[2,4],[5,9],[5,4],[11,4],[11,2],[10,2],[10,6],[7,6],[7,8],[1,8],[1,9]];
        return { verts, edges, faces: null, material: 'marble' };
      }
      // MONOLITO DE CRISTAL — geometría de prisma hexagonal afilado
      const s = 95;
      const verts = [
        // BASE HEXAGONAL (6 puntos)
        { x:  s*0.5,  y:  s*1.6,  z:  0        },
        { x:  s*0.25, y:  s*1.6,  z:  s*0.43   },
        { x: -s*0.25, y:  s*1.6,  z:  s*0.43   },
        { x: -s*0.5,  y:  s*1.6,  z:  0        },
        { x: -s*0.25, y:  s*1.6,  z: -s*0.43   },
        { x:  s*0.25, y:  s*1.6,  z: -s*0.43   },
        // CINTURA MEDIA más estrecha
        { x:  s*0.35, y:  0,      z:  0        },
        { x:  s*0.175,y:  0,      z:  s*0.3    },
        { x: -s*0.175,y:  0,      z:  s*0.3    },
        { x: -s*0.35, y:  0,      z:  0        },
        { x: -s*0.175,y:  0,      z: -s*0.3    },
        { x:  s*0.175,y:  0,      z: -s*0.3    },
        // CÚSPIDE
        { x:  0,      y: -s*1.75, z:  0        }
      ];
      const faces = [
        // Caras laterales hexagonales base → cintura
        [0,1,7,6], [1,2,8,7], [2,3,9,8], [3,4,10,9], [4,5,11,10], [5,0,6,11],
        // Caras laterales cintura → cúspide
        [6,7,12], [7,8,12], [8,9,12], [9,10,12], [10,11,12], [11,6,12],
        // Tapa base (hexágono)
        [0,1,2,3,4,5]
      ];
      const edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[6,7],[7,8],[8,9],[9,10],[10,11],[11,6],[0,6],[1,7],[2,8],[3,9],[4,10],[5,11],[6,12],[7,12],[8,12],[9,12],[10,12],[11,12]];
      return { verts, edges, faces, material: 'crystal' };
    }

    // ── Renderer 360 ─────────────────────────────────────────────
    function render360() {
      const W = canvas360.width, H = canvas360.height;
      ctx.clearRect(0, 0, W, H);
      const cx = W/2, cy = H/2 - 10;
      const geom = getGeom(cModel);
      const t = performance.now() * 0.001;
      const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX);

      // Proyectar vértices
      const proj = geom.verts.map(v => {
        const x1 = v.x*cosY + v.z*sinY, z1 = -v.x*sinY + v.z*cosY;
        const y2 = v.y*cosX - z1*sinX,  z2 = v.y*sinX + z1*cosX;
        if (z2 <= -240) return null;
        const sc = 500 / (z2 + 260);
        return { x: cx + x1*sc, y: cy + y2*sc, z: z2, sc };
      });

      if (geom.faces && !wireframe) {
        // Painter's algorithm con materialidad de cristal
        const sorted = geom.faces.map(idxs => {
          const pts = idxs.map(i => proj[i]).filter(Boolean);
          if (pts.length < 3) return null;
          const avgZ = pts.reduce((a, p) => a + p.z, 0) / pts.length;
          const p0 = pts[0], p1 = pts[1], p2 = pts[2];
          const normal = (p1.x-p0.x)*(p2.y-p0.y) - (p1.y-p0.y)*(p2.x-p0.x);
          return { pts, avgZ, normal, idxs };
        }).filter(Boolean).sort((a, b) => b.avgZ - a.avgZ);

        sorted.forEach(face => {
          ctx.beginPath();
          ctx.moveTo(face.pts[0].x, face.pts[0].y);
          for (let i = 1; i < face.pts.length; i++) ctx.lineTo(face.pts[i].x, face.pts[i].y);
          ctx.closePath();

          if (geom.material === 'crystal') {
            // CRISTAL: capas de reflejos internos prismáticos
            const depthFactor = Math.min(1, Math.max(0, (face.avgZ + 200) / 400));
            const refractShift = Math.sin(angleY * 2 + t) * 0.3;
            const n = face.normal;

            if (n > 0) {
              // Cara frontal: transparencia con reflejo de luz
              const lightAngle = Math.sin(angleY + Math.PI / 4);
              const specular = Math.max(0, lightAngle);
              const baseAlpha = 0.25 + depthFactor * 0.35;
              const refractR = Math.floor(180 * (0.5 + refractShift * 0.5));
              const refractG = Math.floor(200 * (0.6 + refractShift * 0.3));
              const refractB = Math.floor(240 * (0.8 - refractShift * 0.2));

              // Gradiente prismático (verde-azul-blanco según ángulo de refracción)
              const gx = ctx.createLinearGradient(face.pts[0].x, face.pts[0].y, face.pts[face.pts.length-1].x, face.pts[face.pts.length-1].y);
              gx.addColorStop(0,   `rgba(${refractR},${refractG},${refractB},${baseAlpha})`);
              gx.addColorStop(0.4 + refractShift*0.2, `rgba(255,255,255,${baseAlpha * 0.9 + specular * 0.6})`);
              gx.addColorStop(1,   `rgba(${refractR*0.6},${refractG*0.7},${refractB},${baseAlpha * 0.6})`);
              ctx.fillStyle = gx;
              ctx.fill();

              // Arista brillante de cristal
              ctx.strokeStyle = `rgba(255,255,255,${0.6 + specular * 0.4})`;
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Rayo interno de luz refractada (caustica)
              if (specular > 0.5) {
                const rayX = (face.pts[0].x + face.pts[face.pts.length-1].x) / 2;
                const rayY = (face.pts[0].y + face.pts[face.pts.length-1].y) / 2;
                const rayGrad = ctx.createRadialGradient(rayX, rayY, 0, rayX, rayY, 60 * face.pts[0].sc);
                rayGrad.addColorStop(0, `rgba(255,255,255,${(specular - 0.5) * 0.8})`);
                rayGrad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = rayGrad;
                ctx.fill();
              }
            } else {
              // Cara trasera: muy oscura semitransparente (profundidad del cristal)
              ctx.fillStyle = `rgba(10,10,20,${0.4 + depthFactor * 0.3})`;
              ctx.fill();
              ctx.strokeStyle = 'rgba(150,180,255,0.15)';
              ctx.lineWidth = 0.7;
              ctx.stroke();
            }

          } else if (geom.material === 'marble') {
            const l = Math.max(0.15, Math.min(0.9, (face.normal * 0.003 + 0.55)));
            const v = Math.floor(l * 220);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          } else {
            const l = Math.max(0.1, Math.min(0.95, (face.normal * 0.002 + 0.5)));
            const dark = Math.floor(l * 60), bright = Math.floor(l * 220);
            const g = ctx.createLinearGradient(face.pts[0].x, face.pts[0].y, face.pts[1]?.x ?? face.pts[0].x, face.pts[1]?.y ?? face.pts[0].y);
            g.addColorStop(0, `rgb(${dark},${dark},${dark})`);
            g.addColorStop(0.5, `rgb(${bright},${bright},${bright})`);
            g.addColorStop(1, `rgb(${dark},${dark},${dark})`);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.4 * l})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        });

        // Destellos de caustica en el piso (solo para cristal)
        if (geom.material === 'crystal') {
          const causticY = cy + 170;
          for (let i = 0; i < 5; i++) {
            const cx2 = cx + Math.sin(angleY + i * 1.3) * 80;
            const size = 20 + Math.sin(t * 1.5 + i) * 8;
            const cg = ctx.createRadialGradient(cx2, causticY, 0, cx2, causticY, size);
            cg.addColorStop(0, `rgba(200,220,255,${0.18 + Math.sin(t + i) * 0.08})`);
            cg.addColorStop(1, 'rgba(200,220,255,0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.ellipse(cx2, causticY, size, size * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

      } else {
        // MODO WIREFRAME
        ctx.strokeStyle = geom.material === 'crystal' ? 'rgba(180,220,255,0.85)' : 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.2;
        geom.edges.forEach(([a, b]) => {
          const p1 = proj[a], p2 = proj[b];
          if (!p1 || !p2) return;
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        });
        proj.forEach(p => { if (!p) return; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2*p.sc, 0, Math.PI*2); ctx.fill(); });
      }

      // HUD de ángulo
      if (angleDegree) angleDegree.textContent = `${Math.round(((angleY%(Math.PI*2)+Math.PI*2)%(Math.PI*2))*(180/Math.PI))}°`;

      // Física de rotación
      if (autoRot && !drag360) angleY += 0.008 * rotSpd;
      else if (!drag360 && Math.abs(vel360) > 0.0001) { angleY += vel360; vel360 *= 0.93; }
      requestAnimationFrame(render360);
    }
    render360();

    // Eventos drag
    canvas360.addEventListener('mousedown', e => { drag360 = true; s360X = e.clientX; s360Y = e.clientY; vel360 = 0; });
    window.addEventListener('mouseup', () => drag360 = false);
    window.addEventListener('mousemove', e => {
      if (!drag360) return;
      const dx = e.clientX - s360X, dy = e.clientY - s360Y;
      s360X = e.clientX; s360Y = e.clientY;
      vel360 = dx * 0.008; angleY += vel360;
      angleX = Math.max(-0.45, Math.min(0.45, angleX + dy * 0.004));
    });
    canvas360.addEventListener('touchstart', e => { if (e.touches.length===1){ drag360=true; s360X=e.touches[0].clientX; s360Y=e.touches[0].clientY; vel360=0; }}, { passive:true });
    window.addEventListener('touchmove', e => { if(!drag360||e.touches.length!==1)return; const dx=e.touches[0].clientX-s360X,dy=e.touches[0].clientY-s360Y; s360X=e.touches[0].clientX; s360Y=e.touches[0].clientY; vel360=dx*0.008; angleY+=vel360; angleX=Math.max(-0.45,Math.min(0.45,angleX+dy*0.004)); }, {passive:true});
    window.addEventListener('touchend', () => drag360 = false);

    if (toggle360AutoBtn) toggle360AutoBtn.addEventListener('click', () => { autoRot = !autoRot; toggle360AutoBtn.classList.toggle('active', autoRot); if(autoRotateIcon) autoRotateIcon.textContent = autoRot ? '❚❚' : '▶'; showToast(autoRot ? 'Auto-rotación activada' : 'Control manual'); });
    if (reset360Btn) reset360Btn.addEventListener('click', () => { angleY=0; angleX=0.18; vel360=0; showToast('Vista reiniciada'); });
    if (speedSlider) speedSlider.addEventListener('input', e => rotSpd = parseFloat(e.target.value));
    if (wireframeToggleBtn) wireframeToggleBtn.addEventListener('click', () => { wireframe = !wireframe; wireframeToggleBtn.classList.toggle('active', wireframe); showToast(wireframe ? 'Modo wireframe' : 'Modo sólido'); });
    sculptureTabs.forEach(tab => tab.addEventListener('click', () => {
      sculptureTabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
      cModel = tab.dataset.sculpture;
      if (sculptureNameLabel) sculptureNameLabel.textContent = { monolith:'MONOLITO CRISTAL // 2026', prism:'PRISMA FRACTAL // 2025', sphere:'ESFERA GEODÉSICA // 2024' }[cModel];
      showToast(`Escultura: ${tab.textContent.trim()}`);
    }));
  }

  /* ══════════════════════════════════════════════════════════════
     9. SECCIÓN L&S: SALA ELÁSTICA V2.0 (THREE.JS + FÍSICA DE MEMBRANA)
        - Suelo y 4 paredes con simulación de ondas elásticas en tiempo real
        - Bolas de luz arrojables con rebote cinético e inyección de impulso
        - Recorridos de luz (trails) acoplados a la tensión de la sala
        - Esferas de techo reflectantes con CubeCamera en tiempo real
        - Sintetizador espacial reactivo a la tensión elástica
     ══════════════════════════════════════════════════════════════ */

  (function initElasticRoomLS() {
    const container = document.getElementById('lsThreeContainer');
    const viewport = document.getElementById('galleryViewport');
    const lsSection = document.getElementById('ls');
    if (!container || typeof THREE === 'undefined') return;

    // --- Audio Engine para Sala Elástica ---
    class LSSoundEngine {
      constructor() {
        this.ctx = null;
        this.enabled = true;
        this.initialized = false;
        this.droneGain = null;
        this.droneFilter = null;
        this.scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
      }
      init() {
        if (this.initialized) return;
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioContext();
          
          const osc1 = this.ctx.createOscillator();
          osc1.type = 'sine';
          osc1.frequency.value = 55;

          const osc2 = this.ctx.createOscillator();
          osc2.type = 'triangle';
          osc2.frequency.value = 110.5;

          this.droneFilter = this.ctx.createBiquadFilter();
          this.droneFilter.type = 'lowpass';
          this.droneFilter.frequency.value = 140;

          this.droneGain = this.ctx.createGain();
          this.droneGain.gain.value = 0.0001;

          osc1.connect(this.droneFilter);
          osc2.connect(this.droneFilter);
          this.droneFilter.connect(this.droneGain);
          this.droneGain.connect(this.ctx.destination);

          osc1.start();
          osc2.start();
          this.initialized = true;
        } catch (e) { console.warn('LSSoundEngine:', e); }
      }
      resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      }
      updateTension(tension) {
        if (!this.ctx || !this.initialized || !this.enabled) return;
        const now = this.ctx.currentTime;
        const t = Math.min(Math.max(tension, 0), 1);
        if (this.droneGain) {
          const targetGain = t > 0.02 ? 0.015 + t * 0.1 : 0.0001;
          this.droneGain.gain.setTargetAtTime(targetGain, now, 0.1);
        }
        if (this.droneFilter) {
          this.droneFilter.frequency.setTargetAtTime(140 + t * 650, now, 0.1);
        }
      }
      playBounce(strength = 1.0, isWall = false) {
        if (!this.ctx || !this.initialized || !this.enabled) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const note = this.scale[Math.floor(Math.random() * (this.scale.length - 2))];
        osc.type = isWall ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(note, now);
        osc.frequency.exponentialRampToValueAtTime(note * 0.94, now + 0.3);
        const amp = Math.min(Math.max(strength * 0.14, 0.02), 0.18);
        gain.gain.setValueAtTime(amp, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (isWall ? 0.25 : 0.5));
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      }
      playLaunch() {
        if (!this.ctx || !this.initialized || !this.enabled) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.22);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
      toggle() {
        this.init();
        this.enabled = !this.enabled;
        if (!this.enabled && this.droneGain) {
          this.droneGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        }
        return this.enabled;
      }
    }
    const lsAudio = new LSSoundEngine();

    // --- Física de Malla Elástica (Suelo) ---
    class LSElasticFloor {
      constructor(size = 28, res = 60) {
        this.size = size;
        this.res = res;
        this.numVertices = (res + 1) * (res + 1);
        this.current = new Float32Array(this.numVertices);
        this.previous = new Float32Array(this.numVertices);
        this.velocity = new Float32Array(this.numVertices);
        this.c2 = 0.28;
        this.damping = 0.982;
        this.tension = 0.0;

        this.geometry = new THREE.PlaneGeometry(size, size, res, res);
        this.geometry.rotateX(-Math.PI / 2);

        const colors = new Float32Array(this.numVertices * 3);
        for (let i = 0; i < this.numVertices * 3; i += 3) {
          colors[i] = 0.02; colors[i + 1] = 0.06; colors[i + 2] = 0.14;
        }
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        this.material = new THREE.MeshStandardMaterial({
          color: 0x050814,
          vertexColors: true,
          roughness: 0.4,
          metalness: 0.8
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);

        const wireGeo = new THREE.PlaneGeometry(size, size, Math.floor(res / 2), Math.floor(res / 2));
        wireGeo.rotateX(-Math.PI / 2);
        this.wireMaterial = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          wireframe: true,
          transparent: true,
          opacity: 0.14,
          blending: THREE.AdditiveBlending
        });
        this.wireMesh = new THREE.Mesh(wireGeo, this.wireMaterial);
        this.wireMesh.position.y = 0.02;
        this.mesh.add(this.wireMesh);
      }

      disturb(x, z, strength = 1.0, radius = 1.8) {
        const half = this.size / 2;
        const gx = ((x + half) / this.size) * this.res;
        const gz = ((z + half) / this.size) * this.res;
        const rCells = Math.ceil((radius / this.size) * this.res);
        const minX = Math.max(0, Math.floor(gx - rCells));
        const maxX = Math.min(this.res, Math.ceil(gx + rCells));
        const minZ = Math.max(0, Math.floor(gz - rCells));
        const maxZ = Math.min(this.res, Math.ceil(gz + rCells));

        for (let j = minZ; j <= maxZ; j++) {
          for (let i = minX; i <= maxX; i++) {
            const dx = (i - gx) * (this.size / this.res);
            const dz = (j - gz) * (this.size / this.res);
            const distSq = dx * dx + dz * dz;
            if (distSq < radius * radius) {
              const falloff = Math.exp(-distSq / (2 * (radius * 0.45) * (radius * 0.45)));
              const idx = j * (this.res + 1) + i;
              this.current[idx] -= strength * falloff;
            }
          }
        }
      }

      update() {
        const r = this.res;
        const stride = r + 1;
        let sumTension = 0;

        for (let j = 1; j < r; j++) {
          const row = j * stride;
          for (let i = 1; i < r; i++) {
            const idx = row + i;
            const u = this.current[idx];
            const uPrev = this.previous[idx];
            const laplacian = this.current[idx - 1] + this.current[idx + 1] +
                              this.current[idx - stride] + this.current[idx + stride] - 4.0 * u;
            let next = (2.0 * u - uPrev + this.c2 * laplacian) * this.damping;
            this.velocity[idx] = next - u;
            this.previous[idx] = u;
            this.current[idx] = next;
            sumTension += Math.abs(next);
          }
        }

        this.tension = Math.min(sumTension / (this.res * 12.0), 1.0);

        const posAttr = this.geometry.attributes.position;
        const colAttr = this.geometry.attributes.color;
        const posArr = posAttr.array;
        const colArr = colAttr.array;

        for (let k = 0; k < this.numVertices; k++) {
          const h = this.current[k];
          posArr[k * 3 + 1] = h;
          const absH = Math.abs(h);
          if (absH > 0.01) {
            const stress = Math.min(absH * 1.6, 1.0);
            if (stress < 0.5) {
              colArr[k * 3 + 0] = 0.02;
              colArr[k * 3 + 1] = 0.06 + stress * 1.8;
              colArr[k * 3 + 2] = 0.14 + stress * 1.7;
            } else {
              colArr[k * 3 + 0] = (stress - 0.5) * 2.0;
              colArr[k * 3 + 1] = 0.9 - (stress - 0.5) * 1.5;
              colArr[k * 3 + 2] = 1.0;
            }
          } else {
            colArr[k * 3 + 0] = 0.02;
            colArr[k * 3 + 1] = 0.06;
            colArr[k * 3 + 2] = 0.14;
          }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.wireMaterial.opacity = 0.1 + this.tension * 0.6;
      }

      getHeightAt(x, z) {
        const half = this.size / 2;
        if (x < -half || x > half || z < -half || z > half) return 0;
        const gx = ((x + half) / this.size) * this.res;
        const gz = ((z + half) / this.size) * this.res;
        const ix = Math.floor(gx);
        const iz = Math.floor(gz);
        const idx = iz * (this.res + 1) + ix;
        return this.current[idx] || 0;
      }
    }

    // --- Física de Paredes Elásticas ---
    class LSElasticWall {
      constructor(width, height, resW = 28, resH = 16, sign = 1) {
        this.width = width;
        this.height = height;
        this.resW = resW;
        this.resH = resH;
        this.sign = sign;
        this.numVertices = (resW + 1) * (resH + 1);
        this.current = new Float32Array(this.numVertices);
        this.previous = new Float32Array(this.numVertices);
        this.c2 = 0.25;
        this.damping = 0.978;
        this.tension = 0.0;

        this.geometry = new THREE.PlaneGeometry(width, height, resW, resH);
        this.material = new THREE.MeshStandardMaterial({
          color: 0x050711,
          roughness: 0.5,
          metalness: 0.8,
          transparent: true,
          opacity: 0.9
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
      }
      disturb(uPos, vPos, strength = 0.8) {
        const gu = Math.floor(((uPos + this.width / 2) / this.width) * this.resW);
        const gv = Math.floor(((vPos + this.height / 2) / this.height) * this.resH);
        if (gu >= 0 && gu <= this.resW && gv >= 0 && gv <= this.resH) {
          const idx = gv * (this.resW + 1) + gu;
          this.current[idx] -= strength * this.sign;
        }
      }
      update() {
        const rw = this.resW, rh = this.resH, stride = rw + 1;
        let sumTension = 0;
        for (let j = 1; j < rh; j++) {
          const row = j * stride;
          for (let i = 1; i < rw; i++) {
            const idx = row + i;
            const u = this.current[idx];
            const uPrev = this.previous[idx];
            const laplacian = this.current[idx - 1] + this.current[idx + 1] +
                              this.current[idx - stride] + this.current[idx + stride] - 4.0 * u;
            const next = (2.0 * u - uPrev + this.c2 * laplacian) * this.damping;
            this.previous[idx] = u;
            this.current[idx] = next;
            sumTension += Math.abs(next);
          }
        }
        this.tension = Math.min(sumTension / (rw * 8.0), 1.0);
        const posArr = this.geometry.attributes.position.array;
        for (let k = 0; k < this.numVertices; k++) {
          posArr[k * 3 + 2] = this.current[k];
        }
        this.geometry.attributes.position.needsUpdate = true;
      }
    }

    // --- Escena Three.js & Configuración ---
    const ROOM_SIZE = 28;
    const ROOM_HEIGHT = 14;
    const PALETTE = {
      cyan: { hex: 0x00f0ff, css: '#00f0ff', name: 'Cyan Eléctrico' },
      magenta: { hex: 0xff0077, css: '#ff0077', name: 'Neón Magenta' },
      amber: { hex: 0xffb700, css: '#ffb700', name: 'Ámbar Solar' },
      emerald: { hex: 0x00ffaa, css: '#00ffaa', name: 'Esmeralda Cuántico' },
      white: { hex: 0xf5f8ff, css: '#f5f8ff', name: 'Blanco Cósmico' }
    };
    let currentColorKey = 'cyan';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03050a);
    scene.fog = new THREE.FogExp2(0x03050a, 0.016);

    const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / viewport.clientHeight, 0.1, 150);
    camera.position.set(0, 10, 24);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 45;
    controls.target.set(0, 2.5, 0);

    // Luces de la Sala
    const ambLight = new THREE.AmbientLight(0x0c1224, 0.9);
    scene.add(ambLight);
    const dirLight = new THREE.DirectionalLight(0x223355, 0.5);
    dirLight.position.set(0, ROOM_HEIGHT, 0);
    scene.add(dirLight);

    // Suelo y Paredes Elásticas
    const floor = new LSElasticFloor(ROOM_SIZE, 60);
    scene.add(floor.mesh);

    const half = ROOM_SIZE / 2;
    const walls = [];

    // Back Wall
    const backWall = new LSElasticWall(ROOM_SIZE, ROOM_HEIGHT, 28, 16, 1);
    backWall.mesh.position.set(0, ROOM_HEIGHT / 2, -half);
    scene.add(backWall.mesh);
    walls.push({ inst: backWall, axis: 'z', pos: -half, dir: 1 });

    // Front Wall (Semi-transparente)
    const frontWall = new LSElasticWall(ROOM_SIZE, ROOM_HEIGHT, 28, 16, -1);
    frontWall.mesh.position.set(0, ROOM_HEIGHT / 2, half);
    frontWall.mesh.rotation.y = Math.PI;
    frontWall.material.opacity = 0.25;
    scene.add(frontWall.mesh);
    walls.push({ inst: frontWall, axis: 'z', pos: half, dir: -1 });

    // Left Wall
    const leftWall = new LSElasticWall(ROOM_SIZE, ROOM_HEIGHT, 28, 16, 1);
    leftWall.mesh.position.set(-half, ROOM_HEIGHT / 2, 0);
    leftWall.mesh.rotation.y = Math.PI / 2;
    scene.add(leftWall.mesh);
    walls.push({ inst: leftWall, axis: 'x', pos: -half, dir: 1 });

    // Right Wall
    const rightWall = new LSElasticWall(ROOM_SIZE, ROOM_HEIGHT, 28, 16, -1);
    rightWall.mesh.position.set(half, ROOM_HEIGHT / 2, 0);
    rightWall.mesh.rotation.y = -Math.PI / 2;
    scene.add(rightWall.mesh);
    walls.push({ inst: rightWall, axis: 'x', pos: half, dir: -1 });

    // Techo
    const ceilGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMesh = new THREE.Mesh(ceilGeo, new THREE.MeshStandardMaterial({ color: 0x04060e, roughness: 0.8 }));
    ceilMesh.position.y = ROOM_HEIGHT;
    scene.add(ceilMesh);

    // --- Esferas Suspendidas de Techo con CubeCamera ---
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    });
    const cubeCamera = new THREE.CubeCamera(0.2, 60, cubeRenderTarget);
    cubeCamera.position.set(0, ROOM_HEIGHT - 4.2, 0);
    scene.add(cubeCamera);

    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.98,
      roughness: 0.02,
      envMap: cubeRenderTarget.texture,
      envMapIntensity: 2.5
    });

    const ceilingOrbs = [];
    const orbConfigs = [
      { x: 0, z: 0, r: 1.4, hang: 4.8, phase: 0, freq: 0.9 },
      { x: -5, z: -4, r: 1.1, hang: 5.4, phase: 1.2, freq: 1.1 },
      { x: 5, z: -3.5, r: 1.2, hang: 4.2, phase: 2.5, freq: 0.85 },
      { x: -4.5, z: 4.5, r: 0.9, hang: 6.0, phase: 3.8, freq: 1.2 },
      { x: 4.2, z: 5.0, r: 1.0, hang: 5.0, phase: 4.6, freq: 1.0 },
      { x: -7, z: 1, r: 0.8, hang: 6.2, phase: 0.7, freq: 1.3 },
      { x: 7, z: 1.5, r: 0.85, hang: 6.0, phase: 2.1, freq: 1.2 }
    ];

    orbConfigs.forEach(cfg => {
      const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.r, 36, 36), mirrorMat);
      scene.add(orbMesh);

      const wireGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cfg.x, ROOM_HEIGHT, cfg.z),
        new THREE.Vector3(cfg.x, ROOM_HEIGHT - cfg.hang, cfg.z)
      ]);
      const wireMesh = new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0x4488aa, opacity: 0.4, transparent: true }));
      scene.add(wireMesh);

      ceilingOrbs.push({
        mesh: orbMesh,
        wire: wireMesh,
        anchor: new THREE.Vector3(cfg.x, ROOM_HEIGHT, cfg.z),
        hang: cfg.hang,
        phase: cfg.phase,
        freq: cfg.freq,
        restY: ROOM_HEIGHT - cfg.hang
      });
    });

    // --- Bolas de Luz & Recorridos de Tensión ---
    let lightSpheres = [];
    class LightSphere {
      constructor(origin, velocity, colorDef) {
        this.radius = 0.52;
        this.pos = origin.clone();
        this.vel = velocity.clone();
        this.gravity = new THREE.Vector3(0, -18.0, 0);
        this.color = new THREE.Color(colorDef.hex);
        this.isAlive = true;
        this.age = 0;
        this.maxAge = 35;

        this.mesh = new THREE.Mesh(
          new THREE.SphereGeometry(this.radius, 24, 24),
          new THREE.MeshBasicMaterial({ color: this.color })
        );
        this.mesh.position.copy(this.pos);
        scene.add(this.mesh);

        this.light = new THREE.PointLight(this.color, 2.2, 14, 1.8);
        this.light.position.copy(this.pos);
        scene.add(this.light);

        // Trail Lines
        this.maxTrail = 140;
        this.trailPoints = [];
        this.trailGeo = new THREE.BufferGeometry();
        this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxTrail * 3), 3));
        this.trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.maxTrail * 3), 3));
        this.trailLine = new THREE.Line(this.trailGeo, new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending
        }));
        scene.add(this.trailLine);
      }

      update(dt, tension) {
        if (!this.isAlive) return;
        this.age += dt;

        this.vel.addScaledVector(this.gravity, dt);
        this.vel.multiplyScalar(0.994);
        this.pos.addScaledVector(this.vel, dt);

        // Suelo
        const floorH = floor.getHeightAt(this.pos.x, this.pos.z);
        const contactY = floorH + this.radius;
        if (this.pos.y <= contactY) {
          this.pos.y = contactY;
          const speed = Math.abs(this.vel.y);
          if (speed > 0.4) {
            this.vel.y = -this.vel.y * 0.86;
            floor.disturb(this.pos.x, this.pos.z, Math.min(speed * 0.16, 1.8), 2.2);
            lsAudio.playBounce(speed * 0.15, false);
          } else {
            this.vel.y = 0;
            this.vel.x *= 0.95;
            this.vel.z *= 0.95;
          }
        }

        // Paredes
        const hf = ROOM_SIZE / 2 - this.radius;
        if (this.pos.x > hf) { this.pos.x = hf; this.vel.x = -this.vel.x * 0.85; walls[3].inst.disturb(this.pos.z, this.pos.y - ROOM_HEIGHT / 2); lsAudio.playBounce(0.5, true); }
        else if (this.pos.x < -hf) { this.pos.x = -hf; this.vel.x = -this.vel.x * 0.85; walls[2].inst.disturb(this.pos.z, this.pos.y - ROOM_HEIGHT / 2); lsAudio.playBounce(0.5, true); }
        if (this.pos.z > hf) { this.pos.z = hf; this.vel.z = -this.vel.z * 0.85; walls[1].inst.disturb(this.pos.x, this.pos.y - ROOM_HEIGHT / 2); lsAudio.playBounce(0.5, true); }
        else if (this.pos.z < -hf) { this.pos.z = -hf; this.vel.z = -this.vel.z * 0.85; walls[0].inst.disturb(this.pos.x, this.pos.y - ROOM_HEIGHT / 2); lsAudio.playBounce(0.5, true); }

        this.mesh.position.copy(this.pos);
        this.light.position.copy(this.pos);

        // Trail Update (se apagan al desaparecer la tensión)
        this.trailPoints.unshift(this.pos.clone());
        if (this.trailPoints.length > this.maxTrail) this.trailPoints.pop();

        const posArr = this.trailGeo.attributes.position.array;
        const colArr = this.trailGeo.attributes.color.array;
        const len = this.trailPoints.length;

        for (let i = 0; i < this.maxTrail; i++) {
          if (i < len) {
            const pt = this.trailPoints[i];
            posArr[i * 3 + 0] = pt.x;
            posArr[i * 3 + 1] = pt.y;
            posArr[i * 3 + 2] = pt.z;

            // Brillo atado a la tensión de la sala
            const progress = 1.0 - (i / len);
            const tensionFactor = Math.min(Math.max(tension * 2.8, 0.05), 1.2);
            const br = progress * tensionFactor;

            colArr[i * 3 + 0] = this.color.r * br;
            colArr[i * 3 + 1] = this.color.g * br;
            colArr[i * 3 + 2] = this.color.b * br;
          } else {
            colArr[i * 3 + 0] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
          }
        }
        this.trailGeo.attributes.position.needsUpdate = true;
        this.trailGeo.attributes.color.needsUpdate = true;
        this.trailGeo.setDrawRange(0, len);
      }

      destroy() {
        this.isAlive = false;
        scene.remove(this.mesh);
        scene.remove(this.light);
        scene.remove(this.trailLine);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.trailGeo.dispose();
        this.trailLine.material.dispose();
      }
    }

    function throwBall(origin, targetDir, speed = 22) {
      lsAudio.init();
      const vel = targetDir.clone().normalize().multiplyScalar(speed);
      vel.y += 3.5;
      const sphere = new LightSphere(origin, vel, PALETTE[currentColorKey]);
      lightSpheres.push(sphere);
      lsAudio.playLaunch();
      showToast();
    }

    function showerBalls() {
      lsAudio.init();
      const keys = Object.keys(PALETTE);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const colKey = keys[i % keys.length];
        const vel = new THREE.Vector3(Math.cos(ang) * 12, 4 + Math.random() * 4, Math.sin(ang) * 12);
        const sphere = new LightSphere(new THREE.Vector3(0, 7, 0), vel, PALETTE[colKey]);
        lightSpheres.push(sphere);
      }
      floor.disturb(0, 0, 1.8, 3.5);
      lsAudio.playBounce(1.0, false);
      showToast('Ráfaga de luces desplegada en la sala');
    }

    function clearBalls() {
      lightSpheres.forEach(s => s.destroy());
      lightSpheres = [];
      showToast('Recorridos y bolas disueltas');
    }

    // --- Interacción con Puntero ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDown = false;
    let downPos = { x: 0, y: 0 };

    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      downPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', (e) => {
      if (!isDown) return;
      isDown = false;
      const rect = renderer.domElement.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      const dist = Math.hypot(dx, dy);

      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (dist < 12) {
        const hits = raycaster.intersectObject(floor.mesh);
        if (hits.length > 0) {
          const pt = hits[0].point;
          const start = camera.position.clone().addScaledVector(raycaster.ray.direction, 1.2);
          const dir = pt.clone().sub(start).normalize();
          throwBall(start, dir, 22);
        } else {
          const start = camera.position.clone().addScaledVector(raycaster.ray.direction, 1.5);
          throwBall(start, raycaster.ray.direction, 22);
        }
      } else {
        const power = Math.min(Math.max(dist * 0.16, 14), 36);
        const start = camera.position.clone().addScaledVector(raycaster.ray.direction, 1.5);
        throwBall(start, raycaster.ray.direction, power);
      }
    });

    // --- Controles de UI ---
    // Color Picker
    document.querySelectorAll('.ls-color-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ls-color-dot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColorKey = btn.dataset.color || 'cyan';
      });
    });

    // Botones de acción
    document.getElementById('btnLsThrow')?.addEventListener('click', () => {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      throwBall(camera.position.clone().addScaledVector(dir, 1.5), dir, 24);
    });
    document.getElementById('btnLsShower')?.addEventListener('click', showerBalls);
    document.getElementById('btnLsDisturb')?.addEventListener('click', () => {
      floor.disturb((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, 1.6, 2.5);
      lsAudio.playBounce(0.85, false);
      showToast('Tensión elástica aplicada al suelo');
    });
    document.getElementById('btnLsClear')?.addEventListener('click', clearBalls);

    // Audio Room Toggle
    const audioBtn = document.getElementById('audioAmbientRoomBtn');
    const synthStatus = document.getElementById('synthStatusText');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const active = lsAudio.toggle();
        audioBtn.classList.toggle('active', active);
        if (synthStatus) synthStatus.textContent = active ? 'AUDIO ESPACIAL ACTIVO' : 'AUDIO EN SILENCIO';
        showToast(active ? 'Audio espacial activado' : 'Audio en silencio');
      });
    }

    // Cámara Presets
    function setCamView(name) {
      let tPos, tLook;
      if (name === 'general') { tPos = new THREE.Vector3(0, 10, 24); tLook = new THREE.Vector3(0, 2.5, 0); }
      else if (name === 'floor') { tPos = new THREE.Vector3(0, 1.8, 11); tLook = new THREE.Vector3(0, 0.2, -4); }
      else if (name === 'ceiling') { tPos = new THREE.Vector3(0, 3.5, 4); tLook = new THREE.Vector3(0, ROOM_HEIGHT - 3, 0); }
      else if (name === 'top') { tPos = new THREE.Vector3(0, 28, 0.1); tLook = new THREE.Vector3(0, 0, 0); }

      if (tPos && tLook) {
        camera.position.copy(tPos);
        controls.target.copy(tLook);
        document.querySelectorAll('.ls-cam-pill').forEach(b => b.classList.toggle('active', b.dataset.view === name));
      }
    }
    document.querySelectorAll('.ls-cam-pill').forEach(b => b.addEventListener('click', () => setCamView(b.dataset.view)));

    // Pantalla Completa
    const fsBtn = document.getElementById('lsFullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        const card = document.getElementById('virtualRoomCard');
        if (!document.fullscreenElement) {
          card?.requestFullscreen().catch(err => console.warn(err));
        } else {
          document.exitFullscreen();
        }
      });
    }

    // Resize
    function handleResize() {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight || 650;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    // Teclado
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && ['input', 'textarea', 'select'].includes(document.activeElement.tagName.toLowerCase())) return;
      if (e.code === 'Space') {
        const rect = lsSection?.getBoundingClientRect();
        if (rect && rect.top < window.innerHeight && rect.bottom > 0) {
          e.preventDefault();
          showerBalls();
        }
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const views = ['general', 'floor', 'ceiling', 'top'];
        setCamView(views[parseInt(e.key) - 1]);
      }
    });

    // --- Bucle de Renderizado ---
    let frame = 0;
    const clock = new THREE.Clock();

    function renderLoop() {
      requestAnimationFrame(renderLoop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();
      frame++;

      controls.update();

      // Físicas
      floor.update();
      let wallsTension = 0;
      walls.forEach(w => { w.inst.update(); wallsTension += w.inst.tension; });

      const roomTension = Math.min(floor.tension * 0.75 + (wallsTension / walls.length) * 0.25, 1.0);

      // UI Tension Meter
      const tensionPercent = Math.round(roomTension * 100);
      const tensionFill = document.getElementById('lsTensionFill');
      const tensionVal = document.getElementById('lsTensionPercent');
      if (tensionFill) tensionFill.style.width = tensionPercent + '%';
      if (tensionVal) tensionVal.textContent = tensionPercent + '%';

      // Audio tension update
      lsAudio.updateTension(roomTension);

      // Bolas
      for (let i = lightSpheres.length - 1; i >= 0; i--) {
        const s = lightSpheres[i];
        s.update(dt, roomTension);
        if (s.age > s.maxAge) {
          s.destroy();
          lightSpheres.splice(i, 1);
        }
      }

      // Esferas de Techo
      ceilingOrbs.forEach(orb => {
        const sx = Math.sin(time * orb.freq + orb.phase) * 0.25;
        const sz = Math.cos(time * orb.freq * 0.8 + orb.phase) * 0.2;
        orb.mesh.position.set(orb.anchor.x + sx, orb.restY, orb.anchor.z + sz);
        orb.wire.geometry.setFromPoints([orb.anchor, orb.mesh.position]);
      });

      // Reflejos dinámicos del suelo en las esferas del techo
      if (frame % 2 === 0) {
        ceilingOrbs.forEach(o => o.mesh.visible = false);
        cubeCamera.update(renderer, scene);
        ceilingOrbs.forEach(o => o.mesh.visible = true);
      }

      renderer.render(scene, camera);
    }

    renderLoop();
  })();

  /* ══════════════════════════════════════════════════════════════
     10. FORMULARIO DE CONTACTO
     ══════════════════════════════════════════════════════════════ */
  const contactForm   = document.getElementById('contactForm');
  const formSuccess   = document.getElementById('formSuccessMessage');
  const btnDismiss    = document.getElementById('btnDismissSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      [['contactName','nameError','Por favor, ingresa tu nombre.'],
       ['contactEmail','emailError','Ingresa un correo válido.'],
       ['contactMessage','messageError','Por favor, escribe un mensaje.']
      ].forEach(([id,errId,msg]) => {
        const input = document.getElementById(id);
        const err   = document.getElementById(errId);
        const valid = id==='contactEmail' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input?.value?.trim()) : !!input?.value?.trim();
        if (!valid) { ok=false; if(err){err.textContent=msg;err.style.display='block';} }
        else { if(err) err.style.display='none'; }
      });
      if (ok) { formSuccess?.classList.add('visible'); contactForm.reset(); galleryAudio.playGlintChime(660); }
    });
    if (btnDismiss) btnDismiss.addEventListener('click', () => formSuccess?.classList.remove('visible'));
  }

  // Toast de bienvenida
  setTimeout(() => showToast('Bienvenido a Galería Cero // Explora las salas'), 900);
});
