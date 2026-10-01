/* QBrindes — movimento: Lenis, âncoras, revelações, digitação, letras, 3D por proximidade,
   inclinação, ímã, luz do hero, ondas de clique, bokeh, túnel, anel e botão de pausa. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const html = document.documentElement;
  const mouseFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const suportaView = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  const ligado = () => html.classList.contains('motion-on');
  const api = { lenis: null, rolarAte };
  window.QBMotion = api;

  /* ---------- Lenis (só mouse; no toque a rolagem é nativa) ---------- */
  function ligarLenis() {
    if (api.lenis || !mouseFino || !ligado() || typeof window.Lenis !== 'function') return;
    api.lenis = new window.Lenis({
      autoRaf: true, lerp: 0.1, smoothWheel: true, syncTouch: false, anchors: false,
      prevent: (no) => !!(no.closest && (no.closest('dialog') || no.closest('.chips') || no.closest('[data-lenis-prevent]')))
    });
    if (html.classList.contains('dlg-aberto')) api.lenis.stop();
  }
  function desligarLenis() {
    if (!api.lenis) return;
    api.lenis.destroy();
    api.lenis = null;
    html.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped');
  }

  /* Âncoras: alvo em pixels, descontando o cabeçalho já compactado */
  function rolarAte(alvo) {
    const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    if (!el) return;
    const compacto = 34 + 58; // barra da demo + cabeçalho compactado
    let y = el.id === 'inicio' ? 0 : el.getBoundingClientRect().top + window.scrollY - compacto - 12;
    if (el.id === 'vitrine' || el.id === 'galeria') y = el.getBoundingClientRect().top + window.scrollY; // seções fixadas começam no topo
    y = Math.max(0, y);
    if (api.lenis) api.lenis.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: ligado() ? 'smooth' : 'auto' });
  }

  /* ---------- Revelações ---------- */
  const ioRevela = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('visivel');
      ioRevela.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  function prepararRevelacoes(raiz) {
    $$('[data-reveal]:not(.visivel), [data-stagger]:not(.visivel)', raiz).forEach((el) => {
      if (el.hasAttribute('data-stagger')) Array.from(el.children).forEach((c, i) => { if (!c.style.getPropertyValue('--i')) c.style.setProperty('--i', i); });
      ioRevela.observe(el);
    });
  }

  /* ---------- Eyebrows digitados ---------- */
  const ioTipo = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      ioTipo.unobserve(en.target);
      digitar(en.target);
    });
  }, { threshold: 0.6 });

  function digitar(el) {
    const texto = el.dataset.textoOriginal;
    if (!ligado()) { el.textContent = texto; return; }
    el.textContent = '';
    el.classList.add('digitando');
    let i = 0;
    (function passo() {
      i++;
      el.textContent = texto.slice(0, i);
      if (i < texto.length) setTimeout(passo, 22 + Math.random() * 26);
      else setTimeout(() => el.classList.remove('digitando'), 1400);
    })();
  }
  function prepararDigitacao() {
    $$('[data-type]').forEach((el) => {
      if (el.dataset.textoOriginal) return;
      el.dataset.textoOriginal = el.textContent.trim();
      el.setAttribute('aria-label', el.dataset.textoOriginal);
      if (ligado()) ioTipo.observe(el);
    });
  }

  /* ---------- Títulos letra a letra (2D, sem camada de GPU por letra) ---------- */
  function quebrarLetras(el) {
    if (el.classList.contains('letras')) return;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    function processar(no) {
      const frag = document.createDocumentFragment();
      Array.from(no.childNodes).forEach((filho) => {
        if (filho.nodeType === 3) {
          const partes = filho.textContent.split(/(\s+)/);
          partes.forEach((parte) => {
            if (!parte) return;
            if (/^\s+$/.test(parte)) { frag.appendChild(document.createTextNode(' ')); return; }
            const pal = document.createElement('span');
            pal.className = 'palavra';
            pal.setAttribute('aria-hidden', 'true');
            Array.from(parte).forEach((ch) => {
              const l = document.createElement('span');
              l.className = 'letra';
              l.textContent = ch;
              l.style.setProperty('--d', Math.min(n * 19, 950) + 'ms');
              n++;
              pal.appendChild(l);
            });
            frag.appendChild(pal);
          });
        } else if (filho.nodeType === 1) {
          const copia = filho.cloneNode(false);
          copia.appendChild(processar(filho));
          frag.appendChild(copia);
        }
      });
      return frag;
    }
    const novo = processar(el);
    el.textContent = '';
    el.appendChild(novo);
    el.classList.add('letras');
    ioRevela.observe(el);
  }

  /* ---------- 3D por proximidade: .s3d (1 tela), .sec-on (meia tela), .anim-off (fora) ---------- */
  const ioS3d = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('s3d', en.isIntersecting)), { rootMargin: '100% 0px 100% 0px' });
  const ioSec = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('sec-on', en.isIntersecting)), { rootMargin: '50% 0px 50% 0px' });
  const ioAnim = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('anim-off', !en.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec, .fitas, .rodape, .vitrine, .galeria').forEach((s) => { ioS3d.observe(s); ioSec.observe(s); });
  $$('.fitas, .estudio, .whats-flutuante').forEach((s) => ioAnim.observe(s));

  /* Fitas: duplica o conteúdo para o laço contínuo */
  $$('[data-fita]').forEach((t) => { t.innerHTML += t.innerHTML; });

  /* ---------- Ponteiro: inclinação, reflexo, ímã e luz do hero (um único rAF) ---------- */
  let ptr = null, ptrAgendado = false, tiltAtual = null, magAtual = null;
  const heroLuz = $('.hero__luz');
  const hero = $('#inicio');
  function quadroPonteiro() {
    ptrAgendado = false;
    if (!ptr) return;
    const { x, y, alvo } = ptr;
    const tilt = alvo && alvo.closest && alvo.closest('[data-tilt]');
    if (tiltAtual && tiltAtual !== tilt) soltarTilt(tiltAtual);
    if (tilt && ligado()) {
      const r = tilt.getBoundingClientRect();
      const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
      tilt.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 5).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 6).toFixed(2) + 'deg) translateY(-4px)';
      tilt.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      tilt.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      tilt.classList.add('inclinado');
      tiltAtual = tilt;
    }
    const mag = alvo && alvo.closest && alvo.closest('[data-magnetic]');
    if (magAtual && magAtual !== mag) { magAtual.style.transform = ''; magAtual = null; }
    if (mag && ligado()) {
      const r = mag.getBoundingClientRect();
      mag.style.transform = 'translate(' + ((x - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((y - r.top - r.height / 2) * 0.25).toFixed(1) + 'px)';
      magAtual = mag;
    }
    if (heroLuz && hero && ligado()) {
      const r = hero.getBoundingClientRect();
      if (y < r.bottom && y > r.top) {
        heroLuz.style.setProperty('--hx', (x / innerWidth * 100).toFixed(1) + '%');
        heroLuz.style.setProperty('--hy', (y / innerHeight * 100).toFixed(1) + '%');
      }
    }
  }
  function soltarTilt(el) { el.style.transform = ''; el.classList.remove('inclinado'); if (tiltAtual === el) tiltAtual = null; }
  if (mouseFino) {
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      ptr = { x: e.clientX, y: e.clientY, alvo: e.target };
      if (!ptrAgendado) { ptrAgendado = true; requestAnimationFrame(quadroPonteiro); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (tiltAtual) soltarTilt(tiltAtual); });
  }

  /* Onda no clique dos botões */
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn');
    if (!b || !ligado()) return;
    const r = b.getBoundingClientRect();
    const s = Math.max(r.width, r.height) * 2;
    const o = document.createElement('span');
    o.className = 'onda';
    o.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(o);
    setTimeout(() => o.remove(), 650);
  }, { passive: true });

  /* ---------- Bokeh: luz festiva nas seções escuras (~30 fps, congela na rolagem) ---------- */
  const DPR = Math.min(devicePixelRatio || 1, mouseFino ? 1.5 : 1.25);
  let rolando = false, rolarTimer = 0;
  window.addEventListener('scroll', () => { rolando = true; clearTimeout(rolarTimer); rolarTimer = setTimeout(() => { rolando = false; }, 140); }, { passive: true });

  function criarBokeh(canvas) {
    const ctx = canvas.getContext('2d');
    const paleta = canvas.dataset.bokeh === 'ouro'
      ? ['255,200,87', '255,178,30', '255,236,190', '143,134,255']
      : ['143,134,255', '255,178,30', '96,80,255', '255,61,174'];
    let w = 0, h = 0, pontos = [], visivel = false, raf = 0, ultimo = 0, relogio = 0;
    function dimensionar() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.round(Math.min(38, Math.max(14, w * h / 42000)));
      pontos = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: 6 + Math.random() * 46,
        vx: (Math.random() - 0.5) * 0.012, vy: -0.004 - Math.random() * 0.012,
        a: 0.04 + Math.random() * 0.12, f: Math.random() * 6.28, c: paleta[(Math.random() * paleta.length) | 0], brilho: Math.random() < 0.18
      }));
      desenhar();
    }
    function desenhar() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pontos) {
        const pulso = 0.6 + 0.4 * Math.sin(relogio * 0.0012 + p.f);
        const a = p.a * pulso;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(' + p.c + ',' + a + ')');
        g.addColorStop(0.55, 'rgba(' + p.c + ',' + a * 0.45 + ')');
        g.addColorStop(1, 'rgba(' + p.c + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        if (p.brilho) { // faísca em cruz
          const s = Math.pow(Math.max(0, Math.sin(relogio * 0.0016 + p.f)), 3);
          if (s > 0.05) {
            ctx.strokeStyle = 'rgba(255,236,190,' + (0.5 * s) + ')'; ctx.lineWidth = 1;
            const t = 4 + 6 * s;
            ctx.beginPath(); ctx.moveTo(p.x - t, p.y); ctx.lineTo(p.x + t, p.y); ctx.moveTo(p.x, p.y - t); ctx.lineTo(p.x, p.y + t); ctx.stroke();
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function quadro(t) {
      raf = 0;
      if (!visivel || document.hidden || !ligado()) return;
      const dt = Math.min(64, t - ultimo);
      if (dt >= 33) {
        ultimo = t;
        if (!rolando) { // congela durante a rolagem e retoma pelo próprio relógio, sem salto
          relogio += dt;
          for (const p of pontos) {
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.y < -p.r) { p.y = h + p.r; p.x = Math.random() * w; }
            if (p.x < -p.r) p.x = w + p.r; else if (p.x > w + p.r) p.x = -p.r;
          }
          desenhar();
        }
      }
      raf = requestAnimationFrame(quadro);
    }
    function iniciar() { if (!raf && visivel && ligado()) { ultimo = performance.now(); raf = requestAnimationFrame(quadro); } }
    new IntersectionObserver(([en]) => { visivel = en.isIntersecting; if (visivel) { if (!w) dimensionar(); iniciar(); } }).observe(canvas);
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (visivel || w) dimensionar(); }).observe(canvas);
    document.addEventListener('visibilitychange', iniciar);
    document.addEventListener('qb:motion', iniciar);
  }
  $$('canvas[data-bokeh]').forEach(criarBokeh);

  /* ---------- Túnel da galeria e anel do "Como funciona" ---------- */
  const galeria = $('.galeria');
  const anel = $('.como__anel');
  function prepararPalcosCSS() {
    const alto = innerHeight > 520;
    if (galeria) galeria.classList.toggle('tunel-on', ligado() && alto);
    if (anel) anel.classList.toggle('anel-on', ligado() && innerWidth > 1020);
  }
  prepararPalcosCSS();
  window.addEventListener('resize', prepararPalcosCSS);
  // Sem animation-timeline (Firefox): o JS calcula --t e --giro na rolagem.
  if (!suportaView) {
    const tunel = $('.galeria__tunel');
    const como = $('#como');
    let ag = false;
    const atualizar = () => {
      ag = false;
      if (galeria && galeria.classList.contains('tunel-on')) {
        const r = galeria.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
        tunel.style.setProperty('--t', t.toFixed(4));
      }
      if (anel && anel.classList.contains('anel-on') && como) {
        const r = como.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
        const q = Math.min(1, Math.max(0, (p - 0.15) / 0.7));
        anel.style.setProperty('--giro', (22 - 164 * q).toFixed(2) + 'deg');
      }
    };
    window.addEventListener('scroll', () => { if (!ag) { ag = true; requestAnimationFrame(atualizar); } }, { passive: true });
    atualizar();
  }

  /* ---------- Botão "Pausar efeitos" ---------- */
  function definirMovimento(on) {
    html.classList.toggle('motion-on', on);
    html.classList.toggle('motion-paused', !on);
    try { localStorage.setItem('qb-movimento', on ? 'on' : 'off'); } catch (e) { /* ok */ }
    $$('[data-motion-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(!on)));
    if (on) { ligarLenis(); $$('[data-type]').forEach((el) => { if (!el.classList.contains('digitando')) el.textContent = el.dataset.textoOriginal; }); }
    else { desligarLenis(); $$('[data-type]').forEach((el) => { el.classList.remove('digitando'); el.textContent = el.dataset.textoOriginal; }); }
    prepararPalcosCSS();
    document.dispatchEvent(new CustomEvent('qb:motion', { detail: on }));
  }
  $$('[data-motion-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(!ligado()));
    b.addEventListener('click', () => { definirMovimento(!ligado()); if (window.QBSom) window.QBSom.tocar('alternar'); });
  });

  /* ---------- Início ---------- */
  prepararDigitacao();
  $$('[data-letters]').forEach(quebrarLetras);
  prepararRevelacoes(document);
  document.addEventListener('qb:conteudo', (e) => prepararRevelacoes(e.detail && e.detail.raiz && e.detail.raiz.nodeType === 1 ? e.detail.raiz.parentElement : document));
  ligarLenis();
})();
