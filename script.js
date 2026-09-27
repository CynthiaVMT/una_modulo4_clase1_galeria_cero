/**
 * GALERÍA CERO — SCRIPT PRINCIPAL
 * - Navegación fluida y menú móvil
 * - Motor de Audio Espacial y Ambiental (Web Audio API)
 * - Acceso 1 (Home): Carrusel Slider Animado
 * - Acceso 2 (Home): Escultura 360 en Canvas
 * - Acceso 3 (Home): Obra Interactiva con Destello Sutil reactivo al mouse
 * - Sección PICS: Carrusel Dinámico completo con filtros y Lightbox modal
 * - Sección 360°: Visor de escultura con rotación interactiva sobre punto fijo
 * - Sección L&S: Recorrido 3D en espacio de galería con giro orbital por mouse
 * - Validación y manejo de formulario de contacto
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     1. SISTEMA DE AUDIO AMBIENTAL Y SINTETIZADOR (WEB AUDIO API)
     ========================================================================== */
  class GalleryAudioEngine {
    constructor() {
      this.ctx = null;
      this.isPlaying = false;
      this.oscillators = [];
      this.gainNode = null;
      this.filterNode = null;
      this.isInitialized = false;
      this.customAudio = null;
      this.hasCustomAudio = false;
    }

    init() {
      if (this.isInitialized) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Nodo principal de ganancia y filtro analógico
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(450, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(4, this.ctx.currentTime);

        this.filterNode.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        // Soporte para archivo de audio local assets/audio/ambient.mp3
        this.customAudio = new Audio('assets/audio/ambient.mp3');
        this.customAudio.loop = true;
        this.customAudio.volume = 0.4;

        this.isInitialized = true;
      } catch (e) {
        console.warn('Web Audio API no soportado en este navegador:', e);
      }
    }

    toggle() {
      this.init();
      if (!this.ctx) return false;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      if (this.isPlaying) {
        this.stop();
        return false;
      } else {
        this.start();
        return true;
      }
    }

    start() {
      if (this.isPlaying) return;

      // 1. Intentar reproducir archivo local de usuario si está disponible
      if (this.customAudio) {
        const playPromise = this.customAudio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            this.hasCustomAudio = true;
            this.isPlaying = true;
          }).catch(() => {
            // Si el archivo no existe aún, activar el sintetizador generativo Web Audio API
            this.hasCustomAudio = false;
            this.startProceduralSynth();
          });
          return;
        }
      }

      this.startProceduralSynth();
    }

    startProceduralSynth() {
      if (!this.ctx) return;
      const freqs = [65.41, 98.00, 155.56, 233.08];
      this.oscillators = freqs.map((f, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);
        osc.detune.setValueAtTime((i - 1.5) * 4, this.ctx.currentTime);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.18 / freqs.length, this.ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(this.filterNode);
        osc.start();
        return osc;
      });

      this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 2);
      this.isPlaying = true;
    }

    stop() {
      if (!this.isPlaying) return;

      if (this.hasCustomAudio && this.customAudio) {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
        this.isPlaying = false;
        return;
      }

      if (this.ctx && this.gainNode) {
        this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);
        setTimeout(() => {
          this.oscillators.forEach(osc => {
            try { osc.stop(); osc.disconnect(); } catch (e) {}
          });
          this.oscillators = [];
          this.isPlaying = false;
        }, 1200);
      }
    }

    modulate(proximity, angle) {
      if (this.hasCustomAudio && this.customAudio) {
        // Modular volumen según distancia
        const targetVol = Math.max(0.15, Math.min(0.8, 1 - proximity * 0.5));
        this.customAudio.volume = targetVol;
        return;
      }

      if (!this.ctx || !this.isPlaying || !this.filterNode) return;
      const targetFreq = 250 + (1 - Math.min(1, Math.max(0, proximity))) * 1200;
      this.filterNode.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    playGlintChime(freq = 528) {
      this.init();
      // Intentar chime local si el usuario colocó chime.mp3
      const customChime = new Audio('assets/audio/chime.mp3');
      const chimePromise = customChime.play();
      if (chimePromise !== undefined) {
        chimePromise.catch(() => {
          this.playProceduralChime(freq);
        });
      } else {
        this.playProceduralChime(freq);
      }
    }

    playProceduralChime(freq) {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.5);
    }
  }

  const galleryAudio = new GalleryAudioEngine();

  // Control de sonido en la Navbar
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel = soundToggleBtn ? soundToggleBtn.querySelector('.sound-label') : null;

  function updateSoundUI(active) {
    if (!soundToggleBtn) return;
    if (active) {
      soundToggleBtn.classList.add('playing');
      if (soundLabel) soundLabel.textContent = 'AUDIO ON';
      showToast('Paisaje sonoro espacial activado');
    } else {
      soundToggleBtn.classList.remove('playing');
      if (soundLabel) soundLabel.textContent = 'AUDIO OFF';
      showToast('Audio en silencio');
    }
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      const isNowPlaying = galleryAudio.toggle();
      updateSoundUI(isNowPlaying);
    });
  }

  /* ==========================================================================
     2. NAVEGACIÓN, MENÚ MÓVIL Y TOAST NOTIFIER
     ========================================================================== */
  const mainNavbar = document.getElementById('mainNavbar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');
  const globalToast = document.getElementById('globalToast');
  const toastText = document.getElementById('toastText');
  let toastTimeout = null;

  function showToast(message) {
    if (!globalToast || !toastText) return;
    toastText.textContent = message;
    globalToast.classList.add('active');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      globalToast.classList.remove('active');
    }, 3200);
  }

  // Scroll navbar styling
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      mainNavbar.classList.add('scrolled');
    } else {
      mainNavbar.classList.remove('scrolled');
    }
    highlightCurrentSection();
  }, { passive: true });

  // Menú móvil hamburguesa
  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('mobile-open');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('mobile-open');
      });
    });
  }

  // Resaltado de enlaces según la sección visible
  const observedSections = document.querySelectorAll('section[id]');
  function highlightCurrentSection() {
    const scrollPos = window.scrollY + 200;
    observedSections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('data-nav') === id);
        });
      }
    });
  }

  /* ==========================================================================
     3. ACCESO DIRECTO 1 (HOME): CARRUSEL SLIDER ANIMADO
     ========================================================================== */
  const homeSlides = document.querySelectorAll('.home-slide');
  const homeSlideCurrent = document.getElementById('homeSlideCurrent');
  const homeSliderPrev = document.getElementById('homeSliderPrev');
  const homeSliderNext = document.getElementById('homeSliderNext');
  const homeCarouselModule = document.getElementById('homeDirectCarousel');
  let currentHomeSlide = 0;
  let homeAutoplayTimer = null;

  function showHomeSlide(idx) {
    if (!homeSlides.length) return;
    if (idx >= homeSlides.length) idx = 0;
    if (idx < 0) idx = homeSlides.length - 1;

    homeSlides.forEach((slide, i) => {
      slide.classList.toggle('active', i === idx);
    });

    currentHomeSlide = idx;
    if (homeSlideCurrent) {
      homeSlideCurrent.textContent = String(idx + 1).padStart(2, '0');
    }
  }

  function startHomeAutoplay() {
    stopHomeAutoplay();
    homeAutoplayTimer = setInterval(() => {
      showHomeSlide(currentHomeSlide + 1);
    }, 4000);
  }

  function stopHomeAutoplay() {
    if (homeAutoplayTimer) {
      clearInterval(homeAutoplayTimer);
      homeAutoplayTimer = null;
    }
  }

  if (homeSliderNext) {
    homeSliderNext.addEventListener('click', () => {
      showHomeSlide(currentHomeSlide + 1);
      startHomeAutoplay();
    });
  }

  if (homeSliderPrev) {
    homeSliderPrev.addEventListener('click', () => {
      showHomeSlide(currentHomeSlide - 1);
      startHomeAutoplay();
    });
  }

  if (homeCarouselModule) {
    homeCarouselModule.addEventListener('mouseenter', stopHomeAutoplay);
    homeCarouselModule.addEventListener('mouseleave', startHomeAutoplay);
  }

  startHomeAutoplay();

  /* ==========================================================================
     4. ACCESO DIRECTO 2 (HOME): ESCULTURA 360 ANIMADA EN CANVAS
     ========================================================================== */
  const homeCanvas = document.getElementById('homeSculptureCanvas');
  if (homeCanvas) {
    const ctx = homeCanvas.getContext('2d');
    let homeAngle = 0;
    let isDragging = false;
    let lastX = 0;

    function drawHomeSculpture() {
      const w = homeCanvas.width;
      const h = homeCanvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 20;
      const size = 130;

      ctx.save();
      ctx.translate(cx, cy);

      // Rotación continua
      const cosA = Math.cos(homeAngle);
      const sinA = Math.sin(homeAngle);

      // Definición de vértices de un prisma monolítico elegante
      const vertices = [
        { x: -0.6 * size * cosA, y: -size, z: -0.6 * size * sinA },
        { x: 0.6 * size * cosA, y: -size, z: 0.6 * size * sinA },
        { x: 0.9 * size * cosA, y: size, z: 0.9 * size * sinA },
        { x: -0.9 * size * cosA, y: size, z: -0.9 * size * sinA },
        { x: 0, y: -size * 1.35, z: 0 },
        { x: 0, y: size * 1.15, z: 0 }
      ];

      // Proyección isométrica/perspectiva y sombreado monocromático
      const faces = [
        { pts: [0, 1, 4], light: 0.85 + 0.3 * sinA },
        { pts: [1, 2, 5], light: 0.55 - 0.2 * cosA },
        { pts: [2, 3, 5], light: 0.35 + 0.3 * cosA },
        { pts: [3, 0, 4], light: 0.7 - 0.25 * sinA },
        { pts: [0, 1, 2, 3], light: 0.5 }
      ];

      faces.sort((a, b) => b.light - a.light);

      faces.forEach(face => {
        ctx.beginPath();
        const first = vertices[face.pts[0]];
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < face.pts.length; i++) {
          const pt = vertices[face.pts[i]];
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        const l = Math.min(255, Math.max(20, Math.floor(face.light * 200)));
        ctx.fillStyle = `rgb(${l}, ${l}, ${l})`;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // Anillo orbital luminoso sutil
      ctx.beginPath();
      ctx.ellipse(0, size * 0.95, size * 1.3, size * 0.35, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();

      if (!isDragging) {
        homeAngle += 0.015;
      }
      requestAnimationFrame(drawHomeSculpture);
    }

    drawHomeSculpture();

    // Permite interacción directa con el mouse también en el home
    homeCanvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      homeAngle += dx * 0.015;
    });

    // Touch para móviles
    homeCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - lastX;
      lastX = e.touches[0].clientX;
      homeAngle += dx * 0.015;
    }, { passive: true });

    window.addEventListener('touchend', () => { isDragging = false; });
  }

  /* ==========================================================================
     5. ACCESO DIRECTO 3 (HOME): OBRA INTERACTIVA CON DESTELLO SUTIL AL HOVER
     ========================================================================== */
  const glowWrapper = document.getElementById('glowCardWrapper');
  const subtleFlare = document.getElementById('subtleFlare');
  const interactiveCanvas = document.getElementById('interactiveCanvasOverlay');
  const previewToneBtn = document.getElementById('previewToneBtn');

  if (glowWrapper && subtleFlare) {
    let flareRaf = null;

    glowWrapper.addEventListener('mousemove', (e) => {
      const rect = glowWrapper.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      if (flareRaf) cancelAnimationFrame(flareRaf);
      flareRaf = requestAnimationFrame(() => {
        subtleFlare.style.setProperty('--glow-x', `${x}%`);
        subtleFlare.style.setProperty('--glow-y', `${y}%`);
      });
    });

    glowWrapper.addEventListener('mouseenter', () => {
      // Al pasar el mouse, generar sutil destello de partículas
      drawInteractiveField(true);
    });

    glowWrapper.addEventListener('mouseleave', () => {
      drawInteractiveField(false);
    });
  }

  // Efecto de filamentos lumínicos reactivos dentro del canvas overlay
  let particlesActive = false;
  function drawInteractiveField(activate) {
    if (!interactiveCanvas) return;
    particlesActive = activate;
    if (!activate) return;

    const ctx = interactiveCanvas.getContext('2d');
    interactiveCanvas.width = interactiveCanvas.parentElement.clientWidth;
    interactiveCanvas.height = interactiveCanvas.parentElement.clientHeight;

    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * interactiveCanvas.width,
      y: Math.random() * interactiveCanvas.height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      rad: Math.random() * 2 + 1,
      alpha: Math.random() * 0.7 + 0.3
    }));

    function loop() {
      if (!particlesActive) {
        ctx.clearRect(0, 0, interactiveCanvas.width, interactiveCanvas.height);
        return;
      }
      ctx.clearRect(0, 0, interactiveCanvas.width, interactiveCanvas.height);

      // Dibujar filamentos
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 90) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - dist / 90)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > interactiveCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > interactiveCanvas.height) p.vy *= -1;

        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.rad, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(loop);
    }
    loop();
  }

  // Botón para probar sonido con destello acústico
  if (previewToneBtn) {
    previewToneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      galleryAudio.playGlintChime(440);
      showToast('Frecuencia resonante: 440 Hz (La Natural)');
    });
  }

  /* ==========================================================================
     6. PÁGINA INTERNA 1: SECCIÓN PICS (CARRUSEL DINÁMICO & LIGHTBOX)
     ========================================================================== */
  const picsTrack = document.getElementById('picsTrack');
  const picsItems = document.querySelectorAll('.carousel-item');
  const picsPrevBtn = document.getElementById('picsPrevBtn');
  const picsNextBtn = document.getElementById('picsNextBtn');
  const picsCurrentDisplay = document.getElementById('picsCurrentDisplay');
  const picsTotalDisplay = document.getElementById('picsTotalDisplay');
  const picsProgressBar = document.getElementById('picsProgressBar');
  const picsThumbStrip = document.getElementById('picsThumbStrip');
  const picsAutoplayBtn = document.getElementById('picsAutoplayBtn');
  const filterTabs = document.querySelectorAll('.filter-tab');

  let curPicsIndex = 0;
  let picsAutoplay = true;
  let picsTimer = null;
  let visiblePicsItems = Array.from(picsItems);

  // Inicializar Thumbnails en la barra inferior
  function initThumbnails() {
    if (!picsThumbStrip) return;
    picsThumbStrip.innerHTML = '';
    visiblePicsItems.forEach((item, index) => {
      const img = item.querySelector('img');
      const thumb = document.createElement('div');
      thumb.className = `thumb-item ${index === curPicsIndex ? 'active' : ''}`;
      thumb.innerHTML = `<img src="${img.src}" alt="${img.alt}">`;
      thumb.addEventListener('click', () => {
        goToPicsSlide(index);
        resetPicsAutoplay();
      });
      picsThumbStrip.appendChild(thumb);
    });
  }

  function updatePicsUI() {
    if (!visiblePicsItems.length || !picsTrack) return;
    const progressPercent = ((curPicsIndex + 1) / visiblePicsItems.length) * 100;
    if (picsProgressBar) picsProgressBar.style.width = `${progressPercent}%`;

    if (picsCurrentDisplay) {
      picsCurrentDisplay.textContent = String(curPicsIndex + 1).padStart(2, '0');
    }
    if (picsTotalDisplay) {
      picsTotalDisplay.textContent = String(visiblePicsItems.length).padStart(2, '0');
    }

    picsTrack.style.transform = `translateX(-${curPicsIndex * 100}%)`;

    // Actualizar thumbnails activos
    const thumbs = document.querySelectorAll('.thumb-item');
    thumbs.forEach((th, i) => th.classList.toggle('active', i === curPicsIndex));
  }

  function goToPicsSlide(index) {
    if (index >= visiblePicsItems.length) index = 0;
    if (index < 0) index = visiblePicsItems.length - 1;
    curPicsIndex = index;
    updatePicsUI();
  }

  function resetPicsAutoplay() {
    if (picsTimer) clearInterval(picsTimer);
    if (picsAutoplay && visiblePicsItems.length > 1) {
      picsTimer = setInterval(() => {
        goToPicsSlide(curPicsIndex + 1);
      }, 5000);
    }
  }

  if (picsNextBtn) {
    picsNextBtn.addEventListener('click', () => {
      goToPicsSlide(curPicsIndex + 1);
      resetPicsAutoplay();
    });
  }

  if (picsPrevBtn) {
    picsPrevBtn.addEventListener('click', () => {
      goToPicsSlide(curPicsIndex - 1);
      resetPicsAutoplay();
    });
  }

  if (picsAutoplayBtn) {
    picsAutoplayBtn.addEventListener('click', () => {
      picsAutoplay = !picsAutoplay;
      picsAutoplayBtn.classList.toggle('active', picsAutoplay);
      const symbol = picsAutoplayBtn.querySelector('.status-symbol');
      if (symbol) symbol.textContent = picsAutoplay ? '❚❚' : '▶';
      resetPicsAutoplay();
    });
  }

  // Filtros de categoría de fotografía
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.getAttribute('data-filter');
      picsItems.forEach(item => {
        if (filter === 'all' || item.getAttribute('data-category') === filter) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });

      visiblePicsItems = Array.from(picsItems).filter(item => item.style.display !== 'none');
      curPicsIndex = 0;
      initThumbnails();
      updatePicsUI();
      resetPicsAutoplay();
    });
  });

  initThumbnails();
  updatePicsUI();
  resetPicsAutoplay();

  /* ==========================================================================
     7. MODAL LIGHTBOX PARA INSPECCIÓN DE FOTOGRAFÍAS
     ========================================================================== */
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxArtist = document.getElementById('lightboxArtist');
  const lightboxCategory = document.getElementById('lightboxCategory');
  const lightboxYear = document.getElementById('lightboxYear');
  const lightboxCamera = document.getElementById('lightboxCamera');
  const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
  const lightboxNextBtn = document.getElementById('lightboxNextBtn');

  function openLightbox(item) {
    if (!lightboxModal || !item) return;
    const img = item.querySelector('img');
    if (lightboxImg) lightboxImg.src = img.src;
    if (lightboxTitle) lightboxTitle.textContent = item.getAttribute('data-title') || 'Obra Fotográfica';
    if (lightboxArtist) lightboxArtist.textContent = item.getAttribute('data-artist') || 'Artista';
    if (lightboxCategory) lightboxCategory.textContent = (item.getAttribute('data-category') || 'FOTOGRAFÍA').toUpperCase();
    if (lightboxYear) lightboxYear.textContent = item.getAttribute('data-year') || '2024';
    if (lightboxCamera) lightboxCamera.textContent = item.getAttribute('data-camera') || 'Formato Medio';

    lightboxModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Asignar clic de inspección a cada tarjeta de fotografía
  picsItems.forEach((item, index) => {
    const btn = item.querySelector('.btn-inspect');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        curPicsIndex = index;
        openLightbox(item);
      });
    }
    const card = item.querySelector('.carousel-card');
    if (card) {
      card.addEventListener('click', () => {
        curPicsIndex = index;
        openLightbox(item);
      });
    }
  });

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (lightboxModal && lightboxModal.classList.contains('active')) {
      if (e.key === 'ArrowRight') {
        goToPicsSlide(curPicsIndex + 1);
        openLightbox(visiblePicsItems[curPicsIndex]);
      } else if (e.key === 'ArrowLeft') {
        goToPicsSlide(curPicsIndex - 1);
        openLightbox(visiblePicsItems[curPicsIndex]);
      }
    }
  });

  if (lightboxPrevBtn) {
    lightboxPrevBtn.addEventListener('click', () => {
      goToPicsSlide(curPicsIndex - 1);
      openLightbox(visiblePicsItems[curPicsIndex]);
    });
  }

  if (lightboxNextBtn) {
    lightboxNextBtn.addEventListener('click', () => {
      goToPicsSlide(curPicsIndex + 1);
      openLightbox(visiblePicsItems[curPicsIndex]);
    });
  }

  /* ==========================================================================
     8. PÁGINA INTERNA 2: SECCIÓN 360 (ROTACIÓN SOBRE PUNTO FIJO)
     ========================================================================== */
  const canvas360 = document.getElementById('canvas360');
  const angleDegree = document.getElementById('angleDegree');
  const toggle360AutoBtn = document.getElementById('toggle360AutoBtn');
  const autoRotateIcon = document.getElementById('autoRotateIcon');
  const reset360Btn = document.getElementById('reset360Btn');
  const speedSlider = document.getElementById('speedSlider');
  const wireframeToggleBtn = document.getElementById('wireframeToggleBtn');
  const sculptureTabs = document.querySelectorAll('.sculpture-tab-btn');
  const sculptureNameLabel = document.getElementById('sculptureNameLabel');

  if (canvas360) {
    const ctx = canvas360.getContext('2d');
    let currentModel = 'monolith';
    let angleY = 0;
    let angleX = 0.15; // Ligera inclinación para perspectiva tridimensional
    let autoRotate = true;
    let rotateSpeed = 1;
    let wireframeMode = false;
    let isDragging360 = false;
    let startX = 0, startY = 0;
    let velocityX = 0;

    // Generador de geometrías según el modelo elegido
    function getModelGeometry(type) {
      if (type === 'prism') {
        // Prisma fractal torsonado
        const height = 180;
        const radius = 90;
        const levels = 6;
        const vertices = [];
        const edges = [];

        for (let i = 0; i <= levels; i++) {
          const y = -height / 2 + (i / levels) * height;
          const twist = (i / levels) * Math.PI;
          const r = radius * (1 - 0.25 * Math.sin((i / levels) * Math.PI));
          for (let j = 0; j < 4; j++) {
            const th = twist + (j * Math.PI) / 2;
            vertices.push({ x: r * Math.cos(th), y: y, z: r * Math.sin(th) });
          }
        }

        for (let i = 0; i < levels; i++) {
          const base = i * 4;
          const next = (i + 1) * 4;
          for (let j = 0; j < 4; j++) {
            const jNext = (j + 1) % 4;
            edges.push([base + j, base + jNext]);
            edges.push([base + j, next + j]);
            edges.push([base + j, next + jNext]);
          }
        }
        return { vertices, edges, isMesh: true };
      } else if (type === 'sphere') {
        // Esfera geodésica / icosaedro subdividido
        const t = (1.0 + Math.sqrt(5.0)) / 2.0;
        const r = 100;
        let v = [
          [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
          [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
          [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
        ].map(pt => {
          const len = Math.sqrt(pt[0]*pt[0] + pt[1]*pt[1] + pt[2]*pt[2]);
          return { x: (pt[0]/len)*r, y: (pt[1]/len)*r, z: (pt[2]/len)*r };
        });

        const edges = [
          [0,11],[0,5],[0,1],[0,7],[0,10],[1,5],[5,11],[11,10],[10,7],[7,1],
          [3,9],[3,4],[3,2],[3,6],[3,8],[4,9],[9,8],[8,6],[6,2],[2,4],
          [5,9],[5,4],[11,4],[11,2],[10,2],[10,6],[7,6],[7,8],[1,8],[1,9]
        ];
        return { vertices: v, edges, isMesh: true };
      } else {
        // Monolito Obsidiana (Facetas piramidales y aristas agudas)
        const s = 100;
        const vertices = [
          { x: -s*0.5, y: -s*1.2, z: -s*0.5 },
          { x: s*0.5, y: -s*1.2, z: -s*0.5 },
          { x: s*0.6, y: -s*0.3, z: s*0.6 },
          { x: -s*0.6, y: -s*0.3, z: s*0.6 },
          { x: -s*0.8, y: s*1.3, z: -s*0.8 },
          { x: s*0.8, y: s*1.3, z: -s*0.8 },
          { x: s*0.9, y: s*1.5, z: s*0.9 },
          { x: -s*0.9, y: s*1.5, z: s*0.9 },
          { x: 0, y: -s*1.7, z: 0 }, // Cúspide
          { x: 0, y: s*1.6, z: 0 }    // Base
        ];

        const edges = [
          [8,0],[8,1],[8,2],[8,3],
          [0,1],[1,2],[2,3],[3,0],
          [0,4],[1,5],[2,6],[3,7],
          [4,5],[5,6],[6,7],[7,4],
          [9,4],[9,5],[9,6],[9,7]
        ];

        const faces = [
          [8, 0, 1], [8, 1, 2], [8, 2, 3], [8, 3, 0],
          [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
          [9, 4, 5], [9, 5, 6], [9, 6, 7], [9, 7, 4]
        ];

        return { vertices, edges, faces, isMesh: false };
      }
    }

    function render360() {
      const w = canvas360.width;
      const h = canvas360.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 - 10;
      const geom = getModelGeometry(currentModel);

      // Rotaciones 3D
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const projVertices = geom.vertices.map(v => {
        // Rotar sobre eje Y (rotación horizontal alrededor de sí misma)
        const x1 = v.x * cosY + v.z * sinY;
        const z1 = -v.x * sinY + v.z * cosY;
        // Rotar sobre eje X (inclinación perspectiva)
        const y2 = v.y * cosX - z1 * sinX;
        const z2 = v.y * sinX + z1 * cosX;

        // Perspectiva de cámara
        const fov = 500;
        const scale = fov / (fov + z2 + 250);
        return {
          x: cx + x1 * scale,
          y: cy + y2 * scale,
          z: z2,
          scale: scale
        };
      });

      // Renderizado según modo (Wireframe o Sólido Shaded)
      if (geom.faces && !wireframeMode) {
        // Ordenar facetas por profundidad z (Painter's algorithm)
        const sortedFaces = geom.faces.map(indices => {
          let avgZ = 0;
          indices.forEach(idx => { avgZ += projVertices[idx].z; });
          avgZ /= indices.length;

          // Vector normal aproximado para iluminación dinámica
          const p0 = projVertices[indices[0]];
          const p1 = projVertices[indices[1]];
          const p2 = projVertices[indices[2]];
          const vax = p1.x - p0.x, vay = p1.y - p0.y;
          const vbx = p2.x - p0.x, vby = p2.y - p0.y;
          const cross = vax * vby - vay * vbx;

          return { indices, z: avgZ, normal: cross };
        }).sort((a, b) => b.z - a.z);

        sortedFaces.forEach(f => {
          if (f.normal > -100) { // Culling de facetas traseras
            ctx.beginPath();
            ctx.moveTo(projVertices[f.indices[0]].x, projVertices[f.indices[0]].y);
            for (let i = 1; i < f.indices.length; i++) {
              ctx.lineTo(projVertices[f.indices[i]].x, projVertices[f.indices[i]].y);
            }
            ctx.closePath();

            // Iluminación monocromática pulida de galería
            const lightIntensity = Math.min(240, Math.max(25, Math.floor(120 + f.normal * 0.015)));
            ctx.fillStyle = `rgb(${lightIntensity}, ${lightIntensity}, ${lightIntensity})`;
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      } else {
        // Modo Wireframe estructurado
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.2;
        geom.edges.forEach(edge => {
          const p1 = projVertices[edge[0]];
          const p2 = projVertices[edge[1]];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });

        // Nodos luminosos en los vértices
        projVertices.forEach(pt => {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5 * pt.scale, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Actualizar HUD de grados de ángulo
      if (angleDegree) {
        let deg = Math.round(((angleY % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));
        angleDegree.textContent = `${deg}°`;
      }

      // Física de inercia y auto-rotación continua
      if (autoRotate && !isDragging360) {
        angleY += 0.008 * rotateSpeed;
      } else if (!isDragging360 && Math.abs(velocityX) > 0.0001) {
        angleY += velocityX;
        velocityX *= 0.94; // Fricción de desaceleración
      }

      requestAnimationFrame(render360);
    }

    render360();

    // Eventos de arrastre con mouse sobre el canvas 360
    canvas360.addEventListener('mousedown', (e) => {
      isDragging360 = true;
      startX = e.clientX;
      startY = e.clientY;
      velocityX = 0;
    });

    window.addEventListener('mouseup', () => {
      isDragging360 = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging360) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      velocityX = dx * 0.008;
      angleY += velocityX;
      // Inclinación vertical restringida
      angleX = Math.max(-0.4, Math.min(0.4, angleX + dy * 0.004));
    });

    // Touch en móviles
    canvas360.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging360 = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        velocityX = 0;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging360 || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      velocityX = dx * 0.008;
      angleY += velocityX;
      angleX = Math.max(-0.4, Math.min(0.4, angleX + dy * 0.004));
    }, { passive: true });

    window.addEventListener('touchend', () => { isDragging360 = false; });

    // Controles de barra
    if (toggle360AutoBtn) {
      toggle360AutoBtn.addEventListener('click', () => {
        autoRotate = !autoRotate;
        toggle360AutoBtn.classList.toggle('active', autoRotate);
        if (autoRotateIcon) autoRotateIcon.textContent = autoRotate ? '❚❚' : '▶';
        showToast(autoRotate ? 'Auto-rotación activada' : 'Control manual activo');
      });
    }

    if (reset360Btn) {
      reset360Btn.addEventListener('click', () => {
        angleY = 0;
        angleX = 0.15;
        velocityX = 0;
        showToast('Vista 360° reiniciada');
      });
    }

    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        rotateSpeed = parseFloat(e.target.value);
      });
    }

    if (wireframeToggleBtn) {
      wireframeToggleBtn.addEventListener('click', () => {
        wireframeMode = !wireframeMode;
        wireframeToggleBtn.classList.toggle('active', wireframeMode);
        showToast(wireframeMode ? 'Modo Estructura Wireframe' : 'Modo Sólido Shaded');
      });
    }

    // Selector de esculturas
    sculptureTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        sculptureTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentModel = tab.getAttribute('data-sculpture');

        if (sculptureNameLabel) {
          const names = {
            monolith: 'MONOLITO OBSIDIANA // 2026',
            prism: 'PRISMA FRACTAL // 2025',
            sphere: 'ESFERA GEODÉSICA // 2024'
          };
          sculptureNameLabel.textContent = names[currentModel] || 'ESCULTURA 360°';
        }
        showToast(`Escultura: ${tab.textContent.trim()}`);
      });
    });
  }

  /* ==========================================================================
     9. PÁGINA INTERNA 3: SECCIÓN L&S (LUZ & SONIDO - RECORRER ESPACIO CON MOUSE)
     ========================================================================== */
  const roomCanvas = document.getElementById('virtualRoomCanvas');
  const coordX = document.getElementById('coordX');
  const coordZ = document.getElementById('coordZ');
  const coordAngle = document.getElementById('coordAngle');
  const lightIntensityRange = document.getElementById('lightIntensityRange');
  const spotlightColorSelect = document.getElementById('spotlightColorSelect');
  const audioAmbientRoomBtn = document.getElementById('audioAmbientRoomBtn');
  const synthPulse = document.getElementById('synthPulse');
  const synthStatusText = document.getElementById('synthStatusText');
  const hotspotCenter = document.getElementById('hotspotCenter');

  if (roomCanvas) {
    const ctx = roomCanvas.getContext('2d');

    // Estado del observador en la galería 3D
    const camera = {
      x: 0,
      y: 0,
      z: 3.5, // Distancia focal al centro
      yaw: 0,   // Giro horizontal (360 alrededor de la obra)
      pitch: 0  // Inclinación vertical
    };

    let isMouseLooking = false;
    let lastMouseX = 0, lastMouseY = 0;
    let lightIntensity = 0.6;
    let lightColorMode = 'pure-white';
    let roomSoundActive = false;

    // Redimensionar canvas de acuerdo al contenedor
    function resizeRoomCanvas() {
      roomCanvas.width = roomCanvas.parentElement.clientWidth;
      roomCanvas.height = roomCanvas.parentElement.clientHeight;
    }
    resizeRoomCanvas();
    window.addEventListener('resize', resizeRoomCanvas);

    // Motor de renderizado en perspectiva de la sala de la galería
    function renderGalleryRoom() {
      const w = roomCanvas.width;
      const h = roomCanvas.height;
      ctx.clearRect(0, 0, w, h);

      const fov = 420;
      const cx = w / 2;
      const cy = h / 2;

      // Transformación de punto 3D del mundo a 2D en pantalla
      function project3D(px, py, pz) {
        // Traslación relativa a la cámara
        let rx = px - camera.x;
        let ry = py - camera.y;
        let rz = pz - camera.z;

        // Rotación Yaw (Giro horizontal alrededor de la obra)
        const cosYaw = Math.cos(camera.yaw);
        const sinYaw = Math.sin(camera.yaw);
        const x1 = rx * cosYaw + rz * sinYaw;
        const z1 = -rx * sinYaw + rz * cosYaw;

        // Rotación Pitch (Inclinación vertical)
        const cosPitch = Math.cos(camera.pitch);
        const sinPitch = Math.sin(camera.pitch);
        const y2 = ry * cosPitch - z1 * sinPitch;
        const z2 = ry * sinPitch + z1 * cosPitch;

        if (z2 <= 0.1) return null; // Detrás de la cámara

        const scale = fov / z2;
        return {
          x: cx + x1 * scale,
          y: cy + y2 * scale,
          scale: scale,
          depth: z2
        };
      }

      // Fondo de la sala (Penumbras de museo contemporáneo)
      const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(w, h));
      if (lightColorMode === 'warm-noir') {
        grad.addColorStop(0, `rgba(45, 45, 45, ${lightIntensity})`);
        grad.addColorStop(1, '#050505');
      } else if (lightColorMode === 'deep-contrast') {
        grad.addColorStop(0, `rgba(30, 30, 30, ${lightIntensity * 0.8})`);
        grad.addColorStop(1, '#000000');
      } else {
        grad.addColorStop(0, `rgba(55, 55, 60, ${lightIntensity})`);
        grad.addColorStop(1, '#070707');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Dibujar suelo de hormigón pulido con cuadrícula de perspectiva
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 * lightIntensity})`;
      ctx.lineWidth = 1;

      // Líneas longitudinales del suelo
      for (let gx = -4; gx <= 4; gx += 1) {
        const pStart = project3D(gx, 1.2, -4);
        const pEnd = project3D(gx, 1.2, 5);
        if (pStart && pEnd) {
          ctx.beginPath();
          ctx.moveTo(pStart.x, pStart.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
        }
      }

      // Líneas transversales del suelo
      for (let gz = -4; gz <= 5; gz += 1) {
        const pLeft = project3D(-4, 1.2, gz);
        const pRight = project3D(4, 1.2, gz);
        if (pLeft && pRight) {
          ctx.beginPath();
          ctx.moveTo(pLeft.x, pLeft.y);
          ctx.lineTo(pRight.x, pRight.y);
          ctx.stroke();
        }
      }

      // Obras fotográficas en los muros laterales de la galería
      function drawWallArtwork(x, z, width, height, title) {
        const p0 = project3D(x, -height/2, z - width/2);
        const p1 = project3D(x, -height/2, z + width/2);
        const p2 = project3D(x, height/2, z + width/2);
        const p3 = project3D(x, height/2, z - width/2);

        if (p0 && p1 && p2 && p3) {
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(240, 240, 240, 0.85)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.stroke();
        }
      }

      drawWallArtwork(-3.8, 0, 1.6, 1.1, 'Muro Oeste');
      drawWallArtwork(3.8, 0, 1.6, 1.1, 'Muro Este');

      // Haz de luz cenital (Spotlight central en cono)
      const spotApex = project3D(0, -3.2, 0);
      const spotBase1 = project3D(-1.2, 1.2, -1.2);
      const spotBase2 = project3D(1.2, 1.2, 1.2);
      if (spotApex && spotBase1 && spotBase2) {
        const spotGrad = ctx.createLinearGradient(spotApex.x, spotApex.y, (spotBase1.x + spotBase2.x)/2, (spotBase1.y + spotBase2.y)/2);
        spotGrad.addColorStop(0, `rgba(255, 255, 255, ${0.4 * lightIntensity})`);
        spotGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.moveTo(spotApex.x, spotApex.y);
        ctx.lineTo(spotBase1.x, spotBase1.y);
        ctx.lineTo(spotBase2.x, spotBase2.y);
        ctx.closePath();
        ctx.fill();
      }

      // OBRA CENTRAL: INSTALACIÓN LUMÍNICA & ESCULTURA GEOMÉTRICA
      const time = performance.now() * 0.0015;
      const sculptureHeight = 1.0;
      const rot = time * 0.8;

      // Pedestal monolítico en el centro (0, 0)
      const pedTop = project3D(0, 0.4, 0);
      const pedBottom = project3D(0, 1.2, 0);
      if (pedTop && pedBottom) {
        ctx.fillStyle = 'rgba(20, 20, 22, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        const radius = 35 * pedTop.scale;
        ctx.beginPath();
        ctx.ellipse(pedTop.x, pedTop.y, radius, radius * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Escultura flotante que pulsa y gira
      const numRings = 4;
      for (let r = 0; r < numRings; r++) {
        const ringY = -0.3 + (r - 1.5) * 0.25;
        const ringRad = 0.5 + Math.sin(time + r) * 0.08;
        const segments = 12;

        ctx.beginPath();
        let firstPt = null;
        for (let s = 0; s <= segments; s++) {
          const ang = (s / segments) * Math.PI * 2 + rot * (r % 2 === 0 ? 1 : -1);
          const px = ringRad * Math.cos(ang);
          const pz = ringRad * Math.sin(ang);
          const p = project3D(px, ringY, pz);
          if (p) {
            if (!firstPt) { firstPt = p; ctx.moveTo(p.x, p.y); }
            else { ctx.lineTo(p.x, p.y); }
          }
        }
        ctx.strokeStyle = r === 1 ? '#ffffff' : `rgba(255, 255, 255, ${0.4 + 0.4 * Math.sin(time + r)})`;
        ctx.lineWidth = r === 1 ? 2 : 1.2;
        ctx.stroke();
      }

      // Proyectar hotspot central
      const centerProj = project3D(0, -0.4, 0);
      if (centerProj && hotspotCenter) {
        hotspotCenter.style.left = `${centerProj.x}px`;
        hotspotCenter.style.top = `${centerProj.y}px`;
        hotspotCenter.style.display = centerProj.depth > 0.5 ? 'block' : 'none';
      }

      // Actualizar HUD numérico de coordenadas
      if (coordX) coordX.textContent = camera.x.toFixed(1);
      if (coordZ) coordZ.textContent = camera.z.toFixed(1);
      if (coordAngle) {
        const deg = Math.round(((camera.yaw % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));
        coordAngle.textContent = `${deg}°`;
      }

      // Modulación sonora basada en la distancia a la obra central
      const distanceToCenter = Math.sqrt(camera.x * camera.x + camera.z * camera.z);
      if (roomSoundActive) {
        galleryAudio.modulate(distanceToCenter / 5, camera.yaw);
      }

      requestAnimationFrame(renderGalleryRoom);
    }

    renderGalleryRoom();

    // INTERACCIÓN CON EL MOUSE: Girar alrededor de la obra con el mouse
    roomCanvas.addEventListener('mousedown', (e) => {
      isMouseLooking = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => { isMouseLooking = false; });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseLooking) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // El usuario gira alrededor del espacio de la galería
      camera.yaw += dx * 0.007;
      camera.pitch = Math.max(-0.4, Math.min(0.35, camera.pitch + dy * 0.004));
    });

    // Control de paso/caminar por teclado (W, A, S, D y Flechas)
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      const step = 0.18;
      const cosYaw = Math.cos(camera.yaw);
      const sinYaw = Math.sin(camera.yaw);

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          // Caminar hacia adelante
          camera.x += sinYaw * step;
          camera.z -= cosYaw * step;
          break;
        case 's':
        case 'arrowdown':
          // Retroceder
          camera.x -= sinYaw * step;
          camera.z += cosYaw * step;
          break;
        case 'a':
        case 'arrowleft':
          // Desplazar izquierda
          camera.x -= cosYaw * step;
          camera.z -= sinYaw * step;
          break;
        case 'd':
        case 'arrowright':
          // Desplazar derecha
          camera.x += cosYaw * step;
          camera.z += sinYaw * step;
          break;
      }

      // Restricción de límites de la sala para que no se salga de las paredes
      camera.x = Math.max(-3.5, Math.min(3.5, camera.x));
      camera.z = Math.max(-3.5, Math.min(5.0, camera.z));
    });

    // Botones de D-pad en pantalla para dispositivos móviles o clics
    function attachDpad(btnId, moveAction) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        moveAction();
      });
    }

    attachDpad('dpadUp', () => {
      const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
      camera.x += sinYaw * 0.4; camera.z -= cosYaw * 0.4;
    });
    attachDpad('dpadDown', () => {
      const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
      camera.x -= sinYaw * 0.4; camera.z += cosYaw * 0.4;
    });
    attachDpad('dpadLeft', () => {
      const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
      camera.x -= cosYaw * 0.4; camera.z -= sinYaw * 0.4;
    });
    attachDpad('dpadRight', () => {
      const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
      camera.x += cosYaw * 0.4; camera.z += sinYaw * 0.4;
    });

    // Controles de entorno de la sala
    if (lightIntensityRange) {
      lightIntensityRange.addEventListener('input', (e) => {
        lightIntensity = parseFloat(e.target.value);
      });
    }

    if (spotlightColorSelect) {
      spotlightColorSelect.addEventListener('change', (e) => {
        lightColorMode = e.target.value;
      });
    }

    if (audioAmbientRoomBtn) {
      audioAmbientRoomBtn.addEventListener('click', () => {
        const isPlaying = galleryAudio.toggle();
        roomSoundActive = isPlaying;
        updateSoundUI(isPlaying);
        if (isPlaying) {
          audioAmbientRoomBtn.classList.add('active');
          if (synthStatusText) synthStatusText.textContent = 'SINTETIZADOR EMITIENDO EN VIVO';
          if (synthPulse) synthPulse.style.backgroundColor = '#ffffff';
        } else {
          audioAmbientRoomBtn.classList.remove('active');
          if (synthStatusText) synthStatusText.textContent = 'SINTETIZADOR EN ESPERA';
        }
      });
    }
  }

  /* ==========================================================================
     10. PÁGINA: FORMULARIO DE CONTACTO & VALIDACIÓN
     ========================================================================== */
  const contactForm = document.getElementById('contactForm');
  const formSuccessMessage = document.getElementById('formSuccessMessage');
  const btnDismissSuccess = document.getElementById('btnDismissSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      let isValid = true;
      const nameInput = document.getElementById('contactName');
      const emailInput = document.getElementById('contactEmail');
      const messageInput = document.getElementById('contactMessage');
      const nameError = document.getElementById('nameError');
      const emailError = document.getElementById('emailError');
      const messageError = document.getElementById('messageError');

      // Validar nombre
      if (!nameInput.value.trim()) {
        isValid = false;
        if (nameError) {
          nameError.textContent = 'Por favor, ingresa tu nombre completo.';
          nameError.style.display = 'block';
        }
      } else if (nameError) {
        nameError.style.display = 'none';
      }

      // Validar email
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailInput.value.trim())) {
        isValid = false;
        if (emailError) {
          emailError.textContent = 'Ingresa una dirección de correo válida.';
          emailError.style.display = 'block';
        }
      } else if (emailError) {
        emailError.style.display = 'none';
      }

      // Validar mensaje
      if (!messageInput.value.trim()) {
        isValid = false;
        if (messageError) {
          messageError.textContent = 'Por favor, escribe un mensaje o consulta.';
          messageError.style.display = 'block';
        }
      } else if (messageError) {
        messageError.style.display = 'none';
      }

      if (isValid) {
        if (formSuccessMessage) {
          formSuccessMessage.classList.add('visible');
        }
        contactForm.reset();
        galleryAudio.playGlintChime(660);
      }
    });

    if (btnDismissSuccess) {
      btnDismissSuccess.addEventListener('click', () => {
        if (formSuccessMessage) {
          formSuccessMessage.classList.remove('visible');
        }
      });
    }
  }

  // Atajo de bienvenida
  setTimeout(() => {
    showToast('Bienvenido a Galería Cero // Explora las salas');
  }, 1000);

});
