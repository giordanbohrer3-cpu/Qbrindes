/* QBrindes — cena do mimo: o cartão do desconto sai do presente aberto, com luzes, voo 3D e confete.
   Carregada no ócio por js/mimo.js (que guarda o estado do cupom em window.QBCupom).
   Escuta 'qb:presente' do hero (js/videos.js): tocando → revelar → (fechar ao ver de novo). */
(function () {
  'use strict';

  const C = window.QBCupom;
  if (!C || !C.config) return;
  const P = window.QBPedido;
  const vigente = C.config;
  const { ler, gravar, guardar } = C._cena;

  const pronto = (fn) => (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn());
  pronto(montar);

  function montar() {
    const $ = (s, r) => (r || document).querySelector(s);
    const html = document.documentElement;
    const hero = $('#inicio'), palco = $('#palco-hero'), mimo = $('#mimo');
    if (!hero || !palco || !mimo) return;
    const giro = $('.mimo__giro', mimo), voo = $('.mimo__voo', mimo), cena = $('.mimo__cena', mimo), inclina = $('.mimo__inclina', mimo);
    const frente = $('.mimo__frente', mimo), verso = $('.mimo__verso', mimo);
    const num = $('[data-mimo-pct]', mimo), aviso = $('#mimo-aviso'), brilho = $('.mimo__frente .mimo__brilho', mimo);
    const movel = matchMedia('(max-width: 900px)');
    const ponteiroFino = matchMedia('(hover: hover) and (pointer: fine)');
    const ligado = () => html.classList.contains('motion-on');
    const som = (n) => window.QBSom && window.QBSom.tocar(n);
    const toast = (t) => window.QBApp && window.QBApp.toast(t);

    /* ---------- Textos (todos da config) ---------- */
    const pct = vigente.pct + '%';
    num.innerHTML = vigente.pct + '<small>%</small>';
    $('[data-mimo-cod]', mimo).textContent = vigente.codigo;
    $('[data-mimo-copiar]', mimo).setAttribute('aria-label', 'Copiar o código ' + vigente.codigo);
    $('[data-mimo-cond]', mimo).textContent = P.textoCondicoes(vigente);
    const validade = $('[data-mimo-resumo]', mimo);
    validade.textContent = vigente.validade ? 'Válido até ' + P.dataBR(vigente.validade) + ', no primeiro pedido pelo WhatsApp.' : '';
    validade.hidden = !vigente.validade;
    const regras = $('#regras-cupom');
    if (regras) {
      $('[data-cupom-pergunta]', regras).textContent = 'Como funciona o desconto de ' + pct + ' na primeira compra?';
      $('[data-cupom-regras]', regras).textContent = 'Ao abrir o presente no topo do site, o código ' + vigente.codigo +
        ' fica guardado no seu pedido e vai junto na mensagem do WhatsApp (se preferir, é só dizer o código na conversa). ' + P.textoCondicoes(vigente);
      regras.hidden = false;
    }

    /* ---------- Onde a caixa está na tela ----------
       Âncoras medidas no último quadro de cada vídeo (u, v em 0–1); o vídeo cobre o palco com object-fit: cover. */
    const ANC = {
      d: { w: 1920, h: 1080, ox: 0.72, boca: [0.719, 0.574], labio: 0.593, face: [0.596, 0.781], chao: 0.87 },
      m: { w: 1080, h: 1350, ox: 0.5, boca: [0.46, 0.585], labio: 0.604, face: [0.264, 0.611], chao: 0.82 }
    };
    let geo = null;
    // Onde o texto do topo termina de verdade (as linhas do título, o parágrafo e os botões; não as caixas, que são mais largas)
    function direitaDoTexto() {
      let d = 0;
      hero.querySelectorAll('.hero__titulo .linha > span, .hero__lead, .hero__acoes > *').forEach((e) => { d = Math.max(d, e.getBoundingClientRect().right); });
      return d;
    }
    function medir() {
      const a = ANC[movel.matches ? 'm' : 'd'];
      const r = palco.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      const W = r.width, H = r.height;
      const s = Math.max(W / a.w, H / a.h);
      const ox = (W - a.w * s) * a.ox, oy = (H - a.h * s) * 0.5;
      const X = (u) => ox + u * a.w * s, Y = (v) => oy + v * a.h * s;
      const face = X(a.face[1]) - X(a.face[0]);
      const acao = $('.hero__acao', hero).getBoundingClientRect();
      const topoBotoes = acao.height ? acao.top - r.top : H * 0.85;
      let cw, cx, base;
      if (movel.matches) {
        cw = Math.min(Math.max(288, W * 0.92), 340, window.innerWidth - 32);
        cx = W / 2;
        // Assenta no pé da cena quando o topo fica abaixo da caneca (v 0,55); em palco baixo (iPhone SE),
        // sobe e cobre a faixa inteira da caneca e do "Seu nome", sem cortar nada pela metade
        const hc = cena.offsetHeight;
        base = H - 6 - hc >= Y(0.55) ? H - 6 : Math.min(H - 6, Y(0.395) + hc);
      } else {
        cw = Math.min(Math.max(300, face * 1.12), 380);
        // Nunca encosta no texto do topo
        const texto = direitaDoTexto() - r.left;
        cx = Math.min(Math.max(X(a.boca[0]), texto + 32 + cw / 2), W - 24 - cw / 2);
        base = Math.min(Y(a.chao) + 0.012 * H, topoBotoes - 18);
      }
      geo = { W, H, X, Y, a, face, cw, cx, base, bx: X(a.boca[0]), by: Y(a.boca[1]), labio: Y(a.labio), palcoTopo: r.top - hr.top, palcoEsq: r.left - hr.left, hero: hr, texto: movel.matches ? null : direitaDoTexto() - hr.left };
      const st = mimo.style;
      st.setProperty('--cw', cw + 'px');
      st.setProperty('--cl', (cx - cw / 2) + 'px');
      st.setProperty('--cb', (H - base) + 'px');
      st.setProperty('--bx', geo.bx + 'px');
      st.setProperty('--by', geo.by + 'px');
      st.setProperty('--face', face + 'px');
      st.setProperty('--ch', cena.offsetHeight + 'px');
    }

    /* ---------- Cena ---------- */
    let animacoes = [], timers = [], visivel = false, anunciado = false, aberto = false, saida = null;
    // Medido na hora da revelação (a cena pode chegar depois do evento, antes de qualquer observador responder)
    function noTopo() {
      const r = palco.getBoundingClientRect();
      const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      return r.height > 0 && vis / r.height > 0.35;
    }
    new ResizeObserver(() => { if (aberto) requestAnimationFrame(medir); }).observe(palco);
    movel.addEventListener('change', () => { if (aberto) requestAnimationFrame(medir); });

    function limpar() {
      if (saida) { saida.forEach((a) => { a.onfinish = null; a.cancel(); }); saida = null; } // fade de um fechar anterior
      animacoes.forEach((a) => a.cancel()); animacoes = [];
      timers.forEach(clearTimeout); timers = [];
      if (window.QBConfete) window.QBConfete.parar();
      mimo.classList.remove('mimo--voando');
    }
    const depois = (ms, fn) => timers.push(setTimeout(fn, ms));
    const anim = (el, kf, op) => { const a = el.animate(kf, Object.assign({ fill: 'backwards' }, op)); animacoes.push(a); return a; };

    function anunciar(curto) {
      if (anunciado) return;
      anunciado = true;
      aviso.textContent = curto ? 'O código ' + vigente.codigo + ' já está guardado no seu pedido.'
        : 'Você ganhou ' + pct + ' de desconto na primeira compra. O código ' + vigente.codigo + ' já está guardado no seu pedido.';
    }

    function revelar(d) {
      limpar();
      virar(false, true);
      const jaFesta = !!(ler() && ler().festa);
      guardar();
      visivel = noTopo();
      const animar = d.movimento && ligado() && visivel;
      const festa = animar && (d.gesto || !jaFesta);
      $('[data-mimo-selo]', mimo).textContent = jaFesta && !d.gesto ? 'Seu presente continua aqui' : 'Presente de boas-vindas';
      mimo.hidden = false; mimo.classList.remove('mimo--pre'); aberto = true;
      hero.dataset.mimo = animar ? 'chegando' : 'parado';
      medir();
      if (!animar) { pousou(d, false); return; }
      if (festa) gravar({ festa: new Date().toISOString().slice(0, 10) });
      else if (window.QBConfete) window.QBConfete.liberar(); // canvases preparados à toa
      coreografia(d, festa);
    }

    function coreografia(d, festa) {
      const g = geo, hc = cena.offsetHeight;
      mimo.classList.add('mimo--voando');
      // Pontos (px no palco): centro em repouso, dentro da boca e ápice
      const xr = g.cx, yr = g.base - hc / 2;
      const s0 = Math.min(Math.max(0.78 * g.face / g.cw, 0.34), 0.55);
      const dentro = g.labio + hc * s0 / 2 + 2;
      const apice = g.labio - 0.035 * g.H - hc * s0 * 1.06 / 2;
      const dx = g.bx - xr;
      const L = (q) => ({ name: q, el: $('.mimo__' + q, mimo) });
      const luz = (q, kf, op) => anim(L(q).el, kf, op);
      const E = 'cubic-bezier(.3,0,.2,1)';
      // Luzes: a boca acende, a sala esquenta, a coluna sobe; depois assentam no repouso do CSS
      luz('boca', [{ opacity: 0 }, { opacity: 1, offset: 0.12, easing: 'cubic-bezier(.2,.7,.3,1)' }, { opacity: 1, offset: 0.61 }, { opacity: 0.45 }], { duration: 3100 });
      luz('sala', [{ opacity: 0, easing: E }, { opacity: 1, offset: 0.39 }, { opacity: 1, offset: 0.61 }, { opacity: 0.8 }], { duration: 3100 });
      luz('cone', [{ opacity: 0 }, { opacity: 0, offset: 0.013 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.61 }, { opacity: 0.4 }], { duration: 3100 });
      luz('oclusao', [{ opacity: 0 }, { opacity: 1 }], { duration: 430, delay: 1050, easing: E });
      luz('sombra', [{ opacity: 0, transform: 'scaleX(.5)' }, { opacity: 1, transform: 'none' }], { duration: 430, delay: 1050, easing: E });
      luz('rebate', [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1150, easing: E });
      // O cartão sai de dentro da caixa: recorte no lábio durante a subida
      anim(cena, [{ clipPath: 'inset(-200% -100% ' + (g.H - g.labio - (g.H - g.base)) + 'px -100%)' }, { clipPath: 'inset(-200% -100% ' + (g.H - g.labio - (g.H - g.base)) + 'px -100%)' }], { duration: 600 });
      anim(voo, [
        { transform: `translate(${dx}px, ${dentro - yr}px) scale(${s0})`, easing: 'cubic-bezier(.16,.84,.3,1)' },
        { transform: `translate(${dx}px, ${apice - yr}px) scale(${s0 * 1.06})`, offset: 0.353, easing: 'cubic-bezier(.55,0,.2,1)' },
        { transform: 'none' }
      ], { duration: 1360, delay: 120 });
      anim(giro, [
        { transform: 'rotateX(-6deg) rotateY(180deg) rotateZ(-4deg)', easing: 'cubic-bezier(.16,.84,.3,1)' },
        { transform: 'rotateX(-9deg) rotateY(172deg) rotateZ(-2deg)', offset: 0.258, easing: 'cubic-bezier(.6,0,.25,1)' },
        { transform: 'rotateX(7deg) rotateY(-5deg) rotateZ(.8deg)', offset: 0.677, easing: 'cubic-bezier(.3,0,.3,1)' },
        { transform: 'rotateX(8deg) rotateY(-3.5deg) rotateZ(.4deg)', offset: 0.731, easing: 'cubic-bezier(.4,0,.6,1)' },
        { transform: 'rotateX(-1.6deg) rotateY(1.4deg) rotateZ(0deg)', offset: 0.801, easing: 'cubic-bezier(.4,0,.6,1)' },
        { transform: 'rotateX(.6deg) rotateY(-.5deg) rotateZ(0deg)', offset: 0.887, easing: 'cubic-bezier(.4,0,.6,1)' },
        { transform: 'none' }
      ], { duration: 1860, delay: 120 });
      // Na boca o cartão é iluminado por baixo; na frente da caixa, a luz passa a vir de trás e de cima
      for (const f of [frente, verso]) {
        anim($('.mimo__luz-baixo', f), [{ opacity: 1 }, { opacity: 1, offset: 0.46 }, { opacity: 0 }], { duration: 1300, fill: 'both' });
        anim($('.mimo__luz-topo', f), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1100 });
      }
      // Reflexo único no ouro do número
      anim(num, [{ backgroundPosition: '100% 0, 0 0' }, { backgroundPosition: '0% 0, 0 0' }], { duration: 900, delay: 1520, easing: 'cubic-bezier(.4,0,.2,1)' });
      if (d.gesto) depois(120, () => som('virada'));
      if (festa) depois(160, () => folhas(d.gesto));
      depois(1480, () => { if (d.gesto) som('pouso'); });
      depois(1980, () => { mimo.classList.remove('mimo--voando'); pousou(d, true); });
    }

    function folhas(gesto) {
      if (!window.QBConfete || !ligado()) return;
      window.QBConfete.estourar(opcoesFolhas(gesto));
      if (gesto) depois(10, () => som('brilho'));
    }
    function opcoesFolhas(gesto) {
      const g = geo, hr = hero.getBoundingClientRect();
      // Só no Chromium os dois sinais são reais (no WebKit hardwareConcurrency é travado em 4 e não há deviceMemory)
      const fraco = 'deviceMemory' in navigator && (navigator.deviceMemory <= 4 || navigator.hardwareConcurrency <= 4);
      const k = fraco ? 0.6 : 1;
      const boca = { x: g.palcoEsq + g.bx, y: g.palcoTopo + g.labio };
      // Área: no PC, do fim do texto até a direita; no celular, o palco e um pouco acima dele (as folhas passam por trás do título)
      const area = movel.matches
        ? { x: 0, y: Math.max(0, g.palcoTopo - 0.45 * g.H), w: hr.width, h: g.palcoTopo + g.H - Math.max(0, g.palcoTopo - 0.45 * g.H) }
        : { x: Math.max(0, (g.texto || 0) - 40), y: 0, w: hr.width - Math.max(0, (g.texto || 0) - 40), h: hr.height };
      return {
        pai: hero, area, boca, larguraBoca: g.face, altura: g.H,
        quantidade: Math.round((movel.matches ? 36 : 84) * k), poeira: Math.round((movel.matches ? 10 : 18) * k),
        escala: Math.min(1, Math.max(0.55, g.face / 260)),
        zAtras: 1, zFrente: 4, esmaecerX: movel.matches ? null : (g.texto || 0) + 16,
        esmaecerFrenteY: movel.matches ? g.palcoTopo : null, semente: gesto ? 23 : 11
      };
    }

    function pousou(d, animado) {
      hero.dataset.mimo = 'on';
      // Teclado: o foco estava no "Abrir o presente", que some no fim; vai para o cartão em vez de cair no body.
      // Quem já levou o foco para outro lugar não é puxado de volta.
      const a = document.activeElement;
      const focou = !!d.teclado && (!a || a === document.body || a.matches('[data-abrir-presente]'));
      if (focou) giro.focus({ preventScroll: true });
      if (visivel) depois(animado ? 200 : 0, () => anunciar(focou));
    }

    function fechar(rapido) {
      if (!aberto) return;
      limpar();
      const dentro = mimo.contains(document.activeElement);
      const fim = () => { mimo.hidden = true; aberto = false; virar(false, true); delete hero.dataset.mimo; mimo.classList.remove('mimo--inclinado', 'mimo--pre'); };
      if (rapido || !ligado()) fim();
      else {
        const a = cena.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.985)' }], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
        const l = $('.mimo__luzes', mimo).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
        saida = [a, l];
        l.onfinish = () => l.cancel();
        a.onfinish = () => { saida = null; a.cancel(); l.cancel(); fim(); };
      }
      if (dentro) { const alvo = $('.hero__depois .btn', hero); if (alvo) alvo.focus({ preventScroll: true }); }
    }

    /* ---------- Virar para as condições ---------- */
    const btnVirar = $('[data-mimo-virar]', mimo), btnVoltar = $('[data-mimo-voltar]', mimo);
    function virar(paraVerso, semFoco) {
      mimo.classList.toggle('mimo--verso', paraVerso);
      btnVirar.setAttribute('aria-expanded', String(paraVerso));
      verso.inert = !paraVerso; verso.setAttribute('aria-hidden', String(!paraVerso));
      frente.inert = paraVerso; frente.setAttribute('aria-hidden', String(paraVerso));
      if (!semFoco) (paraVerso ? btnVoltar : btnVirar).focus({ preventScroll: true });
    }
    btnVirar.addEventListener('click', () => { virar(true); som('virada'); });
    btnVoltar.addEventListener('click', () => { virar(false); som('virada'); });
    $('[data-mimo-fechar]', mimo).addEventListener('click', () => { fechar(false); som('clique'); });
    mimo.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (mimo.classList.contains('mimo--verso')) virar(false); else fechar(false);
    });

    /* ---------- Copiar o código ---------- */
    const btnCopiar = $('[data-mimo-copiar]', mimo);
    btnCopiar.addEventListener('click', async () => {
      const cod = vigente.codigo;
      const ok = () => {
        toast('Código <b>' + cod + '</b> copiado');
        const rot = $('span', btnCopiar);
        rot.textContent = 'Copiado'; btnCopiar.setAttribute('aria-label', 'Código copiado');
        setTimeout(() => { rot.textContent = 'Copiar'; btnCopiar.setAttribute('aria-label', 'Copiar o código ' + cod); }, 2000);
      };
      try { await navigator.clipboard.writeText(cod); ok(); }
      catch (err) {
        const sel = getSelection(), r = document.createRange();
        r.selectNodeContents($('[data-mimo-cod]', mimo)); sel.removeAllRanges(); sel.addRange(r);
        let copiou = false;
        try { copiou = document.execCommand('copy'); } catch (e) { /* ok */ }
        if (copiou) ok(); else toast('Código <b>' + cod + '</b> selecionado: use Copiar no menu ou Ctrl+C');
      }
      som('clique');
    });

    /* ---------- Inclinação pelo ponteiro (só PC, efeitos ligados) ---------- */
    let alvo = null, rafInc = 0;
    function inclinar() {
      rafInc = 0;
      if (!alvo) { mimo.classList.remove('mimo--inclinado'); return; }
      mimo.classList.add('mimo--inclinado');
      inclina.style.setProperty('--tx', (-alvo.ny * 7).toFixed(2) + 'deg');
      inclina.style.setProperty('--ty', (alvo.nx * 9).toFixed(2) + 'deg');
      brilho.style.setProperty('--gx', (50 + alvo.nx * 80).toFixed(1) + '%');
      brilho.style.setProperty('--gy', (alvo.ny * 80).toFixed(1) + '%');
      num.style.backgroundPositionX = (50 - alvo.nx * 70).toFixed(1) + '%, 0';
    }
    cena.addEventListener('pointermove', (e) => {
      if (!ponteiroFino.matches || !ligado() || mimo.classList.contains('mimo--voando') || mimo.classList.contains('mimo--verso')) return;
      const r = cena.getBoundingClientRect();
      alvo = { nx: (e.clientX - r.left) / r.width - 0.5, ny: (e.clientY - r.top) / r.height - 0.5 };
      if (!rafInc) rafInc = requestAnimationFrame(inclinar);
    }, { passive: true });
    cena.addEventListener('pointerleave', () => { alvo = null; num.style.backgroundPositionX = ''; if (!rafInc) rafInc = requestAnimationFrame(inclinar); });

    /* ---------- Ligações com o hero ---------- */
    document.addEventListener('qb:presente', (e) => {
      const d = e.detail || {};
      if (d.fase === 'revelar') revelar(d);
      else if (d.fase === 'fechar') fechar(false);
      else if (d.fase === 'tocando') {
        if (aberto) fechar(true);
        // No primeiro ócio do vídeo, monta o cartão invisível (estilo e layout saem do quadro da revelação, ~4,7 s
        // depois) e os canvases do confete, se houver festa (gesto ou primeira vez): a rajada não aloca nada na hora
        const preparar = () => {
          if (aberto) return;
          mimo.classList.add('mimo--pre'); mimo.hidden = false; medir();
          const jaFesta = !!(ler() && ler().festa);
          if (window.QBConfete && ligado() && (d.gesto || !jaFesta)) window.QBConfete.preparar(opcoesFolhas(d.gesto));
        };
        if ('requestIdleCallback' in window) requestIdleCallback(preparar, { timeout: 1500 }); else setTimeout(preparar, 400);
        // A manuscrita precisa estar pronta quando o cartão sair (~5 s depois)
        if (document.fonts && document.fonts.load) document.fonts.load('400 32px "Great Vibes"').catch(() => {});
      }
    });
    document.addEventListener('qb:motion', (e) => {
      if (e.detail) return;
      animacoes.forEach((a) => a.finish()); // pausar efeitos no meio do voo: vai direto ao pouso
      if (window.QBConfete) window.QBConfete.liberar();
      mimo.classList.remove('mimo--voando', 'mimo--inclinado');
      if (aberto && hero.dataset.mimo !== 'on') hero.dataset.mimo = 'on';
    });
    window.QBMimo = { revelar: (d) => revelar(Object.assign({ movimento: true }, d)), fechar, medir: () => (medir(), geo) };
    const pend = C.pendente;
    C.pendente = null;
    if (pend && (pend.fase === 'revelar' || hero.dataset.estado === 'fim')) revelar(Object.assign({}, pend, { fase: 'revelar' }));
  }
})();
