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
     9. SECCIÓN L&S: SALA INMERSIVA COMPLETA (PENUMBRA & LUZ)
        - Propuesta de Penumbra y Luz suave (luz atenuada por defecto)
        - Pantallas interactivas laterales con cambio de estado al mouse
        - Generador de Ondas Visuales (ripples) reactivo al movimiento del ratón
        - Puerta de salida visible en la estructura 3D + HUD
        - Compatibilidad completa con Pantalla Completa
     ══════════════════════════════════════════════════════════════ */
  const roomCanvas   = document.getElementById('virtualRoomCanvas');
  const lsSection    = document.getElementById('ls');
  const coordX       = document.getElementById('coordX');
  const coordZ       = document.getElementById('coordZ');
  const coordAngle   = document.getElementById('coordAngle');
  const lightRange   = document.getElementById('lightIntensityRange');
  const lightSelect  = document.getElementById('spotlightColorSelect');
  const roomAudioBtn = document.getElementById('audioAmbientRoomBtn');
  const synthPulse   = document.getElementById('synthPulse');
  const synthStatus  = document.getElementById('synthStatusText');
  const hotspot      = document.getElementById('hotspotCenter');
  const hotspotExit  = document.getElementById('hotspotExit');
  const btnFpsMode   = document.getElementById('btnFpsMode');
  const fpsCrosshair = document.getElementById('fpsCrosshair');
  const minimapCanvas= document.getElementById('minimapCanvas');
  const roomCard     = document.getElementById('virtualRoomCard');

  // ── Botones de Pantalla Completa y Puerta de Salida en el HUD ───────
  let fsBtn = null;
  let exitBtn = null;

  if (roomCard) {
    const hud = roomCard.querySelector('.room-hud-bar');
    if (hud) {
      // Contenedor de acciones HUD
      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'ls-hud-actions';

      // Botón Puerta de Salida HUD
      exitBtn = document.createElement('button');
      exitBtn.id = 'lsExitDoorBtn';
      exitBtn.className = 'tool-btn ls-exit-door-btn';
      exitBtn.innerHTML = '<span class="tool-icon">🚪</span><span>PUERTA DE SALIDA</span>';
      actionsGroup.appendChild(exitBtn);

      // Botón Pantalla Completa
      fsBtn = document.createElement('button');
      fsBtn.id = 'lsFullscreenBtn';
      fsBtn.className = 'tool-btn ls-fullscreen-btn';
      fsBtn.innerHTML = '<span class="tool-icon">⤢</span><span>PANTALLA COMPLETA</span>';
      actionsGroup.appendChild(fsBtn);

      hud.appendChild(actionsGroup);
    }
  }

  if (roomCanvas) {
    const ctx = roomCanvas.getContext('2d');
    const miniCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    // ── Estado de la cámara y física 3D ─────────────────────
    const camera = {
      x: 0,
      y: 0,
      z: 8,
      yaw: 0,
      pitch: 0.05,
      targetYaw: 0,
      targetPitch: 0.05,
      vx: 0,
      vz: 0,
      headBob: 0,
      isMoving: false
    };

    let isPointerLocked = false;
    let mouseDownWalk = false;
    let mouseBackWalk = false;
    let lookMode = false, lastMX = 0, lastMY = 0;
    let lightVal = 0.35, lightMode = 'pure-white', roomSound = false; // Luz más suave por defecto (0.35)
    let walkStepCycle = 0;

    // ── Coordenadas del ratón en la sala ────────────────────
    let currentMouseX = roomCanvas.width / 2;
    let currentMouseY = roomCanvas.height / 2;

    // ── Sistema de Ondas Visuales (Ripples) en la Sala ───────
    const roomRipples = [];
    let lastRippleTime = 0;

    function addRoomRipple(x, y, maxR = 120, color = 'rgba(180,220,255,') {
      roomRipples.push({
        x, y,
        r: 0,
        maxR: maxR,
        alpha: 0.75,
        speed: 2.2 + Math.random() * 0.8,
        color
      });
      if (roomRipples.length > 25) roomRipples.shift();
    }

    // ── Función para Salir de la Sala / Pantalla Completa ────
    function exitGalleryRoom() {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.warn(err));
      }
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      camera.x = 0;
      camera.z = 5.0;
      camera.targetYaw = 0;
      camera.targetPitch = 0.05;
      if (galleryAudio) galleryAudio.playGlintChime(260);
      showToast('🚪 Puerta de Salida: Has egresado de la Sala L&S');
    }

    if (exitBtn) exitBtn.addEventListener('click', exitGalleryRoom);
    if (hotspotExit) hotspotExit.addEventListener('click', exitGalleryRoom);

    // Gestor de Pantalla Completa
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          roomCard.requestFullscreen().catch(err => console.warn(err));
        } else {
          document.exitFullscreen();
        }
      });
    }

    document.addEventListener('fullscreenchange', () => {
      const isFS = !!document.fullscreenElement;
      if (fsBtn) {
        fsBtn.innerHTML = isFS ?
          '<span class="tool-icon">⤡</span><span>SALIR PANTALLA COMPLETA</span>' :
          '<span class="tool-icon">⤢</span><span>PANTALLA COMPLETA</span>';
      }
      if (roomCanvas) {
        roomCanvas.width  = isFS ? window.innerWidth : roomCanvas.parentElement.clientWidth;
        roomCanvas.height = isFS ? window.innerHeight : roomCanvas.parentElement.clientHeight;
      }
    });

    // ── Animación de entrada: "vuelo" de z=8 a z=3.5 ────────
    let flyIn = true, flyProgress = 0;
    const FLY_DURATION = 2000;
    let flyStart = null;

    // ── Partículas ambientales flotantes en penumbra ────────
    const spaceParticles = Array.from({ length: 80 }, () => ({
      x: (Math.random() - 0.5) * 8.5,
      y: -2.0 + Math.random() * 3.2,
      z: (Math.random() - 0.5) * 11,
      vx: (Math.random() - 0.5) * 0.0018,
      vy: (Math.random() - 0.5) * 0.0012,
      vz: (Math.random() - 0.5) * 0.0018,
      size: Math.random() * 0.035 + 0.012,
      alpha: Math.random() * 0.5 + 0.15,
      phase: Math.random() * Math.PI * 2
    }));

    // ── Pantallas interactivas digitales en las paredes ──────
    const screens = [
      {
        id: 'screenA',
        wx: -4.3, wy: -0.2, wz: -0.5,
        width: 2.6, height: 1.6,
        particles: [], waves: [],
        hovered: false, hoverProgress: 0,
        mouseRelX: 0.5, mouseRelY: 0.5,
        lastTouch: 0,
        title: 'PANTALLA A: OSCILADOR DE PENUMBRA',
        subtitle: 'ESTADO: SENSORES EN LÍNEA'
      },
      {
        id: 'screenB',
        wx: 4.3, wy: -0.2, wz: -0.5,
        width: 2.6, height: 1.6,
        particles: [], waves: [],
        hovered: false, hoverProgress: 0,
        mouseRelX: 0.5, mouseRelY: 0.5,
        lastTouch: 0,
        title: 'PANTALLA B: MATRIZ DE ONDAS REACTIVAS',
        subtitle: 'ESTADO: SENSORES EN LÍNEA'
      },
      {
        id: 'screenC',
        wx: -2.8, wy: -0.2, wz: -5.3,
        width: 2.2, height: 1.4,
        particles: [], waves: [],
        hovered: false, hoverProgress: 0,
        mouseRelX: 0.5, mouseRelY: 0.5,
        lastTouch: 0,
        title: 'PANTALLA C: CAMPOS DE RESONANCIA',
        subtitle: 'ESTADO: SENSORES EN LÍNEA'
      }
    ];

    screens.forEach(sc => {
      sc.particles = Array.from({ length: 26 }, () => ({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.006,
        vy: (Math.random() - 0.5) * 0.006,
        r: Math.random() * 0.035 + 0.015,
        a: 0.2, target_a: 0.2
      }));
    });

    // ── Resize ────────────────────────────────────────────────
    function resizeRoom() {
      if (document.fullscreenElement) {
        roomCanvas.width  = window.innerWidth;
        roomCanvas.height = window.innerHeight;
      } else {
        roomCanvas.width  = roomCanvas.parentElement.clientWidth;
        roomCanvas.height = roomCanvas.parentElement.clientHeight;
      }
    }
    resizeRoom();
    window.addEventListener('resize', resizeRoom);

    // ── Proyección 3D en Perspectiva ──────────────────────────
    function project3D(px, py, pz) {
      let rx = px - camera.x;
      let ry = py - (camera.y + camera.headBob);
      let rz = pz - camera.z;

      const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      const x1 = rx * cy2 + rz * sy;
      const z1 = -rx * sy + rz * cy2;

      const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
      const y2 = ry * cp - z1 * sp;
      const z2 = ry * sp + z1 * cp;

      if (z2 <= 0.08) return null;
      const fov = roomCanvas.height * 0.72;
      const sc = fov / z2;
      return { x: roomCanvas.width / 2 + x1 * sc, y: roomCanvas.height / 2 + y2 * sc, sc, depth: z2 };
    }

    // ── Renderizado del Radar / Minimap 3D ────────────────────
    function drawMinimap() {
      if (!miniCtx || !minimapCanvas) return;
      const mw = minimapCanvas.width, mh = minimapCanvas.height;
      miniCtx.clearRect(0, 0, mw, mh);

      miniCtx.fillStyle = '#06080d';
      miniCtx.fillRect(0, 0, mw, mh);

      miniCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      miniCtx.lineWidth = 1;
      miniCtx.strokeRect(4, 4, mw - 8, mh - 8);
      miniCtx.beginPath();
      miniCtx.moveTo(mw/2, 4); miniCtx.lineTo(mw/2, mh-4);
      miniCtx.moveTo(4, mh/2); miniCtx.lineTo(mw-4, mh/2);
      miniCtx.stroke();

      const toMx = (x) => mw/2 + (x / 5.2) * (mw/2 - 8);
      const toMz = (z) => mh/2 + (z / 6.0) * (mh/2 - 8);

      // Escultura central
      miniCtx.fillStyle = 'rgba(255,255,255,0.35)';
      miniCtx.beginPath();
      miniCtx.arc(toMx(0), toMz(0), 4, 0, Math.PI * 2);
      miniCtx.fill();

      // Pantallas interactivas
      miniCtx.fillStyle = 'rgba(120,200,255,0.85)';
      miniCtx.fillRect(toMx(-4.3) - 2, toMz(-0.5) - 5, 4, 10);
      miniCtx.fillRect(toMx(4.3) - 2, toMz(-0.5) - 5, 4, 10);
      miniCtx.fillRect(toMx(-2.8) - 4, toMz(-5.3) - 2, 8, 4);

      // Icono de Puerta de Salida en la pared trasera
      miniCtx.fillStyle = '#64ffda';
      miniCtx.fillRect(toMx(0) - 5, toMz(-5.45) - 2, 10, 3);

      // Cono de visión del jugador
      const px = toMx(camera.x), pz = toMz(camera.z);
      const viewLen = 13;
      const leftAngle = camera.yaw - 0.45;
      const rightAngle = camera.yaw + 0.45;

      miniCtx.fillStyle = 'rgba(255,255,255,0.15)';
      miniCtx.beginPath();
      miniCtx.moveTo(px, pz);
      miniCtx.lineTo(px - Math.sin(leftAngle) * viewLen, pz - Math.cos(leftAngle) * viewLen);
      miniCtx.lineTo(px - Math.sin(rightAngle) * viewLen, pz - Math.cos(rightAngle) * viewLen);
      miniCtx.closePath();
      miniCtx.fill();

      // Punto del jugador
      miniCtx.fillStyle = '#ffffff';
      miniCtx.beginPath();
      miniCtx.arc(px, pz, 3, 0, Math.PI * 2);
      miniCtx.fill();
    }

    // ── Teclado WASD / Flechas / Shift ────────────────────────
    const keys = {};
    window.addEventListener('keydown', e => {
      const aEl = document.activeElement;
      if (aEl && (aEl.tagName==='INPUT'||aEl.tagName==='TEXTAREA')) return;
      keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      keys[e.key.toLowerCase()] = false;
    });

    // ── Loop Principal de Render y Videojuego 3D ───────────────
    function renderRoom(ts) {
      const W = roomCanvas.width, H = roomCanvas.height;
      ctx.clearRect(0, 0, W, H);
      const t = ts * 0.001;

      // — Animación de entrada suave —
      if (flyIn) {
        if (!flyStart) flyStart = ts;
        flyProgress = Math.min(1, (ts - flyStart) / FLY_DURATION);
        const ease = 1 - Math.pow(1 - flyProgress, 3);
        camera.z = 8 - ease * 4.5;
        camera.pitch = 0.05 + Math.sin(flyProgress * Math.PI) * 0.08;
        if (flyProgress >= 1) { flyIn = false; camera.z = 3.5; camera.pitch = 0.05; }
      }

      // — Interpolación de cámara —
      camera.yaw += (camera.targetYaw - camera.yaw) * 0.25;
      camera.pitch += (camera.targetPitch - camera.pitch) * 0.25;

      // — Movimiento y física del jugador —
      const isSprinting = keys['shift'];
      const moveSpeed = (isSprinting ? 0.09 : 0.052);
      const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);

      let forward = 0, strafe = 0;
      if (keys['w'] || keys['arrowup'] || mouseDownWalk)   forward += 1;
      if (keys['s'] || keys['arrowdown'] || mouseBackWalk) forward -= 1;
      if (keys['a'] || keys['arrowleft'])                  strafe -= 1;
      if (keys['d'] || keys['arrowright'])                 strafe += 1;

      if (forward !== 0 || strafe !== 0) {
        const len = Math.hypot(forward, strafe);
        forward /= len; strafe /= len;
        camera.vx += (sy * forward + cy2 * strafe) * moveSpeed;
        camera.vz += (-cy2 * forward + sy * strafe) * moveSpeed;
        camera.isMoving = true;
        walkStepCycle += moveSpeed * 3.5;
        camera.headBob = Math.sin(walkStepCycle) * 0.035;
      } else {
        camera.isMoving = false;
        camera.headBob *= 0.8;
      }

      camera.x += camera.vx;
      camera.z += camera.vz;
      camera.vx *= 0.72;
      camera.vz *= 0.72;

      // Colisiones de la sala
      camera.x = Math.max(-3.8, Math.min(3.8, camera.x));
      camera.z = Math.max(-4.4, Math.min(5.2, camera.z));

      // — Fondo de Penumbra de la Sala —
      let ambR, ambG, ambB;
      if (lightMode === 'warm-noir')          { ambR=24; ambG=22; ambB=20; }
      else if (lightMode === 'deep-contrast') { ambR=6;  ambG=6;  ambB=8;  }
      else                                     { ambR=12; ambG=14; ambB=20; }
      ctx.fillStyle = `rgb(${ambR},${ambG},${ambB})`;
      ctx.fillRect(0, 0, W, H);

      // — PAREDES EN PERSPECTIVA 3D —
      const pBackTL = project3D(-4.5, -2.4, -5.5);
      const pBackTR = project3D( 4.5, -2.4, -5.5);
      const pBackBR = project3D( 4.5,  1.2, -5.5);
      const pBackBL = project3D(-4.5,  1.2, -5.5);

      if (pBackTL && pBackTR && pBackBR && pBackBL) {
        ctx.beginPath();
        ctx.moveTo(pBackTL.x, pBackTL.y);
        ctx.lineTo(pBackTR.x, pBackTR.y);
        ctx.lineTo(pBackBR.x, pBackBR.y);
        ctx.lineTo(pBackBL.x, pBackBL.y);
        ctx.closePath();
        const wallGrad = ctx.createLinearGradient(0, pBackTL.y, 0, pBackBL.y);
        wallGrad.addColorStop(0, `rgba(10, 12, 16, 0.96)`);
        wallGrad.addColorStop(1, `rgba(4, 5, 8, 0.98)`);
        ctx.fillStyle = wallGrad;
        ctx.fill();
      }

      // — ESTRUCTURA 3D DE LA PUERTA DE SALIDA (PARED TRASERA) ─────
      // Ubicación en 3D: x: 0.0, y: 0.1 (centro), z: -5.45
      const doorW = 1.3, doorH = 2.1;
      const dTL = project3D(-doorW/2, -doorH/2 + 0.15, -5.45);
      const dTR = project3D( doorW/2, -doorH/2 + 0.15, -5.45);
      const dBR = project3D( doorW/2,  1.18,           -5.45);
      const dBL = project3D(-doorW/2,  1.18,           -5.45);

      let isDoorCurrentlyHovered = false;

      if (dTL && dTR && dBR && dBL) {
        // Distancia a la puerta y comprobación estricta de Hover
        const minDx = Math.min(dTL.x, dBL.x), maxDx = Math.max(dTR.x, dBR.x);
        const minDy = Math.min(dTL.y, dTR.y), maxDy = Math.max(dBL.y, dBR.y);

        const isMouseInDoorPoly = (currentMouseX >= minDx && currentMouseX <= maxDx &&
                                   currentMouseY >= minDy && currentMouseY <= maxDy);

        isDoorCurrentlyHovered = isMouseInDoorPoly && (camera.z > 1.8) && !screens.some(s => s.hovered);

        // Marco exterior de la puerta
        ctx.beginPath();
        ctx.moveTo(dTL.x, dTL.y);
        ctx.lineTo(dTR.x, dTR.y);
        ctx.lineTo(dBR.x, dBR.y);
        ctx.lineTo(dBL.x, dBL.y);
        ctx.closePath();

        const doorGrad = ctx.createLinearGradient(dTL.x, dTL.y, dBR.x, dBR.y);
        doorGrad.addColorStop(0, isDoorCurrentlyHovered ? 'rgba(28, 45, 60, 0.95)' : 'rgba(14, 18, 26, 0.85)');
        doorGrad.addColorStop(1, isDoorCurrentlyHovered ? 'rgba(16, 30, 44, 0.98)' : 'rgba(8, 10, 15, 0.9)');
        ctx.fillStyle = doorGrad;
        ctx.fill();

        ctx.strokeStyle = isDoorCurrentlyHovered ? '#64ffda' : 'rgba(180, 220, 255, 0.35)';
        ctx.lineWidth = isDoorCurrentlyHovered ? 2.0 : 1.2;
        ctx.stroke();

        // Paneles de vidrio y línea divisoria central
        const dMidTop = project3D(0, -doorH/2 + 0.15, -5.45);
        const dMidBot = project3D(0,  1.18,           -5.45);
        if (dMidTop && dMidBot) {
          ctx.beginPath();
          ctx.moveTo(dMidTop.x, dMidTop.y);
          ctx.lineTo(dMidBot.x, dMidBot.y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Tiradores metálicos de la puerta
        const handleL = project3D(-0.08, 0.2, -5.44);
        const handleR = project3D( 0.08, 0.2, -5.44);
        if (handleL && handleR) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(handleL.x - 1, handleL.y - 8, 2, 16);
          ctx.fillRect(handleR.x,     handleR.y - 8, 2, 16);
        }

        // Indicador LED sutil sobre el marco de la puerta (sin texto en canvas)
        const dLed = project3D(0, -doorH/2 + 0.08, -5.44);
        if (dLed) {
          ctx.fillStyle = isDoorCurrentlyHovered ? '#64ffda' : 'rgba(100, 255, 218, 0.6)';
          ctx.beginPath();
          ctx.arc(dLed.x, dLed.y, Math.max(2, 3 * dLed.sc), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // — TECHO Y ILUMINACIÓN DE PENUMBRA —
      const ceilingAlpha = 0.06 * lightVal;
      ctx.strokeStyle = `rgba(180, 210, 255, ${ceilingAlpha})`;
      ctx.lineWidth = 1;
      for (let cx = -4; cx <= 4; cx += 2) {
        const cA = project3D(cx, -2.3, -5.5), cB = project3D(cx, -2.3, 5.5);
        if (cA && cB) { ctx.beginPath(); ctx.moveTo(cA.x, cA.y); ctx.lineTo(cB.x, cB.y); ctx.stroke(); }
      }

      // — HAZ DE LUZ ATENUADO EN PENUMBRA —
      const spotApex = project3D(0, -3.2, 0);
      const spotB1   = project3D(-1.5, 1.15, -1.5);
      const spotB2   = project3D( 1.5, 1.15,  1.5);
      if (spotApex && spotB1 && spotB2) {
        const sg = ctx.createLinearGradient(spotApex.x, spotApex.y, (spotB1.x+spotB2.x)/2, (spotB1.y+spotB2.y)/2);
        sg.addColorStop(0, `rgba(255,255,255,${0.35 * lightVal})`);
        sg.addColorStop(0.6, `rgba(180,210,255,${0.12 * lightVal})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(spotApex.x, spotApex.y);
        ctx.lineTo(spotB1.x, spotB1.y);
        ctx.lineTo(spotB2.x, spotB2.y);
        ctx.closePath();
        ctx.fill();
      }

      // — PISO DE VIDRIO OSCURO Y MÁRMOL —
      const floorAlpha = 0.12 * lightVal;
      ctx.strokeStyle = `rgba(140, 180, 255, ${floorAlpha})`;
      ctx.lineWidth = 1;
      for (let gx = -5; gx <= 5; gx += 1) {
        const pA = project3D(gx, 1.2, -5.5), pB = project3D(gx, 1.2, 5.5);
        if (pA && pB) { ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y); ctx.stroke(); }
      }
      for (let gz = -5; gz <= 5; gz += 1) {
        const pA = project3D(-5, 1.2, gz), pB = project3D(5, 1.2, gz);
        if (pA && pB) { ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y); ctx.stroke(); }
      }

      // Reflejo central en el piso
      const floorCenter = project3D(0, 1.19, 0);
      if (floorCenter) {
        const fg = ctx.createRadialGradient(floorCenter.x, floorCenter.y, 0, floorCenter.x, floorCenter.y, 160 * floorCenter.sc);
        fg.addColorStop(0, `rgba(180,210,255,${0.18 * lightVal + 0.04 * Math.sin(t * 1.8)})`);
        fg.addColorStop(0.7, `rgba(140,180,255,${0.05 * lightVal})`);
        fg.addColorStop(1, 'rgba(140,180,255,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(floorCenter.x, floorCenter.y, 200 * floorCenter.sc, 65 * floorCenter.sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // — RENDERING DE ONDAS VISUALES EN LA SALA (RIPPLES DEL MOUSE) ──
      for (let i = roomRipples.length - 1; i >= 0; i--) {
        const rip = roomRipples[i];
        rip.r += rip.speed;
        rip.alpha *= 0.945;

        if (rip.r >= rip.maxR || rip.alpha <= 0.01) {
          roomRipples.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = `${rip.color}${rip.alpha})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.stroke();

        // Segunda onda secundaria
        if (rip.r > 15) {
          ctx.strokeStyle = `${rip.color}${rip.alpha * 0.5})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r * 0.65, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Partículas ambientales en penumbra
      spaceParticles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        if (p.x > 4.2) p.x = -4.2; if (p.x < -4.2) p.x = 4.2;
        if (p.y > 1.2) p.y = -2.0; if (p.y < -2.0) p.y = 1.2;
        if (p.z > 5.4) p.z = -5.4; if (p.z < -5.4) p.z = 5.4;

        const glimmer = 0.35 + 0.65 * Math.sin(t * 2 + p.phase);
        const pp = project3D(p.x, p.y, p.z);
        if (!pp) return;
        const pr = Math.max(1, p.size * pp.sc * 14);
        ctx.fillStyle = `rgba(180, 215, 255, ${p.alpha * glimmer * lightVal})`;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, pr, 0, Math.PI * 2);
        ctx.fill();
      });

      // — PANTALLAS DIGITALES INTERACTIVAS CON ONDAS VISUALES —
      screens.forEach(sc => {
        const hw = sc.width / 2, hh = sc.height / 2;
        const corners = [
          project3D(sc.wx, sc.wy - hh, sc.wz - (sc.wx < 0 ? 0 : hw)),
          project3D(sc.wx, sc.wy - hh, sc.wz + (sc.wx < 0 ? hw : 0)),
          project3D(sc.wx, sc.wy + hh, sc.wz + (sc.wx < 0 ? hw : 0)),
          project3D(sc.wx, sc.wy + hh, sc.wz - (sc.wx < 0 ? 0 : hw))
        ].filter(Boolean);

        if (sc.id === 'screenC') {
          // Pantalla trasera plana
          const cornersC = [
            project3D(sc.wx - hw, sc.wy - hh, sc.wz),
            project3D(sc.wx + hw, sc.wy - hh, sc.wz),
            project3D(sc.wx + hw, sc.wy + hh, sc.wz),
            project3D(sc.wx - hw, sc.wy + hh, sc.wz)
          ].filter(Boolean);
          if (cornersC.length === 4) corners.splice(0, 4, ...cornersC);
        }

        if (corners.length < 4) return;

        const minX = Math.min(...corners.map(c=>c.x)), maxX = Math.max(...corners.map(c=>c.x));
        const minY = Math.min(...corners.map(c=>c.y)), maxY = Math.max(...corners.map(c=>c.y));
        const sw = maxX - minX, sh = maxY - minY;

        // Detección de Hover / Apuntado del Mouse sobre la pantalla
        const isHover = (currentMouseX >= minX && currentMouseX <= maxX && currentMouseY >= minY && currentMouseY <= maxY);
        sc.hovered = isHover;
        sc.hoverProgress += (isHover ? 1 : 0 - sc.hoverProgress) * 0.15;

        if (isHover) {
          sc.mouseRelX = (currentMouseX - minX) / sw;
          sc.mouseRelY = (currentMouseY - minY) / sh;

          // Generar ondas visuales continuas por movimiento de mouse
          if (ts - sc.lastTouch > 90) {
            sc.waves.push({ cx: sc.mouseRelX, cy: sc.mouseRelY, r: 0, alpha: 0.95 });
            sc.lastTouch = ts;
          }
        }

        // Borde y Fondo de la Pantalla
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        corners.forEach(c => ctx.lineTo(c.x, c.y));
        ctx.closePath();

        const screenBg = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
        screenBg.addColorStop(0, `rgba(6, 10, 20, ${0.94 - sc.hoverProgress * 0.2})`);
        screenBg.addColorStop(1, `rgba(12, 22, 40, ${0.9 - sc.hoverProgress * 0.1})`);
        ctx.fillStyle = screenBg;
        ctx.fill();

        ctx.strokeStyle = `rgba(180, 225, 255, ${0.3 + sc.hoverProgress * 0.65})`;
        ctx.lineWidth = 1.5 + sc.hoverProgress * 1.5;
        ctx.stroke();

        // Contenido Dinámico & Ondas dentro de la Pantalla
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        corners.forEach(c => ctx.lineTo(c.x, c.y));
        ctx.closePath();
        ctx.clip();

        // Partículas reactivas internas
        sc.particles.forEach(p => {
          p.x += p.vx * (1 + sc.hoverProgress * 2.5);
          p.y += p.vy * (1 + sc.hoverProgress * 2.5);
          if (p.x < 0 || p.x > 1) p.vx *= -1;
          if (p.y < 0 || p.y > 1) p.vy *= -1;

          const px2 = minX + p.x * sw, py2 = minY + p.y * sh;
          ctx.fillStyle = `rgba(190, 230, 255, ${0.15 + sc.hoverProgress * 0.65})`;
          ctx.beginPath();
          ctx.arc(px2, py2, Math.max(1, p.r * corners[0].sc * 16), 0, Math.PI * 2);
          ctx.fill();
        });

        // Ondas visuales internas expandiéndose (Ripples)
        sc.waves = sc.waves.filter(w => w.alpha > 0.01);
        sc.waves.forEach(w => {
          w.r += 2.2 * (1 + sc.hoverProgress);
          w.alpha *= 0.93;
          const wox = minX + w.cx * sw, woy = minY + w.cy * sh;
          ctx.strokeStyle = `rgba(180, 235, 255, ${w.alpha * (0.4 + sc.hoverProgress * 0.6)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(wox, woy, w.r, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Espectro de Ondas Sinusoidales en la pantalla
        ctx.beginPath();
        ctx.strokeStyle = `rgba(100, 255, 218, ${0.4 + sc.hoverProgress * 0.5})`;
        ctx.lineWidth = 1.2;
        for (let sx = 0; sx <= sw; sx += 4) {
          const normX = sx / sw;
          const distToMouse = Math.abs(normX - sc.mouseRelX);
          const amp = (sh * 0.18) * (1 + (1 - Math.min(1, distToMouse * 3)) * sc.hoverProgress * 2);
          const sy2 = minY + sh * 0.5 + Math.sin(normX * 12 + t * 4) * amp;
          if (sx === 0) ctx.moveTo(minX + sx, sy2);
          else ctx.lineTo(minX + sx, sy2);
        }
        ctx.stroke();

        // Texto de Estado en la Pantalla
        ctx.font = `600 ${Math.max(9, Math.round(10 * corners[0].sc))}px monospace`;
        ctx.fillStyle = sc.hovered ? '#64ffda' : 'rgba(180, 220, 255, 0.7)';
        ctx.fillText(sc.title, minX + 12, minY + 20);
        ctx.fillStyle = sc.hovered ? '#ffffff' : 'rgba(180, 220, 255, 0.4)';
        ctx.fillText(sc.hovered ? 'ESTADO: [ ONDAS EN CASCADA ]' : sc.subtitle, minX + 12, minY + 36);

        ctx.restore();
      });

      // — OBRA CENTRAL: ESCULTURA DE PENUMBRA Y LUZ —
      const rot2 = t * 0.75;
      for (let r = 0; r < 5; r++) {
        const ry = -0.35 + (r - 2) * 0.28;
        const rr = 0.48 + Math.sin(t * 1.3 + r) * 0.08;
        ctx.beginPath();
        let first2 = null;
        for (let s = 0; s <= 16; s++) {
          const ang = (s / 16) * Math.PI * 2 + rot2 * (r % 2 === 0 ? 1 : -1);
          const p = project3D(rr * Math.cos(ang), ry, rr * Math.sin(ang));
          if (p) {
            if (!first2) { first2 = p; ctx.moveTo(p.x, p.y); }
            else ctx.lineTo(p.x, p.y);
          }
        }
        const pulse = 0.5 + 0.45 * Math.sin(t * 2.2 + r);
        ctx.strokeStyle = r === 2 ? `rgba(255,255,255,${0.65 + pulse * 0.25})` : `rgba(200,225,255,${pulse * 0.45})`;
        ctx.lineWidth = r === 2 ? 2.2 : 1.1;
        ctx.stroke();
      }

      // Núcleo central brillante tenue
      const pCore = project3D(0, -0.35, 0);
      if (pCore) {
        const coreRad = Math.max(3, 14 * pCore.sc);
        const cg = ctx.createRadialGradient(pCore.x, pCore.y, 0, pCore.x, pCore.y, coreRad);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.4, 'rgba(180,220,255,0.7)');
        cg.addColorStop(1, 'rgba(180,220,255,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(pCore.x, pCore.y, coreRad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hotspot central proyectado
      if (pCore && hotspot) {
        hotspot.style.left = `${pCore.x}px`;
        hotspot.style.top = `${pCore.y}px`;
        hotspot.style.display = pCore.depth > 0.5 ? 'block' : 'none';
      }

      // Actualizar HUD Coordenadas
      if (coordX) coordX.textContent = camera.x.toFixed(1);
      if (coordZ) coordZ.textContent = camera.z.toFixed(1);
      if (coordAngle) {
        const deg = Math.round(((camera.yaw % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));
        coordAngle.textContent = `${deg}°`;
      }

      if (roomSound) galleryAudio.modulate(Math.hypot(camera.x, camera.z) / 5);

      drawMinimap();

      requestAnimationFrame(renderRoom);
    }
    requestAnimationFrame(renderRoom);

    // ── INTERACCIÓN CON EL MOUSE EN 3D Y GENERADOR DE ONDAS ────

    function enterPointerLock() {
      roomCanvas.requestPointerLock = roomCanvas.requestPointerLock || roomCanvas.mozRequestPointerLock;
      if (roomCanvas.requestPointerLock) {
        roomCanvas.requestPointerLock();
      }
    }

    if (btnFpsMode) {
      btnFpsMode.addEventListener('click', () => {
        if (!isPointerLocked) enterPointerLock();
        else document.exitPointerLock();
      });
    }

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mozpointerlockchange', handlePointerLockChange);

    function handlePointerLockChange() {
      isPointerLocked = (document.pointerLockElement === roomCanvas || document.mozPointerLockElement === roomCanvas);
      if (btnFpsMode) {
        btnFpsMode.classList.toggle('active', isPointerLocked);
        btnFpsMode.innerHTML = isPointerLocked ?
          '<span class="game-icon">🟢</span> MODO FPS ACTIVO (PULSA ESC PARA SALIR)' :
          '<span class="game-icon">🎮</span> MODO VIDEOJUEGO 3D (CLIC PARA ACTIVAR)';
      }
      if (fpsCrosshair) fpsCrosshair.classList.toggle('active', isPointerLocked);
      roomCanvas.style.cursor = isPointerLocked ? 'none' : 'crosshair';
    }

    // Movimiento del Mouse: Generar Ondas Visuales y Rotación de Cámara
    window.addEventListener('mousemove', e => {
      const rect = roomCanvas.getBoundingClientRect();
      currentMouseX = e.clientX - rect.left;
      currentMouseY = e.clientY - rect.top;

      // Emitir ondas visuales al mover el ratón sobre el canvas
      if (currentMouseX >= 0 && currentMouseX <= rect.width && currentMouseY >= 0 && currentMouseY <= rect.height) {
        const now = performance.now();
        if (now - lastRippleTime > 80) {
          addRoomRipple(currentMouseX, currentMouseY, 110, 'rgba(180,220,255,');
          lastRippleTime = now;
        }
      }

      if (isPointerLocked) {
        const sensitivity = 0.0032;
        camera.targetYaw   += e.movementX * sensitivity;
        camera.targetPitch  = Math.max(-0.45, Math.min(0.42, camera.targetPitch + e.movementY * (sensitivity * 0.8)));
      } else if (lookMode) {
        const dx = e.clientX - lastMX;
        const dy = e.clientY - lastMY;
        camera.targetYaw   += dx * 0.0055;
        camera.targetPitch  = Math.max(-0.45, Math.min(0.42, camera.targetPitch + dy * 0.004));
        lastMX = e.clientX;
        lastMY = e.clientY;
      }
    });

    roomCanvas.addEventListener('mousedown', e => {
      if (!isPointerLocked && e.button === 0) {
        lookMode = true;
        lastMX = e.clientX;
        lastMY = e.clientY;
        roomCanvas.style.cursor = 'grabbing';
      }

      if (isPointerLocked) {
        if (e.button === 0) mouseDownWalk = true;
        if (e.button === 2) mouseBackWalk = true;
      }

      // Emitir ráfaga de ondas al hacer clic
      const rect = roomCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      addRoomRipple(mx, my, 180, 'rgba(100,255,218,');
    });

    window.addEventListener('mouseup', e => {
      lookMode = false;
      if (!isPointerLocked) roomCanvas.style.cursor = 'crosshair';
      mouseDownWalk = false;
      mouseBackWalk = false;
    });

    roomCanvas.addEventListener('wheel', e => {
      e.preventDefault();
      const step = e.deltaY > 0 ? -0.32 : 0.32;
      const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      camera.vx += sy * step;
      camera.vz -= cy2 * step;
    }, { passive: false });

    roomCanvas.addEventListener('contextmenu', e => e.preventDefault());

    // Clics interactivos en la Sala 3D
    roomCanvas.addEventListener('click', e => {
      const rect = roomCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;

      // Comprobar clic en pantallas interactivas
      let screenClicked = false;
      screens.forEach(sc => {
        if (sc.hovered) {
          screenClicked = true;
          sc.waves.push({ cx: sc.mouseRelX, cy: sc.mouseRelY, r: 0, alpha: 0.98 });
          sc.particles.forEach(p => { p.target_a = 0.95; });
          sc.lastTouch = performance.now();
          if (galleryAudio) galleryAudio.playGlintChime(320 + Math.random() * 380);
          showToast(`Actividad en Pantalla: ${sc.title}`);
        }
      });

      // Comprobar clic en Puerta de Salida 3D únicamente si no se hizo clic en una pantalla
      if (!screenClicked) {
        const doorW = 1.3, doorH = 2.1;
        const dTL = project3D(-doorW/2, -doorH/2 + 0.15, -5.45);
        const dTR = project3D( doorW/2, -doorH/2 + 0.15, -5.45);
        const dBR = project3D( doorW/2,  1.18,           -5.45);
        const dBL = project3D(-doorW/2,  1.18,           -5.45);
        if (dTL && dTR && dBR && dBL) {
          const minDx = Math.min(dTL.x, dBL.x), maxDx = Math.max(dTR.x, dBR.x);
          const minDy = Math.min(dTL.y, dTR.y), maxDy = Math.max(dBL.y, dBR.y);
          if (mx >= minDx && mx <= maxDx && my >= minDy && my <= maxDy && camera.z > 1.8) {
            exitGalleryRoom();
          }
        }
      }
    });

    // D-Pad virtual
    function dpad(id, fn) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', fn);
    }
    dpad('dpadUp',    () => { const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw); camera.vx += sy * 0.45; camera.vz -= cy2 * 0.45; });
    dpad('dpadDown',  () => { const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw); camera.vx -= sy * 0.45; camera.vz += cy2 * 0.45; });
    dpad('dpadLeft',  () => { const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw); camera.vx -= cy2 * 0.45; camera.vz -= sy * 0.45; });
    dpad('dpadRight', () => { const cy2 = Math.cos(camera.yaw), sy = Math.sin(camera.yaw); camera.vx += cy2 * 0.45; camera.vz += sy * 0.45; });

    // Slider e Interruptores de Iluminación / Audio
    if (lightRange) lightRange.addEventListener('input', e => lightVal = parseFloat(e.target.value));
    if (lightSelect) lightSelect.addEventListener('change', e => lightMode = e.target.value);
    if (roomAudioBtn) roomAudioBtn.addEventListener('click', () => {
      const on = galleryAudio.toggle();
      roomSound = on; updateSoundUI(on);
      if (on) { roomAudioBtn.classList.add('active'); if(synthStatus) synthStatus.textContent='SINTETIZADOR EMITIENDO'; if(synthPulse) synthPulse.style.backgroundColor='#fff'; }
      else    { roomAudioBtn.classList.remove('active'); if(synthStatus) synthStatus.textContent='SINTETIZADOR EN ESPERA'; }
    });
  }

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
