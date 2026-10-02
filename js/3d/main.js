/* Estúdio 3D (o único 3D ao vivo do site; o presente e a vitrine são vídeos).
   Carrega só perto da seção, com a página ociosa e a rolagem parada, para nunca disputar com o scroll.
   Sem WebGL, com GPU por software ou com falha, fica o pôster (imagem). */
const html = document.documentElement;
const temWebGL = () => !!(window.WebGL2RenderingContext || window.WebGLRenderingContext);
const ocioso = (fn, t) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: t || 1500 }) : setTimeout(fn, 200));

// Espera a rolagem ficar parada por 250 ms e o navegador ocioso
function quandoCalmo(fn) {
  let t = 0;
  const pronto = () => { window.removeEventListener('scroll', mexeu); ocioso(fn); };
  const mexeu = () => { clearTimeout(t); t = setTimeout(pronto, 250); };
  window.addEventListener('scroll', mexeu, { passive: true });
  mexeu();
}

if (!temWebGL()) {
  html.classList.add('sem-3d');
} else {
  const secao = document.getElementById('estudio');
  let feito = false;
  async function iniciar() {
    if (feito) return;
    feito = true;
    try { window.QB3D = { estudio: (await import('./estudio.js?v=3')).iniciarEstudio(secao) }; }
    catch (e) { console.warn('3D indisponível no estúdio', e); }
  }
  // Baixa o three.js cedo, ocioso (só o download; nada roda até o estúdio chegar perto)
  const preparar = () => ocioso(() => {
    const l = document.createElement('link');
    l.rel = 'modulepreload'; l.href = 'js/vendor/three.qb.min.js?v=3';
    document.head.appendChild(l);
  }, 4000);
  if (document.readyState === 'complete') preparar(); else window.addEventListener('load', preparar, { once: true });
  const io = new IntersectionObserver((ents) => {
    if (!ents.some((e) => e.isIntersecting)) return;
    io.disconnect();
    quandoCalmo(iniciar);
  }, { rootMargin: '150% 0px' });
  if (secao) io.observe(secao);
}
