/* QBrindes — sons sintetizados com Web Audio, no limite do perceptível.
   Só começam depois do primeiro gesto e são desligados pelo botão "Som". */
(function () {
  'use strict';

  const html = document.documentElement;
  const AC = window.AudioContext || window.webkitAudioContext;
  let ligado = true;
  try { ligado = localStorage.getItem('qb-som') !== 'off'; } catch (e) { /* ok */ }

  let ctx = null, mestre = null, clickBus = null, ruido = null, trilha = null, papel = null, laserNo = null, pronto = false;

  function criarContexto() {
    if (ctx || !AC || !ligado) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -30; comp.knee.value = 20; comp.ratio.value = 3;
    mestre = ctx.createGain(); mestre.gain.value = 1;
    comp.connect(mestre); mestre.connect(ctx.destination);
    clickBus = ctx.createBiquadFilter(); clickBus.type = 'lowpass'; clickBus.frequency.value = 1400;
    clickBus.connect(comp);
    ctx._entrada = comp;
    // Partes pesadas depois do clique, para não atrasar a resposta.
    setTimeout(montarPesado, 120);
  }

  function bufferRuido(seg) {
    const n = Math.floor(ctx.sampleRate * seg);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    return b;
  }

  function reverbIR(seg) {
    const n = Math.floor(ctx.sampleRate * seg);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    const fator = Math.exp(Math.log(0.001) / n); // decaimento multiplicativo (sem Math.pow por amostra)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let g = 1, s = 777 + c * 999;
      for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * g; g *= fator; }
    }
    return b;
  }

  function montarPesado() {
    if (!ctx || pronto) return;
    ruido = bufferRuido(2);
    montarPapel();
    montarTrilha();
    pronto = true;
  }

  /* ---------- Efeitos curtos ---------- */
  function tom(freq, pico, dur, quando) {
    const t = ctx.currentTime + (quando || 0);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.9, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(clickBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function filtroRuido(tipo, f0, f1, f2, pico, dur, q) {
    if (!ruido) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = ruido;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const bp = ctx.createBiquadFilter(); bp.type = tipo; bp.Q.value = q || 1.2;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
    if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(ctx._entrada);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  const RECEITAS = {
    clique: () => { tom(420, 0.04, 0.09); tom(210, 0.02, 0.11); },
    alternar: () => { tom(330, 0.038, 0.1); tom(165, 0.018, 0.12); },
    adicionar: () => { tom(392, 0.04, 0.12); tom(523, 0.035, 0.16, 0.07); },
    hover: () => filtroRuido('bandpass', 420, 1150, 0, 0.022, 0.17, 1.4),
    virada: () => filtroRuido('bandpass', 900, 2200, 1200, 0.012, 0.36, 0.9),
    brilho: () => { tom(1046, 0.012, 0.5); tom(1318, 0.009, 0.6, 0.06); tom(1568, 0.007, 0.7, 0.12); }
  };

  function tocar(nome) {
    if (!ligado || !ctx || ctx.state !== 'running') return;
    const r = RECEITAS[nome];
    if (r) r();
  }

  /* ---------- Rolagem: sopro de ar bem suave ----------
     Ruído marrom (sem chiado agudo), só graves e médios, ganho mínimo e envelopes lentos,
     para soar como papel de seda deslizando longe, nunca áspero. */
  function bufferMarrom(seg) {
    const n = Math.floor(ctx.sampleRate * seg);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 4242, ultimo = 0;
    for (let i = 0; i < n; i++) {
      s = (s * 16807) % 2147483647;
      const branco = (s / 2147483647) * 2 - 1;
      ultimo = (ultimo + 0.02 * branco) / 1.02;
      d[i] = ultimo * 3.2;
    }
    // Emenda o fim no começo para o laço não estalar.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) { const k = i / fade; d[n - fade + i] = d[n - fade + i] * (1 - k) + d[i] * k; }
    return b;
  }
  function montarPapel() {
    const src = ctx.createBufferSource(); src.buffer = bufferMarrom(4); src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.3;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1400; lp2.Q.value = 0.2;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(ctx._entrada);
    src.start();
    papel = { g, lp };
  }
  let ultimoY = window.scrollY, ultimoT = performance.now(), paradoTimer = 0;
  window.addEventListener('scroll', () => {
    const agora = performance.now();
    const v = Math.abs(window.scrollY - ultimoY) / Math.max(8, agora - ultimoT); // px/ms
    ultimoY = window.scrollY; ultimoT = agora;
    if (!papel || !ligado || !ctx || ctx.state !== 'running') return;
    const forca = Math.min(1, Math.max(0, (v - 0.1) / 3));
    const t = ctx.currentTime;
    papel.g.gain.setTargetAtTime(0.0045 * Math.pow(forca, 1.15), t, 0.18);
    papel.lp.frequency.setTargetAtTime(520 + forca * 380, t, 0.25);
    clearTimeout(paradoTimer);
    paradoTimer = setTimeout(() => { if (papel && ctx) papel.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); }, 120);
  }, { passive: true });

  /* ---------- Laser: zumbido baixo enquanto grava ---------- */
  function laser(on) {
    if (!ligado || !ctx || ctx.state !== 'running' || !ruido) return;
    const t = ctx.currentTime;
    if (on && !laserNo) {
      const src = ctx.createBufferSource(); src.buffer = ruido; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 3;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 180;
      const og = ctx.createGain(); og.gain.value = 0.35;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.006, t + 0.08);
      src.connect(bp); bp.connect(g); o.connect(og); og.connect(g); g.connect(ctx._entrada);
      src.start(t); o.start(t);
      laserNo = { src, o, g };
    } else if (!on && laserNo) {
      const n = laserNo; laserNo = null;
      n.g.gain.setTargetAtTime(0.0001, t, 0.04);
      n.src.stop(t + 0.3); n.o.stop(t + 0.3);
    }
  }

  /* ---------- Trilha de fundo: cordas lentas em ré maior ---------- */
  const ACORDES = [
    [38, [57, 61, 64, 66], 73],
    [47, [57, 62, 64, 66], 74],
    [43, [57, 59, 62, 66], 71],
    [45, [57, 62, 64, 69], 69],
    [45, [57, 61, 64, 69], null]
  ];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function montarTrilha() {
    const bus = ctx.createGain(); bus.gain.value = 0.0001;
    const seco = ctx.createGain(); seco.gain.value = 0.55;
    const rev = ctx.createConvolver(); rev.buffer = reverbIR(2.8);
    const molhado = ctx.createGain(); molhado.gain.value = 0.9;
    bus.connect(seco); seco.connect(ctx._entrada);
    bus.connect(rev); rev.connect(molhado); molhado.connect(ctx._entrada);
    trilha = { bus, proximo: ctx.currentTime + 0.5, indice: 0, timer: 0 };
    bus.gain.setTargetAtTime(1, ctx.currentTime, 2.5);
    agendar();
    trilha.timer = setInterval(agendar, 4000);
  }

  function voz(freq, inicio, dur, vol, corte, atrasoVibrato) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, inicio);
    g.gain.linearRampToValueAtTime(vol, inicio + 3.5);
    g.gain.setValueAtTime(vol, inicio + dur - 5);
    g.gain.linearRampToValueAtTime(0, inicio + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = corte; lp.Q.value = 0.4;
    lp.connect(g); g.connect(trilha.bus);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    const lfoG = ctx.createGain(); lfoG.gain.setValueAtTime(0, inicio); lfoG.gain.linearRampToValueAtTime(freq * 0.004, inicio + atrasoVibrato + 1.5);
    lfo.connect(lfoG);
    [-4, 4].forEach((cents) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = freq; o.detune.value = cents;
      lfoG.connect(o.frequency);
      o.connect(lp); o.start(inicio); o.stop(inicio + dur + 0.1);
    });
    lfo.start(inicio); lfo.stop(inicio + dur + 0.1);
  }

  function agendar() {
    if (!trilha || !ctx || ctx.state !== 'running') return;
    while (trilha.proximo < ctx.currentTime + 12) {
      const [baixo, vozes, violino] = ACORDES[trilha.indice % ACORDES.length];
      const t = trilha.proximo;
      voz(hz(baixo), t, 9, 0.0045, 380, 2);
      vozes.forEach((m) => voz(hz(m), t, 9, 0.002, 1100, 2.5));
      if (violino && trilha.indice % 2 === 0) voz(hz(violino), t + 0.6, 8.4, 0.0013, 1700, 1.8);
      trilha.indice++;
      trilha.proximo += 9 - 5.5;
    }
  }

  /* ---------- Desbloqueio e botão ---------- */
  function desbloquear() {
    if (!ligado) return;
    if (!ctx) criarContexto();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, desbloquear, { capture: true, passive: true }));

  let suspenderTimer = 0;
  function definir(on) {
    ligado = on;
    try { localStorage.setItem('qb-som', on ? 'on' : 'off'); } catch (e) { /* ok */ }
    document.querySelectorAll('[data-som-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    clearTimeout(suspenderTimer);
    if (!ctx) { if (on) desbloquear(); return; }
    const t = ctx.currentTime;
    if (on) {
      ctx.resume().then(() => {
        if (trilha) { trilha.bus.gain.cancelScheduledValues(ctx.currentTime); trilha.bus.gain.setTargetAtTime(1, ctx.currentTime, 2.5); trilha.proximo = Math.max(trilha.proximo, ctx.currentTime + 0.2); agendar(); }
        RECEITAS.alternar();
      });
    } else {
      if (trilha) trilha.bus.gain.setTargetAtTime(0.0001, t, 0.6);
      if (papel) papel.g.gain.setTargetAtTime(0, t, 0.05);
      laser(false);
      suspenderTimer = setTimeout(() => { if (!ligado && ctx) ctx.suspend(); }, 2500);
    }
  }
  document.querySelectorAll('[data-som-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(ligado));
    b.addEventListener('click', () => definir(!ligado));
  });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (ligado) ctx.resume();
  });

  /* ---------- Gatilhos ---------- */
  const SELETOR_HOVER = 'button, .btn, [role="button"], .chip, .topo__busca, .icone, .cat, .ocasiao, .opcoes label';
  let ultimoHover = 0, ultimoAlvo = null;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const alvo = e.target.closest(SELETOR_HOVER);
      if (!alvo || alvo === ultimoAlvo) return;
      ultimoAlvo = alvo;
      const agora = performance.now();
      if (agora - ultimoHover < 70) return;
      ultimoHover = agora;
      tocar('hover');
    }, { passive: true });
    document.addEventListener('pointerout', (e) => { if (ultimoAlvo && !ultimoAlvo.contains(e.relatedTarget)) ultimoAlvo = null; }, { passive: true });
  }
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('a, button, summary');
    if (!alvo || alvo.matches('[data-som-toggle], [data-add], [data-chip], [data-theme-toggle], [data-motion-toggle], [data-cor], [data-termo], [data-item-qtd], [data-qtd], [data-remover], [data-ficha-cor], [data-ficha-emb]')) return;
    tocar('clique');
  });
  document.addEventListener('qb:etapa', () => tocar('virada'));
  document.addEventListener('qb:confete', () => tocar('brilho'));
  document.addEventListener('qb:laser', (e) => laser(!!(e.detail && e.detail.on)));

  window.QBSom = { tocar, laser, get ligado() { return ligado; }, definir, _ctx: () => ctx };
})();
