/* QBrindes — movimento (v2): âncoras, revelações, proximidade (.s3d / .anim-off), faixa contínua,
   passo ativo do "Como funciona" e o botão de pausar efeitos. Sem rolagem simulada: a rolagem é a nativa. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const html = document.documentElement;
  const ligado = () => html.classList.contains('motion-on');
  const limitar = (v) => Math.min(1, Math.max(0, v));
  window.QBMotion = { rolarAte };

  /* Âncoras: desconta a cápsula no computador; seções fixadas começam no topo */
  function rolarAte(alvo) {
    const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    if (!el) return;
    const pc = matchMedia('(min-width: 901px)').matches;
    let y = el.id === 'inicio' ? 0 : el.getBoundingClientRect().top + window.scrollY - (pc ? 84 : 12);
    if (el.id === 'como' || el.id === 'galeria') y = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, y), behavior: ligado() ? 'smooth' : 'auto' });
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

  /* ---------- Proximidade: animações de entrada só perto da tela; contínuas pausam fora dela ---------- */
  const ioS3d = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('s3d', en.isIntersecting)), { rootMargin: '100% 0px 100% 0px' });
  const ioAnim = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('anim-off', !en.isIntersecting)), { rootMargin: '10% 0px' });
  $$('.sec, .rodape').forEach((s) => ioS3d.observe(s));
  $$('.faixa, .hero, .galeria').forEach((s) => ioAnim.observe(s));

  /* Faixa: duplica o conteúdo para o laço contínuo */
  $$('[data-faixa]').forEach((t) => {
    const copia = t.cloneNode(true);
    Array.from(copia.children).forEach((c) => c.setAttribute('aria-hidden', 'true'));
    t.append(...Array.from(copia.childNodes));
  });

  /* ---------- Como funciona: qual passo está de frente (o anel em si gira no CSS, pela rolagem) ---------- */
  const como = $('#como');
  if (como) {
    const cards = $$('.passo-card', como);
    const pontos = $$('.como__pontos li', como);
    const palco = $('.como__palco', como);
    let ativo = -2, agendado = false, visivel = false;
    const fixado = () => ligado() && getComputedStyle(palco).position === 'sticky';
    function marcar(n) {
      if (n === ativo) return;
      ativo = n;
      cards.forEach((c, i) => c.classList.toggle('ativo', n < 0 || i === n));
      pontos.forEach((p, i) => p.classList.toggle('ativo', i === n));
    }
    function atualizar() {
      agendado = false;
      if (!fixado()) return marcar(-1); // sem anel: todos os cartões inteiros
      const r = como.getBoundingClientRect();
      const p = limitar(-r.top / Math.max(1, r.height - window.innerHeight));
      marcar(p < 0.21 ? 0 : p < 0.49 ? 1 : p < 0.77 ? 2 : 3); // meio de cada giro entre as paradas do @keyframes
    }
    const agendar = () => { if (visivel && !agendado) { agendado = true; requestAnimationFrame(atualizar); } };
    new IntersectionObserver(([en]) => { visivel = en.isIntersecting; if (visivel) agendar(); }).observe(como);
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', () => { ativo = -2; agendar(); });
    document.addEventListener('qb:motion', () => { ativo = -2; visivel = true; agendar(); });
    atualizar();
  }

  /* ---------- Botão "Pausar efeitos" ---------- */
  function definirMovimento(on) {
    html.classList.toggle('motion-on', on);
    html.classList.toggle('motion-paused', !on);
    try { localStorage.setItem('qb-movimento', on ? 'on' : 'off'); } catch (e) { /* ok */ }
    $$('[data-motion-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(!on)));
    document.dispatchEvent(new CustomEvent('qb:motion', { detail: on }));
  }
  $$('[data-motion-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(!ligado()));
    b.addEventListener('click', () => { definirMovimento(!ligado()); if (window.QBSom) window.QBSom.tocar('alternar'); });
  });

  /* ---------- Início ---------- */
  prepararRevelacoes(document);
  document.addEventListener('qb:conteudo', (e) => prepararRevelacoes(e.detail && e.detail.raiz && e.detail.raiz.nodeType === 1 ? e.detail.raiz.parentElement : document));
})();
