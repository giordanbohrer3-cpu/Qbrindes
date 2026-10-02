/* QBrindes — regras dos vídeos sem DOM (testadas em tests/video.test.js).
   Formato, variante, sequência das abas, posição dos rótulos e disparo de cues. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.QBVideoModel = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* MP4 (H.264, decodificado pelo hardware em quase todo aparelho) primeiro; WebM VP9 de reserva */
  function escolherFormato(podeTocar) {
    if (podeTocar('video/mp4; codecs="avc1.640028"')) return 'mp4';
    if (podeTocar('video/webm; codecs="vp9"')) return 'webm';
    return null;
  }

  /* Economia de dados: Save-Data ligado ou rede 2G/3G */
  function emEconomia(rede) {
    if (!rede) return false;
    return !!rede.saveData || /(^|-)(2g|3g)$/.test(rede.effectiveType || '');
  }

  /* Hero: 'm' (4:5) até 900 px de largura, 'd' (16:9) acima */
  function varianteHero(larguraJanela) { return larguraJanela <= 900 ? 'm' : 'd'; }

  /* Vitrine: 720 px quando a tela física é pequena ou em economia de dados; 1080 no resto */
  function usar720(menorLadoTela, dpr, economia) { return !!economia || menorLadoTela * (dpr || 1) < 760; }

  /* Abas: próxima na sequência automática e navegação por teclado (com volta) */
  function proximaAba(i, total, delta) { return ((i + (delta == null ? 1 : delta)) % total + total) % total; }

  /* Rótulo: interpola a posição entre amostras [t, x, y] ordenadas por t; fora do intervalo, gruda na ponta */
  function posicaoRotulo(pts, t) {
    if (!pts || !pts.length) return null;
    if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (b[0] >= t) {
        const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      }
    }
    const u = pts[pts.length - 1];
    return [u[1], u[2]];
  }

  /* Cues: dispara, em ordem, todos os que ficaram para trás até o tempo t; devolve o próximo índice */
  function dispararCues(cues, desde, t, fn) {
    let i = desde;
    while (i < cues.length && t >= cues[i][0]) { fn(cues[i], i); i++; }
    return i;
  }

  /* Hero: o cartão do desconto sai da caixa quando a cena assenta, 0,3 s depois do laser;
     sem laser no JSON, 0,75 s antes do fim; sem nada, null (aí o cartão entra no 'ended') */
  function momentoMimo(cues) {
    if (!cues) return null;
    if (typeof cues.laserFim === 'number') return cues.laserFim + 0.3;
    if (typeof cues.fim === 'number') return Math.max(0, cues.fim - 0.75);
    return null;
  }

  /* Hero: toca sozinho após 4 s com o topo visível, uma vez só, e nunca com os efeitos pausados */
  function deveAgendarAuto({ visivel, jaTocou, movimento, oculto }) { return !!visivel && !jaTocou && !!movimento && !oculto; }

  return { escolherFormato, emEconomia, varianteHero, usar720, proximaAba, posicaoRotulo, dispararCues, momentoMimo, deveAgendarAuto, ESPERA_AUTO_MS: 4000 };
});
