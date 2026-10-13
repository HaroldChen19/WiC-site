(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const media = window.WIC_MEDIA;
  const demos = new Map(media.demos.map(demo => [demo.id, demo]));
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pausedGroups = {hero: reducedMotion.matches, worlds: false, switching: false};
  const records = new Map();
  const hero = $('top');
  let scrollFrame = 0;
  let lastScrollProgress = -1;

  // One update per scroll frame, using only composited transforms and opacity.
  function renderHeroScroll() {
    scrollFrame = 0;
    if (document.hidden || (pausedGroups.hero && !reducedMotion.matches)) return;
    const bounds = hero.getBoundingClientRect();
    const progress = reducedMotion.matches ? 0 : Math.min(1, Math.max(0, -bounds.top / Math.max(1, bounds.height)));
    if (Math.abs(progress - lastScrollProgress) < .0005) return;
    lastScrollProgress = progress;
    hero.style.setProperty('--wall-shift', `${(progress * Math.min(140, bounds.height * .17)).toFixed(2)}px`);
    hero.style.setProperty('--wall-scale', (1 - progress * .09).toFixed(4));
    hero.style.setProperty('--wall-tilt', `${(progress * 7).toFixed(2)}deg`);
    hero.style.setProperty('--wall-opacity', (1 - progress * .65).toFixed(4));
  }
  function scheduleHeroScroll() {
    if (!scrollFrame && !document.hidden) scrollFrame = requestAnimationFrame(renderHeroScroll);
  }

  function eligible(record) {
    return record.visible && !document.hidden && !pausedGroups[record.group] && !record.userPaused;
  }
  function release(record) {
    record.generation++;
    record.pending = false;
    record.suspended = true;
    record.video.pause();
    if (record.video.hasAttribute('src')) {
      record.video.removeAttribute('src');
      record.video.load();
    }
  }
  function reconcile(record) {
    clearTimeout(record.releaseTimer);
    if (!eligible(record)) {
      record.suspended = true;
      record.video.pause();
      if (!record.visible) record.releaseTimer = setTimeout(() => {
        if (!record.visible) release(record);
      }, 1800);
      return;
    }
    record.suspended = false;
    const video = record.video;
    if (!video.getAttribute('src')) {
      video.muted = true;
      video.defaultMuted = true;
      video.src = record.source;
    }
    if (record.pending || !video.paused) return;
    const generation = record.generation;
    record.pending = true;
    Promise.resolve(video.play()).then(() => {
      if (generation !== record.generation) return;
      record.pending = false;
      if (record.resume) record.resume.hidden = true;
      if (!eligible(record)) { record.suspended = true; video.pause(); }
    }).catch(error => {
      if (generation !== record.generation) return;
      record.pending = false;
      if (error.name === 'AbortError' && eligible(record)) {
        requestAnimationFrame(() => { if (generation === record.generation) reconcile(record); });
      }
      if (error.name !== 'AbortError' && eligible(record) && record.resume) {
        record.resume.hidden = false;
        record.resume.querySelector('span').innerHTML = `${icon('play')} Play video`;
      }
    });
  }
  const visibility = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      if (!record) continue;
      record.visible = entry.isIntersecting && entry.intersectionRatio > .04;
      reconcile(record);
    }
    document.body.classList.toggle('hero-offscreen', ![...records.values()].some(record => record.group === 'hero' && record.visible));
  }, {threshold: [0, .05, .15]}) : null;

  function register(video, group, source, resume = null) {
    const record = {video, group, source, resume, visible:false, userPaused:false, pending:false, suspended:true, generation:0, releaseTimer:null};
    records.set(video, record);
    video.muted = true;
    video.defaultMuted = true;
    video.addEventListener('pause', () => {
      // Native controls may pause a clip; preserve that choice during ordinary scrolling.
      if (video.paused && !record.suspended && !record.pending && video.currentTime > 0) record.userPaused = true;
    });
    video.addEventListener('play', () => {
      record.userPaused = false;
      if (resume) resume.hidden = true;
      if (!record.visible || document.hidden) { record.suspended = true; video.pause(); }
    });
    video.addEventListener('error', () => {
      if (!resume || !video.hasAttribute('src')) return;
      resume.hidden = false;
      resume.querySelector('span').innerHTML = `${icon('play')} Retry video`;
    });
    if (resume) resume.addEventListener('click', () => {
      record.userPaused = false;
      pausedGroups[group] = false;
      updateMotionControls();
      resume.hidden = true;
      if (video.error) release(record);
      reconcile(record);
    });
    if (visibility) visibility.observe(video);
    return record;
  }

  function updateMotionControls() {
    const heroButton = $('hero-motion');
    heroButton.setAttribute('aria-pressed', String(pausedGroups.hero));
    heroButton.innerHTML = icon(pausedGroups.hero ? 'play' : 'pause') + `<span>${pausedGroups.hero ? 'Play background' : 'Pause background'}</span>`;
    document.body.classList.toggle('hero-paused', pausedGroups.hero);
    document.querySelectorAll('[data-motion]').forEach(button => {
      const paused = pausedGroups[button.dataset.motion];
      button.setAttribute('aria-pressed', String(paused));
      button.innerHTML = icon(paused ? 'play' : 'pause') + `<span>${paused ? 'Play videos' : 'Pause videos'}</span>`;
    });
    scheduleHeroScroll();
  }
  function toggleGroup(group) {
    pausedGroups[group] = !pausedGroups[group];
    records.forEach(record => {
      if (record.group !== group) return;
      record.userPaused = false;
      reconcile(record);
    });
    updateMotionControls();
  }
  $('hero-motion').addEventListener('click', () => toggleGroup('hero'));
  document.querySelectorAll('[data-motion]').forEach(button => button.addEventListener('click', () => toggleGroup(button.dataset.motion)));

  // Use lightweight sources for the 24 full-frame tiles in the saved layout.
  const offsets = [-36, 22, -12, 38, -26, 12];
  for (let column = 0; column < 6; column++) {
    const stack = document.createElement('div');
    stack.className = 'hero-column';
    stack.style.setProperty('--offset', `${offsets[column]}px`);
    stack.style.setProperty('--float-delay', `${-column * 2.3}s`);
    for (let row = 0; row < 4; row++) {
      const heroId = media.heroSlots?.[row * 6 + column] || media.hero[(row * 9 + column) % media.hero.length];
      const demo = demos.get(heroId);
      if (!demo) continue;
      const tile = document.createElement('div');
      tile.className = 'hero-tile';
      tile.style.setProperty('--delay', `${(.07 * Math.abs(column - 2.5) + .11 * row).toFixed(2)}s`);
      tile.innerHTML = `<video poster="${escapeHTML(demo.heroPoster)}" autoplay muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video>`;
      stack.append(tile);
      register(tile.querySelector('video'), 'hero', demo.heroVideo || demo.video);
    }
    $('hero-wall').append(stack);
  }

  function createGallery(group, playlists) {
    const grid = $(`${group}-grid`);
    playlists.forEach((ids, index) => {
      const pool = ids.map(id => demos.get(id)).filter(Boolean);
      if (!pool.length) return;
      let current = 0;
      const article = document.createElement('article');
      article.className = 'video-window';
      article.setAttribute('aria-roledescription', 'carousel');
      article.setAttribute('aria-label', `${group === 'worlds' ? 'Generated world' : 'Perspective switching'} window ${index+1}`);
      article.innerHTML = `<div class="video-screen"><video controls autoplay muted loop playsinline preload="none"></video><button class="video-resume" hidden><span>${icon('play')} Play video</span></button></div><div class="window-footer"><h3 aria-live="polite"></h3><div class="window-navigation"><button class="previous" aria-label="Previous video in window ${index+1}">${icon('prev')}</button><span class="window-count"></span><button class="next" aria-label="Next video in window ${index+1}">${icon('next')}</button></div></div>`;
      grid.append(article);
      const video = article.querySelector('video');
      const record = register(video, group, pool[0].video, article.querySelector('.video-resume'));
      function display(nextIndex) {
        release(record); // Stop and detach the old media before switching the source.
        current = nextIndex;
        const demo = pool[nextIndex];
        record.source = demo.video;
        record.userPaused = false;
        record.resume.hidden = true;
        video.poster = demo.poster;
        video.setAttribute('aria-label', demo.title);
        article.dataset.sceneId = demo.id;
        article.querySelector('h3').textContent = demo.title;
        article.querySelector('.window-count').textContent = `${String(nextIndex+1).padStart(2,'0')} / ${String(pool.length).padStart(2,'0')}`;
        reconcile(record);
      }
      function step(direction) {
        if (pool.length > 1) display((current + direction + pool.length) % pool.length);
      }
      article.querySelector('.previous').addEventListener('click', () => step(-1));
      article.querySelector('.next').addEventListener('click', () => step(1));
      article.addEventListener('keydown', event => {
        if (event.target.tagName === 'VIDEO') return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
      });
      article.querySelectorAll('.window-navigation button').forEach(button => button.disabled = pool.length < 2);
      display(0);
    });
  }
  createGallery('worlds', media.playlists.worlds);
  createGallery('switching', media.playlists.switching);
  updateMotionControls();

  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('page-hidden', document.hidden);
    records.forEach(reconcile);
    scheduleHeroScroll();
  });
  reducedMotion.addEventListener('change', event => {
    pausedGroups.hero = event.matches;
    records.forEach(record => { if (record.group === 'hero') reconcile(record); });
    updateMotionControls();
  });
  window.addEventListener('pagehide', () => records.forEach(record => { clearTimeout(record.releaseTimer); release(record); }));
  window.addEventListener('pageshow', () => records.forEach(reconcile));
  window.addEventListener('scroll', scheduleHeroScroll, {passive:true});
  window.addEventListener('resize', () => { lastScrollProgress = -1; scheduleHeroScroll(); });
  window.addEventListener('pageshow', scheduleHeroScroll);
  let copyTimer;
  $('copy-citation').addEventListener('click', async () => {
    const value = $('bibtex').textContent;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch (_) { /* Local files and restrictive browsers may need the selection fallback. */ }
    if (!copied) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents($('bibtex'));
      selection.removeAllRanges();
      selection.addRange(range);
      try { copied = document.execCommand('copy'); } catch (_) { /* Leave the citation selected for manual copying. */ }
      if (copied) selection.removeAllRanges();
    }
    clearTimeout(copyTimer);
    $('copy-citation').querySelector('span').textContent = copied ? 'Copied' : 'Text selected';
    $('copy-status').textContent = copied ? 'BibTeX copied to clipboard.' : 'Citation selected. Use your keyboard to copy.';
    copyTimer = setTimeout(() => { $('copy-citation').querySelector('span').textContent = 'Copy BibTeX'; }, 2500);
  });
  if (!visibility) {
    let scheduled = false;
    const updateVisibility = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        records.forEach(record => {
          const rect = record.video.getBoundingClientRect();
          record.visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
          reconcile(record);
        });
        scheduled = false;
      });
    };
    window.addEventListener('scroll', updateVisibility, {passive:true});
    window.addEventListener('resize', updateVisibility);
    updateVisibility();
  }
})();
