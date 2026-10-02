/* QBrindes — vídeos pré-renderizados do 3D.
   Hero: o presente abre no clique (ou sozinho após 4 s com o topo visível), com som nos cues do JSON.
   Vitrine: cinco capítulos em abas que tocam em sequência, com dois vídeos em buffer (A/B),
   rótulos HTML posicionados quadro a quadro pelo JSON e botão de pausa. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const html = document.documentElement;
  const BASE = 'assets/video/';
  const V = '?v=3';
  const ligado = () => html.classList.contains('motion-on');
  const som = (nome) => window.QBSom && window.QBSom.tocar(nome);
  const laser = (on) => window.QBSom && window.QBSom.laser(on);
  const M = window.QBVideoModel;
  const economia = M.emEconomia(navigator.connection);
  const testeVideo = document.createElement('video');
  const formato = M.escolherFormato((tipo) => testeVideo.canPlayType(tipo));
  const temRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const ocioso = (fn, t) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: t || 2500 }) : setTimeout(fn, 300));
  // Chama fn quando o primeiro quadro do vídeo já está na tela (troca pôster → vídeo sem piscar)
  function aoPrimeiroQuadro(video, fn) {
    if (temRVFC) video.requestVideoFrameCallback(() => fn());
    else video.addEventListener('playing', () => requestAnimationFrame(fn), { once: true });
  }
  function aoCarregar(fn) { if (document.readyState === 'complete') fn(); else window.addEventListener('load', fn, { once: true }); }
  window.QBVideos = { formato };

  /* ===================== HERO ===================== */
  const hero = $('#inicio');
  if (hero && formato) iniciarHero();

  function iniciarHero() {
    const video = $('.hero__video', hero);
    const final = $('.hero__final', hero);
    const movel = matchMedia('(max-width: 900px)');
    let variante = '', url = '', blob = '', baixando = null, cues = [], proximoCue = 0;
    let estado = 'fechado', jaTocou = false, timer = 0;

    function definir(e) { estado = e; hero.dataset.estado = e; }
    function escolher() {
      const v = M.varianteHero(window.innerWidth);
      if (v === variante) return;
      variante = v;
      url = BASE + 'hero-' + v + '.' + formato + V;
      if (blob) { URL.revokeObjectURL(blob); blob = ''; }
      if (baixando) { baixando.abort(); baixando = null; }
      if (estado !== 'tocando') video.removeAttribute('src');
      if (estado === 'fim') mostrarFinal();
    }
    escolher();
    movel.addEventListener('change', () => { if (estado !== 'tocando') escolher(); });

    fetch(BASE + 'hero.json' + V).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.cues) return;
      const c = j.cues;
      cues = [[c.laco, () => som('virada')], [c.ouro, () => som('brilho')], [c.produtos, () => som('virada')], [c.laser, () => laser(true)], [c.laserFim, () => laser(false)]]
        .filter((x) => typeof x[0] === 'number').sort((a, b) => a[0] - b[0]);
    }).catch(() => {});

    // Baixa o vídeo inteiro em segundo plano depois do load (tocar fica instantâneo); nunca em economia de dados
    function precarregar() {
      if (economia || blob || baixando) return;
      const alvo = url;
      baixando = new AbortController();
      fetch(alvo, { signal: baixando.signal }).then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
        .then((b) => { if (alvo === url) blob = URL.createObjectURL(b); })
        .catch(() => {}).finally(() => { baixando = null; });
    }
    aoCarregar(() => ocioso(precarregar, 3000));

    let idCue = 0;
    function vigiarCues(agora, meta) {
      idCue = 0;
      if (estado !== 'tocando') return;
      const t = meta ? meta.mediaTime : video.currentTime;
      proximoCue = M.dispararCues(cues, proximoCue, t, (c) => c[1]());
      if (temRVFC) idCue = video.requestVideoFrameCallback(vigiarCues);
    }
    if (!temRVFC) video.addEventListener('timeupdate', () => vigiarCues());

    function mostrarFinal() {
      final.src = BASE + 'hero-' + variante + '-fim.webp' + V;
      final.hidden = false;
      const on = () => final.classList.add('on');
      if (final.complete) requestAnimationFrame(on); else final.addEventListener('load', on, { once: true });
    }

    function tocar() {
      if (estado === 'tocando') return;
      clearTimeout(timer);
      jaTocou = true;
      if (!ligado()) { mostrarFinal(); definir('fim'); return; } // sem movimento: vai direto ao presente aberto
      if (baixando && !blob) { baixando.abort(); baixando = null; }
      const src = blob || url;
      if (video.getAttribute('src') !== src) video.src = src;
      else video.currentTime = 0;
      proximoCue = 0;
      const p = video.play();
      aoPrimeiroQuadro(video, () => {
        definir('tocando');
        final.classList.remove('on');
        if (temRVFC) { if (idCue) video.cancelVideoFrameCallback(idCue); idCue = video.requestVideoFrameCallback(vigiarCues); }
      });
      if (p && p.catch) p.catch(() => { if (estado !== 'tocando') definir('fechado'); }); // autoplay bloqueado (ex.: modo de economia do iPhone): o botão continua
    }
    video.addEventListener('ended', () => { definir('fim'); laser(false); });
    video.addEventListener('error', () => { if (estado === 'tocando') { mostrarFinal(); definir('fim'); } });

    $('[data-abrir-presente]', hero).addEventListener('click', tocar);
    $('[data-rever]', hero).addEventListener('click', () => { final.classList.remove('on'); definir('fechado'); tocar(); });
    $('.hero__flutua', hero).addEventListener('click', () => { if (estado === 'fechado') tocar(); });

    // Sozinho após 4 s com o topo visível e sem interação (uma vez só)
    function agendar(visivel) {
      clearTimeout(timer);
      if (M.deveAgendarAuto({ visivel, jaTocou, movimento: ligado(), oculto: document.hidden })) timer = setTimeout(tocar, M.ESPERA_AUTO_MS);
    }
    let heroVisivel = false;
    new IntersectionObserver(([en]) => { heroVisivel = en.isIntersecting; agendar(heroVisivel); }, { threshold: 0.6 }).observe($('#palco-hero'));
    document.addEventListener('visibilitychange', () => agendar(heroVisivel));
    document.addEventListener('qb:motion', (e) => { if (!e.detail && estado === 'tocando') { video.pause(); laser(false); mostrarFinal(); definir('fim'); } agendar(heroVisivel); });
    window.QBHero = { tocar, estado: () => estado, variante: () => variante };
  }

  /* ===================== VITRINE ===================== */
  const vit = $('#vitrine');
  if (vit) iniciarVitrine();

  function iniciarVitrine() {
    const NOMES = ['copo', 'caneta', 'chaveiro', 'garrafa', 'taca'];
    const abas = $$('[role="tab"]', vit);
    const caps = $$('.cap', vit);
    const videos = $$('.vitrine__video', vit);
    const poster = $('.vitrine__poster', vit);
    const rotulosEl = $('#rotulos-vitrine');
    const legenda = $('.vitrine__legenda', vit);
    const btnPausa = $('.vitrine__pausa', vit);
    const btnTocar = $('.vitrine__tocar', vit);
    const usar720 = M.usar720(Math.min(screen.width, screen.height), window.devicePixelRatio, economia);
    const metas = {};
    let atual = 0, frente = null, pausado = false, visivel = false, iniciado = false, comSom = false, laserOn = false;
    let rotulos = [], legendaAtual = '';

    const urlDe = (i) => BASE + 'vit-' + NOMES[i] + (usar720 ? '-720' : '') + '.' + formato + V;
    poster.src = BASE + 'vit-' + NOMES[0] + '-meio.webp' + V;

    function carregarMeta(i) {
      if (!metas[i]) {
        metas[i] = fetch(BASE + 'vit-' + NOMES[i] + '.json' + V).then((r) => (r.ok ? r.json() : null)).then((j) => {
          if (!j) return null;
          const defs = (j.extra && j.extra.rotulos) || [];
          const pts = defs.map(() => []);
          (j.porQuadro || []).forEach((q) => (q.r || []).forEach(([k, x, y]) => pts[k] && pts[k].push([q.i / j.fps, x, y])));
          return { fps: j.fps, dur: j.quadros / j.fps, cues: j.cues || {}, rotulos: defs.map((d, k) => Object.assign({ pts: pts[k] }, d)) };
        }).catch(() => null);
      }
      return metas[i];
    }

    /* Rótulos: um elemento por rótulo do capítulo; posição interpolada entre amostras (a cada 3 quadros) */
    function montarRotulos(meta) {
      rotulosEl.textContent = '';
      rotulos = (meta ? meta.rotulos : []).map((r) => {
        const el = document.createElement('div');
        el.className = 'rotulo' + (r.lado < 0 ? ' rotulo--esq' : '');
        el.innerHTML = '<b></b><i></i><span></span>';
        el.lastChild.textContent = r.texto;
        rotulosEl.appendChild(el);
        return Object.assign({ el, on: false, x: -1, y: -1 }, r);
      });
      legendaAtual = '';
      if (legenda) legenda.textContent = '';
    }
    function atualizarRotulos(t) {
      let texto = '';
      for (const r of rotulos) {
        const on = t >= r.de && t <= r.ate;
        if (on !== r.on) { r.on = on; r.el.classList.toggle('on', on); }
        if (!on) continue;
        texto = r.texto;
        const p = M.posicaoRotulo(r.pts, t);
        if (!p) continue;
        const x = Math.round(p[0] * 1000) / 10, y = Math.round(p[1] * 1000) / 10;
        if (x !== r.x || y !== r.y) { r.x = x; r.y = y; r.el.style.left = x + '%'; r.el.style.top = y + '%'; }
      }
      if (legenda && texto !== legendaAtual) {
        legendaAtual = texto;
        legenda.classList.add('trocando');
        setTimeout(() => { legenda.textContent = legendaAtual; legenda.classList.remove('trocando'); }, 180);
      }
    }
    let cuesCap = [], proxCue = 0, vigia = null;
    // Uma única cadeia de callbacks por vez (pausar e retomar não duplica o trabalho por quadro)
    function pararVigia() {
      if (!vigia) return;
      if (vigia.v && vigia.id && vigia.v.cancelVideoFrameCallback) vigia.v.cancelVideoFrameCallback(vigia.id);
      if (vigia.raf) cancelAnimationFrame(vigia.raf);
      vigia = null;
    }
    function vigiar() { pararVigia(); vigia = {}; passoVigia(); }
    function passoVigia(agora, meta) {
      const v = frente;
      if (!vigia || !v || v.paused) { vigia = null; return; }
      const t = meta ? meta.mediaTime : v.currentTime;
      atualizarRotulos(t);
      proxCue = M.dispararCues(cuesCap, proxCue, t, (c) => c[1]());
      if (temRVFC) { vigia.v = v; vigia.id = v.requestVideoFrameCallback(passoVigia); }
      else vigia.raf = requestAnimationFrame(() => passoVigia());
    }
    function prepararCues(meta) {
      const c = (meta && meta.cues) || {};
      const lista = [];
      const liga = (on) => () => { laserOn = on; if (comSom) laser(on); };
      [['laser', true], ['laserFim', false], ['laser2', true], ['laser2Fim', false]].forEach(([k, on]) => { if (typeof c[k] === 'number') lista.push([c[k], liga(on)]); });
      cuesCap = lista.sort((a, b) => a[0] - b[0]);
      proxCue = 0;
    }

    function progresso(i, dur, rodando) {
      abas.forEach((a, k) => {
        const b = $('.vitrine__prog b', a);
        if (k !== i) { b.style.animation = 'none'; return; }
        b.style.animation = 'none'; void b.offsetWidth;
        b.style.animation = 'vit-prog ' + dur + 's linear forwards';
        b.style.animationPlayState = rodando ? 'running' : 'paused';
      });
    }
    function pausarProgresso(p) { const b = $('.vitrine__prog b', abas[atual]); if (b) b.style.animationPlayState = p ? 'paused' : 'running'; }

    function marcarAba(i, focar) {
      abas.forEach((a, k) => { a.setAttribute('aria-selected', String(k === i)); a.tabIndex = k === i ? 0 : -1; });
      caps.forEach((c, k) => { c.hidden = k !== i; c.classList.toggle('ativo', k === i); });
      vit.dataset.cap = String(i);
      if (focar) abas[i].focus();
      // mantém a aba visível na faixa rolável (celular)
      const a = abas[i], f = a.parentElement;
      if (a.offsetLeft < f.scrollLeft || a.offsetLeft + a.offsetWidth > f.scrollLeft + f.clientWidth) f.scrollTo({ left: a.offsetLeft - 16, behavior: ligado() ? 'smooth' : 'auto' });
    }

    function carregarEm(v, i) {
      if (v.dataset.i === String(i)) return;
      v.dataset.i = String(i);
      v.preload = 'auto';
      v.src = urlDe(i);
    }

    function selecionar(i, focar) {
      atual = i;
      marcarAba(i, focar);
      if (laserOn) { laserOn = false; laser(false); }
      poster.src = BASE + 'vit-' + NOMES[i] + '-meio.webp' + V;
      const metaP = carregarMeta(i);
      if (!podeTocar()) { mostrarParado(); metaP.then(montarRotulos); return; }
      const atras = videos.find((v) => v !== frente) || videos[0];
      carregarEm(atras, i);
      try { atras.currentTime = 0; } catch (e) { /* ainda sem metadados */ }
      const p = atras.play();
      aoPrimeiroQuadro(atras, () => {
        if (atual !== i) return;
        const antes = frente;
        frente = atras;
        atras.classList.add('ativo');
        if (antes && antes !== atras) { antes.classList.remove('ativo'); antes.pause(); }
        btnTocar.hidden = true;
        metaP.then((m) => {
          if (atual !== i) return;
          montarRotulos(m); prepararCues(m);
          progresso(i, (m && m.dur) || atras.duration || 7, !atras.paused);
          vigiar();
          // pré-carrega o próximo capítulo no buffer livre
          ocioso(() => { if (atual === i && antes && antes !== frente) carregarEm(antes, M.proximaAba(i, NOMES.length)); }, 1500);
        });
      });
      if (p && p.catch) p.catch(() => { if (atual === i) mostrarParado(true); });
    }

    function podeTocar() { return !!formato && ligado() && !pausado && visivel && !document.hidden; }
    function mostrarParado(bloqueado) {
      if (frente) frente.pause();
      btnTocar.hidden = !(bloqueado || !ligado());
      pausarProgresso(true);
      if (laserOn) { laserOn = false; laser(false); }
    }
    function retomar() {
      if (!podeTocar()) return;
      if (!frente || frente.dataset.i !== String(atual)) { selecionar(atual); return; }
      const p = frente.play();
      pausarProgresso(false);
      vigiar();
      if (p && p.catch) p.catch(() => mostrarParado(true));
    }

    videos.forEach((v) => v.addEventListener('ended', () => { if (v === frente && podeTocar()) selecionar(M.proximaAba(atual, NOMES.length)); }));

    abas.forEach((a, i) => {
      a.addEventListener('click', () => { comSom = true; pausado = false; btnPausa.setAttribute('aria-pressed', 'false'); btnPausa.setAttribute('aria-label', 'Pausar a vitrine'); visivel = true; selecionar(i); som('clique'); });
      a.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); selecionar(e.key === 'Home' ? 0 : abas.length - 1, true); return; }
        if (!d) return;
        e.preventDefault();
        selecionar(M.proximaAba(i, abas.length, d), true);
      });
    });
    btnPausa.addEventListener('click', () => {
      pausado = !pausado;
      btnPausa.setAttribute('aria-pressed', String(pausado));
      btnPausa.setAttribute('aria-label', pausado ? 'Continuar a vitrine' : 'Pausar a vitrine');
      if (pausado) mostrarParado(); else retomar();
    });
    btnTocar.addEventListener('click', () => {
      comSom = true; pausado = false; visivel = true;
      btnTocar.hidden = true;
      // gesto do usuário: pode tocar mesmo com efeitos pausados (é uma escolha explícita)
      const v = frente || videos[0];
      carregarEm(v, atual);
      const p = v.play();
      aoPrimeiroQuadro(v, () => { frente = v; v.classList.add('ativo'); carregarMeta(atual).then((m) => { montarRotulos(m); prepararCues(m); progresso(atual, (m && m.dur) || v.duration || 7, true); vigiar(); }); });
      if (p && p.catch) p.catch(() => { btnTocar.hidden = false; });
    });

    // Só baixa e toca quando a vitrine está perto da tela; pausa fora dela e com a aba do navegador oculta
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !iniciado) { iniciado = true; carregarMeta(0); if (formato && ligado()) carregarEm(videos[0], 0); }
    }, { rootMargin: '60% 0px' }).observe(vit);
    new IntersectionObserver(([en]) => {
      visivel = en.isIntersecting;
      if (visivel) retomar(); else if (frente) mostrarParado();
    }, { threshold: 0.35 }).observe($('.vitrine__tela', vit));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (frente) mostrarParado(); } else retomar(); });
    document.addEventListener('qb:motion', (e) => { if (e.detail) retomar(); else mostrarParado(); });
    if (!formato) btnTocar.hidden = true;
    carregarMeta(0).then((m) => { if (!frente) montarRotulos(m); });
    window.QBVitrine = { selecionar, estado: () => ({ atual, pausado, visivel, tocando: !!(frente && !frente.paused), buffer: videos.map((v) => v.dataset.i) }) };
  }
})();
