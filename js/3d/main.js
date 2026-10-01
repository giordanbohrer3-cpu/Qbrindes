/* Carrega o 3D só quando faz sentido: com WebGL, perto da seção e depois da primeira pintura.
   Sem WebGL ou com falha, fica o pôster (imagem) e o layout estático. */
const html = document.documentElement;
const ligado = () => html.classList.contains('motion-on');

// Checagem barata: criar um contexto só para testar custa caro em aparelho fraco.
// Se o WebGL falhar de verdade ao criar o palco, o pôster continua no lugar.
function temWebGL() { return !!(window.WebGL2RenderingContext || window.WebGLRenderingContext); }
const quandoOcioso = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 250));
function quandoPerto(el, margem, fn) {
  if (!el) return;
  const io = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margem });
  io.observe(el);
}

if (!temWebGL()) {
  html.classList.add('sem-3d');
} else {
  const feitos = {};
  const falhou = (onde, erro) => { console.warn('3D indisponível em ' + onde, erro); };

  async function hero() {
    if (feitos.hero || !ligado()) return;
    feitos.hero = true;
    try { (window.QB3D = window.QB3D || {}).hero = (await import('./hero.js?v=2')).iniciarHero(document.getElementById('inicio')); }
    catch (e) { falhou('hero', e); }
  }
  async function vitrine() {
    if (feitos.vitrine || !ligado() || !html.classList.contains('pin-on')) return;
    feitos.vitrine = true;
    try { (window.QB3D = window.QB3D || {}).vitrine = (await import('./vitrine.js?v=2')).iniciarVitrine(document.getElementById('vitrine')); }
    catch (e) { falhou('vitrine', e); html.classList.add('sem-3d'); }
  }
  async function estudio() {
    if (feitos.estudio) return;
    feitos.estudio = true;
    try { (window.QB3D = window.QB3D || {}).estudio = (await import('./estudio.js?v=2')).iniciarEstudio(document.getElementById('estudio')); }
    catch (e) { falhou('estúdio', e); }
  }

  // O hero abre com o pôster (igual ao primeiro quadro) e o WebGL liga no primeiro gesto:
  // a página fica leve para carregar e a troca é invisível.
  function noPrimeiroGesto(fn) {
    const evs = ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown', 'scroll'];
    const op = { passive: true, capture: true };
    const vai = () => { evs.forEach((ev) => window.removeEventListener(ev, vai, op)); fn(); };
    evs.forEach((ev) => window.addEventListener(ev, vai, op));
  }
  const preparar = () => quandoOcioso(() => {
    const l = document.createElement('link');
    l.rel = 'modulepreload'; l.href = 'js/vendor/three.qb.min.js?v=2';
    document.head.appendChild(l);
    noPrimeiroGesto(hero);
  });
  if (document.readyState === 'complete') preparar(); else window.addEventListener('load', preparar, { once: true });
  quandoPerto(document.getElementById('vitrine'), '120% 0px', vitrine);
  quandoPerto(document.getElementById('estudio'), '100% 0px', estudio);
  document.addEventListener('qb:motion', (e) => {
    if (!e.detail) return;
    hero();
    const v = document.getElementById('vitrine');
    if (v && v.getBoundingClientRect().top < innerHeight * 2.2) vitrine(); else quandoPerto(v, '120% 0px', vitrine);
  });
}
