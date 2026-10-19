// public/js/app.js - Frontend Interactivity & API Connection
document.addEventListener('DOMContentLoaded', () => {

  // 0. Section-by-section smooth scrolling (desktop and touch).
  //    One wheel flick / swipe / arrow / PageDown = one glide to the next stop. Stops are each section's
  //    top, each card in the Featured Projects stack, and viewport-sized steps inside sections
  //    taller than the screen. The glide is a critically damped spring: it eases in from rest,
  //    never overshoots, and if the user keeps scrolling it re-targets the next stop mid-glide
  //    while keeping its velocity, so even fast scrolling slides through sections without a
  //    stop-start jolt. Horizontal swipes on carousels stay native.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SNAP_NAV_H = 62;          // fixed header height once scrolled
  const GESTURE_GAP_MS = 200;     // a pause longer than this starts a new wheel gesture
  const CHAIN_MS = 650;           // while scrolling continuously, take another step this often
  const SPRING_OMEGA = 6.2;       // spring stiffness: higher = faster glides (≈0.8s per step)
  const MAX_STEPS_AHEAD = 2;      // how far fast scrolling may queue beyond the current position

  const snapEnabled = () => !prefersReducedMotion;
  const currentScroll = () => window.pageYOffset || document.documentElement.scrollTop;
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const docTop = (el) => el.getBoundingClientRect().top + currentScroll();

  function getSnapStops() {
    const vh = window.innerHeight;
    const stops = [0];

    document.querySelectorAll('body > section, body > footer').forEach((section) => {
      const top = Math.round(docTop(section));

      // Featured Projects: one stop per card arriving on the stack
      if (section.id === 'projects' && projectRows.length && projectRowH) {
        let flowTop = docTop(projectsList);
        projectRows.forEach((row) => {
          stops.push(Math.round(flowTop - projectsStackTop));
          flowTop += row.offsetHeight;
        });
        return;
      }

      stops.push(top);
      // Sections taller than the screen: step through them a screen at a time
      const bottom = top + section.offsetHeight;
      let y = top;
      while (y + vh < bottom - 40) {
        y = Math.min(y + (vh - SNAP_NAV_H - 40), bottom - vh);
        stops.push(Math.round(y));
      }
    });

    const max = maxScroll();
    stops.push(max);
    return [...new Set(stops.map((y) => Math.max(0, Math.min(max, y))))].sort((a, b) => a - b);
  }

  // ---- Spring animator -------------------------------------------------------------------
  const spring = { active: false, pos: 0, vel: 0, target: 0, lastTime: 0, lastSetY: 0, raf: null };

  function springFrame(now) {
    // User dragged the scrollbar / used find-in-page mid-glide: hand control back to them
    if (Math.abs(currentScroll() - spring.lastSetY) > 3) {
      stopSpring();
      return;
    }

    const dt = Math.min(0.05, (now - spring.lastTime) / 1000 || 0.016);
    spring.lastTime = now;

    // Critically damped spring, integrated in small sub-steps for stability at any frame rate
    const k = SPRING_OMEGA * SPRING_OMEGA;
    const c = 2 * SPRING_OMEGA;
    const subSteps = Math.ceil(dt / 0.004);
    const h = dt / subSteps;
    for (let i = 0; i < subSteps; i++) {
      const accel = k * (spring.target - spring.pos) - c * spring.vel;
      spring.vel += accel * h;
      spring.pos += spring.vel * h;
    }

    const settled = Math.abs(spring.target - spring.pos) < 0.5 && Math.abs(spring.vel) < 8;
    if (settled) spring.pos = spring.target;

    window.scrollTo(0, spring.pos); // html has scroll-behavior: auto, so this is an instant jump
    spring.lastSetY = currentScroll();

    if (settled) {
      stopSpring();
    } else {
      spring.raf = requestAnimationFrame(springFrame);
    }
  }

  function stopSpring() {
    if (spring.raf) cancelAnimationFrame(spring.raf);
    spring.raf = null;
    spring.active = false;
    spring.vel = 0;
  }

  function animateScrollTo(targetY) {
    const endY = Math.max(0, Math.min(maxScroll(), Math.round(targetY)));
    if (!spring.active) {
      spring.pos = currentScroll();
      spring.vel = 0;
      spring.lastSetY = spring.pos;
      spring.lastTime = performance.now();
      spring.active = true;
      spring.raf = requestAnimationFrame(springFrame);
    }
    // Re-targeting keeps the current velocity, so a mid-glide change of target stays fluid
    spring.target = endY;
  }

  // ---- Stepping between stops ------------------------------------------------------------
  function snapStep(direction) {
    const stops = getSnapStops();
    const here = currentScroll();
    // Continue from where the glide is heading if we're still moving the same way
    const base = spring.active && Math.sign(spring.target - here) === direction ? spring.target : here;

    const next = direction > 0
      ? stops.find((s) => s > base + 4)
      : [...stops].reverse().find((s) => s < base - 4);
    if (next === undefined) return;

    // Don't let a very fast scroll queue up the whole page
    const stepsAhead = stops.filter((s) => (direction > 0 ? s > here + 4 && s <= next : s < here - 4 && s >= next)).length;
    if (stepsAhead > MAX_STEPS_AHEAD) return;

    animateScrollTo(next);
  }

  const isModalOpen = () => document.getElementById('leadModal')?.classList.contains('active');

  // ---- Wheel / trackpad -------------------------------------------------------------------
  // One step per gesture. A gesture is a burst of wheel events; trackpad momentum is part of
  // the same gesture. Holding a continuous scroll keeps chaining steps every CHAIN_MS.
  const wheel = { lastTime: 0, lastAbs: 0, lastDir: 0, lastStepTime: 0, peakAbs: 0 };

  window.addEventListener('wheel', (e) => {
    if (!snapEnabled() || e.ctrlKey) return;                     // ctrl+wheel = browser zoom
    if (e.target.closest && e.target.closest('[data-native-scroll]')) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;         // horizontal sliders
    e.preventDefault();
    if (isModalOpen() || e.deltaY === 0) return;

    const now = performance.now();
    const abs = Math.abs(e.deltaY);
    const dir = e.deltaY > 0 ? 1 : -1;

    const pause = now - wheel.lastTime > GESTURE_GAP_MS;
    const reversed = dir !== wheel.lastDir;
    // A fresh flick on a trackpad shows up as a sudden jump in delta during the momentum tail
    const accelerated = abs > wheel.lastAbs * 1.6 && abs > 15 && now - wheel.lastStepTime > 250;
    // Sustained scrolling keeps moving through sections. A trackpad's momentum tail fades far
    // below the flick's peak speed, so it never counts; a held mouse-wheel spin stays near it.
    wheel.peakAbs = Math.max(wheel.peakAbs, abs);
    const sustained = now - wheel.lastStepTime > CHAIN_MS && abs >= 40 && abs >= wheel.peakAbs * 0.8;

    wheel.lastTime = now;
    wheel.lastAbs = abs;
    wheel.lastDir = dir;

    if (pause || reversed || accelerated || sustained) {
      wheel.lastStepTime = now;
      wheel.peakAbs = abs;
      snapStep(dir);
    }
  }, { passive: false });

  // ---- Touch (phones & tablets) ----------------------------------------------------------
  // A vertical swipe = one smooth step, exactly like a wheel flick on desktop. Horizontal
  // swipes are left alone so the showcase / testimonial / blog carousels still swipe natively.
  const SWIPE_MIN_PX = 30;
  const touch = { startX: 0, startY: 0, axis: null, active: false };

  window.addEventListener('touchstart', (e) => {
    touch.active = false;
    if (!snapEnabled() || e.touches.length !== 1 || isModalOpen()) return;
    if (e.target.closest && e.target.closest('[data-native-scroll]')) return;
    touch.startX = e.touches[0].clientX;
    touch.startY = e.touches[0].clientY;
    touch.axis = null;
    touch.active = true;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!touch.active) return;
    if (e.touches.length !== 1) { touch.active = false; return; } // pinch-zoom: hands off
    const dx = e.touches[0].clientX - touch.startX;
    const dy = e.touches[0].clientY - touch.startY;
    if (!touch.axis && Math.abs(dx) + Math.abs(dy) > 6) {
      touch.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    }
    // Vertical drags are ours: stop the browser from scrolling natively
    if (touch.axis === 'y' && e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (!touch.active || touch.axis !== 'y') return;
    touch.active = false;
    const dy = e.changedTouches[0].clientY - touch.startY;
    if (Math.abs(dy) < SWIPE_MIN_PX) return;
    snapStep(dy < 0 ? 1 : -1); // finger moves up = scroll down
  }, { passive: true });

  // ---- Keyboard ---------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (!snapEnabled() || isModalOpen()) return;
    const active = document.activeElement;
    const tag = (active?.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag) || active?.isContentEditable) return;

    const down = ['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (!down && !up && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    if (e.key === 'Home') animateScrollTo(0);
    else if (e.key === 'End') animateScrollTo(maxScroll());
    else snapStep(down ? 1 : -1);
  });

  // Smoothly scroll to a target (element or Y position)
  function smoothScrollTo(target) {
    const y = typeof target === 'number' ? target : docTop(target);
    if (prefersReducedMotion) {
      window.scrollTo(0, y);
    } else {
      animateScrollTo(y);
    }
  }

  // In-page anchor links (#projects, #contact, …) glide instead of jumping
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      smoothScrollTo(target);
    });
  });

  // 1. Traveling Brand Logo Animation (Hero Banner -> Header Middle)
  const header = document.getElementById('mainHeader');
  const travelingLogo = document.getElementById('travelingBrandLogo');
  const heroSlot = document.getElementById('heroLogoSlot');

  let metrics = null;
  let targetProgress = 0;
  let currentProgress = 0;
  let isLoopActive = false;

  function recalculateMetrics() {
    if (!travelingLogo || !heroSlot || !header) return;

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const heroRect = heroSlot.getBoundingClientRect();
    const heroH = heroSlot.offsetHeight || 198;

    // Center Y of the hero logo slot in document coordinates
    const startY = heroRect.top + scrollY + (heroH / 2);

    // Center Y of the header navbar in viewport coordinates (exact vertical middle)
    const headerH = header.classList.contains('scrolled') ? header.offsetHeight : 45.22;
    const targetY = Math.round(headerH / 2);

    // Full-stage Figma hero banner width (1332.38px on desktop)
    const isPhone = window.innerWidth <= 602;
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth <= 1024;
    const heroWidth = isPhone
      ? window.innerWidth - 46 // Figma mobile: 357px lockup with 23px side margins
      : isMobile
      ? Math.min(window.innerWidth * 0.92, 480)
      : isTablet
        ? Math.min(window.innerWidth * 0.90, 960)
        : Math.min(window.innerWidth - 48, 1332);

    // Target width in header (scales down into navbar center bay)
    // Shrink further if the free space between "Menu" and "Contact us" is narrower
    // (small phones), so the docked logo never touches either button.
    let targetWidth = isMobile ? 120 : 170;
    let dockX = 0; // horizontal shift from screen centre when docked
    const menuBtn = document.getElementById('menuToggle');
    const ctaBtn = document.getElementById('headerContactBtn');
    if (menuBtn && ctaBtn) {
      const menuRight = menuBtn.getBoundingClientRect().right;
      const ctaLeft = ctaBtn.getBoundingClientRect().left;
      if (isMobile) {
        // Phones/tablets: dock the logo midway between "Menu" and "Contact us" so the
        // space on both sides of it is identical, and size it to leave >= 16px each side.
        targetWidth = Math.max(60, Math.min(targetWidth, ctaLeft - menuRight - 32));
        dockX = (menuRight + ctaLeft) / 2 - window.innerWidth / 2;
      } else {
        const mid = window.innerWidth / 2;
        const room = Math.min(mid - menuRight, ctaLeft - mid);
        targetWidth = Math.max(60, Math.min(targetWidth, (room - 10) * 2));
      }
    }

    // Scale ratio from hero banner size down to navbar size
    const targetScale = heroWidth > 0 ? (targetWidth / heroWidth) : 0.1276;

    // Scroll runway for smooth glide
    const scrollEnd = Math.min(420, Math.max(280, window.innerHeight * 0.5));

    metrics = {
      startY,
      targetY,
      targetScale,
      dockX,
      scrollEnd,
      heroWidth
    };

    travelingLogo.style.width = `${heroWidth}px`;
  }

  // Smooth sinusoidal ease-in-out curve
  function easeInOutSin(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }

  function renderAtProgress(progress) {
    if (!travelingLogo || !metrics) return;

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const { startY, targetY, targetScale, dockX } = metrics;

    // Update header glass backdrop
    if (scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Apply smooth curve
    const eased = easeInOutSin(progress);

    // Dock target = centre of the header as it is right now (its height differs between
    // desktop, tablet and phone once scrolled), minus the logo's CSS `top` offset.
    const dockY = header.classList.contains('scrolled')
      ? header.offsetHeight / 2 - (parseFloat(getComputedStyle(travelingLogo).top) || 0)
      : targetY;

    // Natural position moves up with scroll; eased lifts it into the header
    const naturalY = startY - scrollY;
    const currentY = naturalY + (dockY - naturalY) * eased;
    const currentScale = 1.0 + (targetScale - 1.0) * eased;

    // GPU-accelerated transform: keeps X at 50vw center, centers Y at currentY, scales around center
    const currentX = dockX * eased;
    travelingLogo.style.transform = `translate3d(-50%, ${currentY}px, 0) translate(${currentX}px, -50%) scale(${currentScale})`;

    if (progress > 0.88) {
      travelingLogo.classList.add('docked');
    } else {
      travelingLogo.classList.remove('docked');
    }
  }

  function startPhysicsLoop() {
    function loop() {
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) > 0.0003) {
        currentProgress += diff * 0.18; // smooth damping
        renderAtProgress(currentProgress);
      } else if (currentProgress !== targetProgress) {
        currentProgress = targetProgress;
        renderAtProgress(currentProgress);
      }
      requestAnimationFrame(loop);
    }
    if (!isLoopActive) {
      isLoopActive = true;
      requestAnimationFrame(loop);
    }
  }

  function onScrollUpdate() {
    if (!metrics) recalculateMetrics();
    if (!metrics) {
      // Inner pages have no traveling logo: just toggle the solid header on scroll
      if (header) header.classList.toggle('scrolled', (window.pageYOffset || document.documentElement.scrollTop) > 30);
      return;
    }
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const { scrollEnd } = metrics;

    targetProgress = Math.min(1, Math.max(0, scrollY / scrollEnd));

    // Instant render if user is at top
    if (scrollY === 0 && currentProgress === 0) {
      renderAtProgress(0);
    }
  }

  window.addEventListener('scroll', onScrollUpdate, { passive: true });
  window.addEventListener('resize', () => {
    recalculateMetrics();
    onScrollUpdate();
  }, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      recalculateMetrics();
      onScrollUpdate();
    }, 150);
  });
  window.addEventListener('load', () => {
    recalculateMetrics();
    onScrollUpdate();
  });

  // Initial setup & start physics RAF loop
  recalculateMetrics();
  onScrollUpdate();
  startPhysicsLoop();

  // Clicking logo while scrolled glides smoothly back to top
  if (travelingLogo) {
    travelingLogo.addEventListener('click', (e) => {
      if (window.scrollY > 60) {
        e.preventDefault();
        e.stopImmediatePropagation();
        smoothScrollTo(0);
      }
    });
  }

  // 2. Menu Drawer Toggle
  const menuToggle = document.getElementById('menuToggle');
  const menuDrawer = document.getElementById('menuDrawer');
  const closeDrawer = document.getElementById('closeDrawer');

  if (menuToggle && menuDrawer) {
    menuToggle.addEventListener('click', () => {
      menuDrawer.classList.add('active');
    });

    closeDrawer.addEventListener('click', () => {
      menuDrawer.classList.remove('active');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (menuDrawer.classList.contains('active') && 
          !menuDrawer.contains(e.target) && 
          !menuToggle.contains(e.target)) {
        menuDrawer.classList.remove('active');
      }
    });

    // Close when clicking a link
    menuDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => menuDrawer.classList.remove('active'));
    });
  }

  // 3. Category Tabs in Hero
  const categoryPills = document.querySelectorAll('.category-tab-pill');
  categoryPills.forEach(pill => {
    pill.addEventListener('click', () => {
      categoryPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  // 4. Showcase Slider Controls
  const slider = document.getElementById('showcaseSlider');
  const sliderPrev = document.getElementById('sliderPrev');
  const sliderNext = document.getElementById('sliderNext');

  if (slider && sliderPrev && sliderNext) {
    sliderPrev.addEventListener('click', () => {
      slider.scrollBy({ left: -340, behavior: 'smooth' });
    });
    sliderNext.addEventListener('click', () => {
      slider.scrollBy({ left: 340, behavior: 'smooth' });
    });
  }

  // 5. Featured Projects: pinned header + stacking cards (each card slides over the previous)
  const projectsContainer = document.querySelector('.projects-container');
  const projectsHeader = document.querySelector('.projects-header');
  const projectsList = document.querySelector('.projects-list');
  const projectRows = document.querySelectorAll('.project-row');
  const PROJECTS_NAV_H = 62; // height of the fixed header once scrolled
  let projectsStackTop = 0;
  let projectRowH = 0;

  function measureProjectRows() {
    if (!projectsHeader || !projectsList || !projectRows.length) return;
    const isDesktop = window.innerWidth > 992;
    if (!isDesktop) {
      projectsHeader.style.marginBottom = '';
      projectsList.style.marginTop = '';
      return;
    }
    projectRowH = Math.max(...Array.from(projectRows, (row) => row.offsetHeight));
    projectsStackTop = PROJECTS_NAV_H + projectsHeader.offsetHeight;
    projectsContainer.style.setProperty('--projects-nav-h', `${PROJECTS_NAV_H}px`);
    projectsContainer.style.setProperty('--projects-stack-top', `${projectsStackTop}px`);
    // A sticky element keeps its margin box inside its parent. Giving the header a bottom
    // margin of one card height (cancelled by the list's negative margin-top) makes the
    // header and the stacked cards hit the end of the section together and leave as one.
    projectsHeader.style.marginBottom = `${projectRowH}px`;
    projectsList.style.marginTop = `${-projectRowH}px`;
  }

  function updateProjectStackingAndParallax() {
    const windowH = window.innerHeight;
    const isDesktop = window.innerWidth > 992;

    projectRows.forEach((row, i) => {
      // 1. How far the next card has slid over this one (0 = not at all, 1 = fully covered)
      let cover = 0;
      if (isDesktop && projectRowH && i < projectRows.length - 1) {
        const nextTop = projectRows[i + 1].getBoundingClientRect().top;
        cover = Math.max(0, Math.min(1, (projectsStackTop + projectRowH - nextTop) / projectRowH));
      }
      row.style.setProperty('--cover', cover.toFixed(3));

      // 2. Parallax Image Glide
      const rect = row.getBoundingClientRect();
      const img = row.querySelector('.project-img');
      if (img) {
        const progress = (windowH - rect.top) / (windowH + rect.height);
        if (progress >= -0.2 && progress <= 1.2) {
          const clamped = Math.max(0, Math.min(1, progress));
          const offsetPercent = -24 + (clamped * 24);
          img.style.transform = `translate3d(0, ${offsetPercent.toFixed(2)}%, 0)`;
        }
      }
    });
  }

  let projectTicking = false;
  function requestProjectUpdate() {
    if (projectTicking) return;
    projectTicking = true;
    requestAnimationFrame(() => {
      updateProjectStackingAndParallax();
      projectTicking = false;
    });
  }

  function remeasureProjects() {
    measureProjectRows();
    updateProjectStackingAndParallax();
  }

  window.addEventListener('scroll', requestProjectUpdate, { passive: true });
  window.addEventListener('resize', remeasureProjects, { passive: true });
  window.addEventListener('load', remeasureProjects);
  remeasureProjects();

  // Subtle interactive cursor parallax on hover
  projectRows.forEach((row) => {
    const media = row.querySelector('.project-media');
    const img = row.querySelector('.project-img');
    if (!media || !img) return;

    row.addEventListener('mousemove', (e) => {
      const rect = media.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - (rect.width / 2);
      const xOffset = Math.max(-10, Math.min(10, mouseX * 0.05));
      img.style.marginLeft = `${xOffset}px`;
    });

    row.addEventListener('mouseleave', () => {
      img.style.marginLeft = '0px';
    });
  });

  // Clicking a card opens the consultation modal pre-filled with its project type
  projectRows.forEach((row) => {
    row.addEventListener('click', () => {
      const title = row.querySelector('.project-heading')?.textContent;
      const typeSelect = document.getElementById('leadProjectType');
      if (typeSelect && title) {
        if (title.includes('Interior')) typeSelect.value = 'Residential';
        else if (title.includes('Space')) typeSelect.value = 'Commercial';
        else if (title.includes('Furniture')) typeSelect.value = 'Styling';
        else if (title.includes('Renovation')) typeSelect.value = 'Turnkey';
      }
      openModal();
    });
  });

  // 5a. Hero background: phones get the portrait photo from the mobile Figma design
  function applyHeroBackground() {
    const heroSec = document.getElementById('hero');
    if (!heroSec) return;
    const src = window.innerWidth <= 602 ? heroSec.dataset.mobileBg : heroSec.dataset.desktopBg;
    if (src) heroSec.style.backgroundImage = `url('${src}')`;
  }
  applyHeroBackground();
  window.addEventListener('resize', applyHeroBackground, { passive: true });

  // Showcase carousel progress bar (mobile): the thumb tracks horizontal scroll position
  const showcaseProgress = document.getElementById('showcaseProgress');
  if (slider && showcaseProgress) {
    const updateShowcaseProgress = () => {
      const max = slider.scrollWidth - slider.clientWidth;
      const track = showcaseProgress.parentElement.clientWidth;
      const thumbW = showcaseProgress.offsetWidth;
      const p = max > 0 ? slider.scrollLeft / max : 0;
      showcaseProgress.style.transform = `translateX(${(track - thumbW) * p}px)`;
    };
    slider.addEventListener('scroll', updateShowcaseProgress, { passive: true });
    window.addEventListener('resize', updateShowcaseProgress, { passive: true });
    updateShowcaseProgress();
  }

  // 5b. Testimonials moving strip: repeat the card set until it is wider than the screen,
  //     then render it twice so the CSS marquee (translateX -50%) loops without a seam.
  const testimonialsStrip = document.getElementById('testimonialsStrip');
  if (testimonialsStrip) {
    const originals = Array.from(testimonialsStrip.children);
    const cloneSet = () => originals.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      testimonialsStrip.appendChild(clone);
    });
    const setWidth = () => originals.reduce((w, c) => w + c.offsetWidth + 2, 0);
    const oneSet = setWidth() || 1;
    const repeats = Math.max(1, Math.ceil(Math.max(window.innerWidth, 1920) / oneSet));
    for (let i = 1; i < repeats * 2; i++) cloneSet();
    // Constant speed (~45px/s) regardless of how many cards there are
    testimonialsStrip.style.setProperty('--marquee-duration', `${Math.round((oneSet * repeats) / 45)}s`);
  }

  // 6. Lead Modal Control
  const modal = document.getElementById('leadModal');
  const closeModal = document.getElementById('closeModal');
  const openButtons = document.querySelectorAll('.open-lead-modal');

  function openModal() {
    if (modal) modal.classList.add('active');
    document.documentElement.style.overflow = 'hidden'; // freeze the page behind the modal
  }

  function hideModal() {
    if (modal) modal.classList.remove('active');
    document.documentElement.style.overflow = '';
  }

  openButtons.forEach(btn => btn.addEventListener('click', openModal));
  if (closeModal) closeModal.addEventListener('click', hideModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  // 7. Toast Notification Utility
  const toast = document.getElementById('toastNotice');
  const toastMsg = document.getElementById('toastMessage');

  function showToast(message, isError = false) {
    if (!toast) return;
    toastMsg.textContent = message;
    toast.style.borderLeftColor = isError ? '#E53E3E' : 'var(--gold-primary)';
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);
  }

  // 8. Lead Form Submission
  const leadForm = document.getElementById('leadCaptureForm');
  const submitBtn = document.getElementById('submitLeadBtn');

  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        name: document.getElementById('leadName').value.trim(),
        email: document.getElementById('leadEmail').value.trim(),
        phone: document.getElementById('leadPhone').value.trim(),
        project_type: document.getElementById('leadProjectType').value,
        message: document.getElementById('leadMessage').value.trim(),
        source: 'Website Modal Form'
      };

      if (!payload.name || !payload.email) {
        showToast('Please enter your name and email.', true);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          showToast('Inquiry sent! Our concierge team will reach out shortly.');
          leadForm.reset();
          hideModal();
        } else {
          showToast(data.error || 'Failed to submit inquiry. Please try again.', true);
        }
      } catch (err) {
        console.error('Submission error:', err);
        showToast('Network error. Please try again or call us directly.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Consultation Request';
      }
    });
  }

  // 8b. Contact page form -> same lead pipeline (Supabase + Gmail notification)
  const contactPageForm = document.getElementById('contactPageForm');
  if (contactPageForm) {
    contactPageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = contactPageForm.elements;
      const required = ['name', 'phone', 'email', 'project_type', 'message'];
      let firstInvalid = null;
      required.forEach((key) => {
        const el = fields[key];
        const ok = el.value.trim() !== '' && (key !== 'email' || /^\S+@\S+\.\S+$/.test(el.value.trim()));
        el.closest('.ct-field').classList.toggle('is-invalid', !ok);
        if (!ok && !firstInvalid) firstInvalid = el;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        showToast('Please fill in all the fields marked *.', true);
        return;
      }

      const submitBtn = contactPageForm.querySelector('.ct-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fields.name.value.trim(),
            phone: fields.phone.value.trim(),
            email: fields.email.value.trim(),
            project_type: fields.project_type.value,
            message: fields.message.value.trim(),
            source: 'Contact Page Form'
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast('Message sent! We’ll get back to you with the next steps shortly.');
          contactPageForm.reset();
        } else {
          showToast(data.error || 'Failed to send your message. Please try again.', true);
        }
      } catch (err) {
        showToast('Network error. Please try again or call us directly.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    });

    contactPageForm.addEventListener('input', (e) => {
      const field = e.target.closest('.ct-field');
      if (field) field.classList.remove('is-invalid');
    });
  }

  // 8c. FAQ accordion (one answer open at a time)
  document.querySelectorAll('.faq-question').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const willOpen = !item.classList.contains('is-open');
      item.parentElement.querySelectorAll('.faq-item').forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // 9. Hydrate Dynamic Content from CMS/CRM
  async function hydrateContent() {
    try {
      const res = await fetch('/api/content');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !data.content) return;

      const c = data.content;

      // Hero
      if (c.hero?.tickerText) {
        const el = document.getElementById('dynamicTickerText');
        if (el) el.textContent = c.hero.tickerText;
      }
      if (c.hero?.rating) {
        const el = document.getElementById('dynamicRating');
        if (el) el.textContent = c.hero.rating;
      }
      if (c.hero?.verifiedText) {
        const el = document.getElementById('dynamicVerifiedText');
        if (el) el.textContent = c.hero.verifiedText;
      }

      // Custom desktop / mobile hero images from the CRM
      const heroSec = document.getElementById('hero');
      if (heroSec) {
        if (c.hero?.mobileImage) heroSec.dataset.mobileBg = c.hero.mobileImage;
        if (c.hero?.desktopImage) heroSec.dataset.desktopBg = c.hero.desktopImage;
        applyHeroBackground();
      }

      // Dynamic brand logo from CMS
      if (c.hero?.logoImage) {
        const heroLogo = document.getElementById('heroLogoImg');
        const headerLogo = document.getElementById('headerLogoImg');
        if (heroLogo) heroLogo.src = c.hero.logoImage;
        if (headerLogo) headerLogo.src = c.hero.logoImage;
      }

      // Solutions
      if (c.solutions?.title) {
        const el = document.getElementById('solutionsTitle');
        if (el) el.textContent = c.solutions.title;
      }
      if (c.solutions?.subtitle) {
        const el = document.getElementById('solutionsSubtitle');
        if (el) el.textContent = c.solutions.subtitle;
      }

      // Why Furniqos
      if (c.whyFurniqos?.title) {
        const el = document.getElementById('whyTitle');
        if (el) el.textContent = c.whyFurniqos.title;
      }
      if (c.whyFurniqos?.text) {
        const el = document.getElementById('whyText');
        if (el) el.textContent = c.whyFurniqos.text;
      }
      if (c.whyFurniqos?.bgImage) {
        const sec = document.getElementById('why-furniqos');
        if (sec) sec.style.backgroundImage = `url('${c.whyFurniqos.bgImage}')`;
      }

      // About
      if (c.about?.title) {
        const el = document.getElementById('aboutTitle');
        if (el) el.textContent = c.about.title;
      }
      if (c.about?.desc1) {
        const el = document.getElementById('aboutDesc1');
        if (el) el.textContent = c.about.desc1;
      }
      if (c.about?.desc2) {
        const el = document.getElementById('aboutDesc2');
        if (el) el.textContent = c.about.desc2;
      }
      if (c.about?.image) {
        const el = document.getElementById('aboutImage');
        if (el) el.src = c.about.image;
      }

      // CTA
      if (c.cta?.title) {
        const el = document.getElementById('ctaTitle');
        if (el) el.textContent = c.cta.title;
      }
      if (c.cta?.subtitle) {
        const el = document.getElementById('ctaSubtitle');
        if (el) el.textContent = c.cta.subtitle;
      }

    } catch (e) {
      console.warn('Could not hydrate dynamic content:', e);
    }
  }

  hydrateContent();
});
