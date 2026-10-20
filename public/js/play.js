/* Giardino22 Play — interazioni e animazioni (nessuna libreria).
   Il sito funziona anche senza JavaScript: qui ci sono solo migliorie. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Attivo subito le animazioni di comparsa, prima che la pagina venga disegnata
  if (!RM && 'IntersectionObserver' in window) document.documentElement.classList.add('anim');

  document.addEventListener('DOMContentLoaded', () => {
    /* Header: si compatta scorrendo, si nasconde scendendo, riappare risalendo.
       Hero: lo sfondo scorre più lento del contenuto (parallasse). */
    const top = $('#top'), nav = $('#nav'), burger = $('#burger');
    let ultimoY = 0, inAttesa = false;
    const suScroll = () => {
      const y = scrollY;
      if (top) {
        top.classList.toggle('solid', y > 40);
        top.classList.toggle('hide', y > 400 && y > ultimoY && !(nav && nav.classList.contains('open')));
      }
      ultimoY = y;
      if (!RM && y < 900) { const s = $('.slide.on .slide__bgw'); if (s) s.style.transform = `translate3d(0,${(y * 0.3).toFixed(1)}px,0)`; }
      inAttesa = false;
    };
    addEventListener('scroll', () => { if (!inAttesa) { inAttesa = true; requestAnimationFrame(suScroll); } }, { passive: true });
    suScroll();

    /* Menu del telefono a tutto schermo */
    const menu = (aperto) => {
      if (!burger || !nav) return;
      nav.classList.toggle('open', aperto);
      top.classList.toggle('menu-aperto', aperto);
      document.documentElement.classList.toggle('menu-aperto', aperto);
      burger.setAttribute('aria-expanded', String(aperto));
      burger.setAttribute('aria-label', aperto ? 'Chiudi il menu' : 'Apri il menu');
      if (aperto) { const primo = $('a', nav); if (primo) primo.focus({ preventScroll: true }); }
    };
    if (burger && nav) {
      burger.addEventListener('click', () => menu(!nav.classList.contains('open')));
      $$('a', nav).forEach(a => a.addEventListener('click', () => menu(false)));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { menu(false); burger.focus(); } });
      matchMedia('(min-width: 761px)').addEventListener('change', e => { if (e.matches) menu(false); });
    }

    /* Comparsa allo scroll: righe, card in sequenza, blocchi */
    if (document.documentElement.classList.contains('anim')) {
      const io = new IntersectionObserver(voci => voci.forEach(v => {
        if (v.isIntersecting) { v.target.classList.add('in'); io.unobserve(v.target); }
      }), { rootMargin: '0px 0px -12% 0px' });
      $$('.row, .reveal').forEach(el => io.observe(el));
    }
    $$('.track').forEach(t => $$('.card', t).forEach((c, i) => c.style.setProperty('--i', String(Math.min(i, 6)))));

    /* Card: leggera inclinazione 3D e riflesso che segue il mouse */
    if (FINE && !RM) $$('.card').forEach(c => {
      const t = $('.thumb', c); if (!t) return;
      c.addEventListener('pointermove', e => {
        const r = t.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.style.setProperty('--ry', ((x - 0.5) * 8).toFixed(2) + 'deg');
        t.style.setProperty('--rx', ((0.5 - y) * 8).toFixed(2) + 'deg');
        t.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        t.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerleave', () => { t.style.setProperty('--rx', '0deg'); t.style.setProperty('--ry', '0deg'); });
    });

    /* Caroselli: frecce, barra di avanzamento, trascinamento col mouse */
    $$('[data-riga]').forEach(riga => {
      const track = $('.track', riga); if (!track) return;
      const [indietro, avanti] = $$('.arrow', riga);
      const barra = $('.prog span', riga);
      const aggiorna = () => {
        const max = track.scrollWidth - track.clientWidth;
        if (indietro) { indietro.disabled = track.scrollLeft < 8; avanti.disabled = track.scrollLeft >= max - 8; }
        if (barra) {
          const quota = track.clientWidth / track.scrollWidth;
          barra.parentElement.hidden = quota >= 0.999;
          barra.style.setProperty('--w', (quota * 100) + '%');
          barra.style.setProperty('--x', (max > 0 ? (track.scrollLeft / max) * ((1 - quota) / quota) * 100 : 0) + '%');
        }
      };
      $$('.arrow', riga).forEach(b => b.addEventListener('click', () =>
        track.scrollBy({ left: track.clientWidth * Number(b.dataset.dir), behavior: RM ? 'auto' : 'smooth' })));
      track.addEventListener('scroll', aggiorna, { passive: true });
      addEventListener('resize', aggiorna); aggiorna();

      if (FINE) {
        let giu = false, x0 = 0, s0 = 0, mosso = false;
        track.addEventListener('pointerdown', e => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          giu = true; mosso = false; x0 = e.clientX; s0 = track.scrollLeft;
        });
        addEventListener('pointermove', e => {
          if (!giu) return;
          const dx = e.clientX - x0;
          if (!mosso && Math.abs(dx) > 6) { mosso = true; track.classList.add('trascina'); }
          if (mosso) track.scrollLeft = s0 - dx;
        });
        addEventListener('pointerup', () => { if (!giu) return; giu = false; track.classList.remove('trascina'); });
        track.addEventListener('click', e => { if (mosso) { e.preventDefault(); e.stopPropagation(); mosso = false; } }, true);
        track.addEventListener('dragstart', e => e.preventDefault());
      }
    });


    /* Episodi: pagine da 6 su desktop (l'ultima casella è la freccia), carosello su telefono */
    const DESKTOP = matchMedia('(min-width: 621px)');
    const SVG_SX = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
    const SVG_DX = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
    $$('[data-eps]').forEach(sez => {
      const griglia = $('.eps__grid', sez), pag = $('.eps__pag', sez), barra = $('.prog span', sez);
      const card = $$('.card', griglia), POSTI = 6;
      // pagina 1: 5 episodi + freccia; pagine dopo: episodi + "indietro" (+ freccia se ne restano)
      const pagine = []; let k = 0;
      while (k < card.length) {
        const posti = POSTI - (pagine.length ? 1 : 0), restano = card.length - k;
        const n = restano <= posti ? restano : posti - 1;
        pagine.push([k, k + n]); k += n;
      }
      let ora = 0;
      const casella = (dir, titolo, sotto) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'eps__nav' + (dir < 0 ? ' eps__nav--back' : '');
        const c = document.createElement('span'); c.className = 'cerchio'; c.innerHTML = dir < 0 ? SVG_SX : SVG_DX;
        const t = document.createElement('b'); t.textContent = titolo;
        const s = document.createElement('small'); s.textContent = sotto;
        b.append(c, t, s);
        b.addEventListener('click', () => vai(ora + dir, true));
        return b;
      };
      const etichetta = ([a, b]) => (a + 1 === b ? `Episodio ${b}` : `Episodi ${a + 1}–${b}`);
      const disegna = () => {
        $$('.eps__nav', griglia).forEach(n => n.remove());
        if (!DESKTOP.matches || pagine.length < 2) { card.forEach(c => { c.hidden = false; }); if (pag) pag.textContent = ''; return; }
        const [a, b] = pagine[ora];
        card.forEach((c, i) => { c.hidden = i < a || i >= b; });
        if (ora > 0) griglia.append(casella(-1, 'Indietro', etichetta(pagine[ora - 1])));
        if (ora < pagine.length - 1) griglia.append(casella(1, 'Altri episodi', etichetta(pagine[ora + 1])));
        if (pag) pag.textContent = `Pagina ${ora + 1} di ${pagine.length}`;
      };
      const vai = (n) => {
        n = Math.max(0, Math.min(pagine.length - 1, n));
        if (n === ora) return;
        if (RM) { ora = n; disegna(); return; }
        // l'altezza scorre dolcemente dalla pagina vecchia alla nuova: niente salti
        const h0 = griglia.offsetHeight;
        griglia.style.height = h0 + 'px'; griglia.classList.add('swap', 'resize');
        setTimeout(() => {
          ora = n; disegna();
          griglia.style.height = 'auto'; const h1 = griglia.offsetHeight; griglia.style.height = h0 + 'px';
          void griglia.offsetHeight; griglia.style.height = h1 + 'px';
          requestAnimationFrame(() => griglia.classList.remove('swap'));
          setTimeout(() => { griglia.style.height = ''; griglia.classList.remove('resize'); }, 450);
          if (sez.getBoundingClientRect().top < 0) sez.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const primo = $('.card:not([hidden])', griglia); if (primo) primo.focus({ preventScroll: true });
        }, 250);
      };
      const aggiorna = () => {
        if (!barra) return;
        const max = griglia.scrollWidth - griglia.clientWidth, quota = griglia.clientWidth / Math.max(griglia.scrollWidth, 1);
        barra.style.setProperty('--w', (quota * 100) + '%');
        barra.style.setProperty('--x', (max > 0 ? (griglia.scrollLeft / max) * ((1 - quota) / quota) * 100 : 0) + '%');
      };
      griglia.addEventListener('scroll', aggiorna, { passive: true });
      DESKTOP.addEventListener('change', () => { ora = 0; disegna(); aggiorna(); });
      disegna(); aggiorna();
    });

    /* Hero a rotazione */
    const hero = $('#hero');
    if (hero) {
      const slide = $$('.slide', hero), pick = $$('.pick', hero);
      const durata = Number(hero.dataset.durata) || 8000;
      pick.forEach(p => p.style.setProperty('--durata', durata + 'ms'));
      let i = 0, timer = null;
      const vai = (n) => {
        slide[i].classList.remove('on'); slide[i].setAttribute('aria-hidden', 'true');
        $$('a', slide[i]).forEach(a => a.setAttribute('tabindex', '-1'));
        if (pick[i]) { pick[i].classList.remove('on'); pick[i].setAttribute('aria-selected', 'false'); }
        i = (n + slide.length) % slide.length;
        const img = $('.slide__bg', slide[i]); if (img) img.loading = 'eager';
        slide[i].classList.add('on'); slide[i].setAttribute('aria-hidden', 'false');
        $$('a', slide[i]).forEach(a => a.removeAttribute('tabindex'));
        if (pick[i]) { void pick[i].offsetWidth; pick[i].classList.add('on'); pick[i].setAttribute('aria-selected', 'true'); }
        suScroll();
        programma();
      };
      const programma = () => {
        clearTimeout(timer);
        if (slide.length > 1 && !RM && !hero.classList.contains('ferma') && !document.hidden) timer = setTimeout(() => vai(i + 1), durata);
      };
      pick.forEach((p, n) => p.addEventListener('click', () => vai(n)));
      const ferma = () => { hero.classList.add('ferma'); clearTimeout(timer); };
      const riparti = () => { hero.classList.remove('ferma'); programma(); };
      hero.addEventListener('mouseenter', ferma); hero.addEventListener('mouseleave', riparti);
      hero.addEventListener('focusin', ferma); hero.addEventListener('focusout', riparti);
      document.addEventListener('visibilitychange', () => document.hidden ? clearTimeout(timer) : programma());
      let x0 = null;
      hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      hero.addEventListener('touchend', e => {
        if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 50) vai(i + (dx < 0 ? 1 : -1));
      });
      programma();
    }

    /* Player: YouTube si carica SOLO dopo il clic (privacy + velocità) */
    $$('.player[data-yt]').forEach(player => {
      const id = player.dataset.yt;
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      const btn = $('.go', player);
      if (btn) btn.addEventListener('click', () => {
        const f = document.createElement('iframe');
        f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
        f.title = player.dataset.titolo || 'Video';
        f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; web-share';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        player.replaceChildren(f);
        f.focus();
      });
    });

    /* Copia link */
    const toast = $('#toast');
    const avviso = (t) => { if (!toast) return; toast.textContent = t; toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 2200); };
    $$('[data-copia]').forEach(b => b.addEventListener('click', async () => {
      const link = b.dataset.copia;
      try { await navigator.clipboard.writeText(link); avviso('Link copiato'); }
      catch { avviso(link); }
    }));
  });
})();
