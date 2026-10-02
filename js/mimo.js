/* QBrindes — o mimo: cartão do desconto de primeira compra que sai do presente aberto no topo.
   Este arquivo é só o essencial, carregado com a página: o estado do cupom (window.QBCupom), usado pelo pedido.
   A cena (js/mimo-cena.js: cartão, luzes, voo 3D) e o confete (js/confete.js) chegam no primeiro ócio
   depois do load, fora do carregamento: o presente só abre 4 s ou mais depois.
   Nomes "mimo" de propósito: listas de bloqueadores escondem classes como "cupom", "coupon" e "promo".
   Config única em QB.cupom (js/data.js); regras puras em js/pedido-model.js (testadas). */
(function () {
  'use strict';

  const P = window.QBPedido;
  const CFG = (window.QB && window.QB.cupom) || null;
  const vigente = P.cupomVigente(CFG);

  /* ===================== Estado do cupom ===================== */
  let memoria = null; // sem localStorage (modo privado antigo): vale até recarregar
  function ler() {
    let s = memoria;
    try { s = JSON.parse(localStorage.getItem(CFG.chave) || 'null') || s; } catch (e) { /* ok */ }
    return s && vigente && s.codigo === vigente.codigo ? s : null; // código novo na config: volta a ser novidade
  }
  function gravar(extra) {
    const s = Object.assign(ler() || { codigo: vigente.codigo, em: new Date().toISOString().slice(0, 10) }, extra);
    memoria = s;
    try { localStorage.setItem(CFG.chave, JSON.stringify(s)); } catch (e) { /* ok */ }
    return s;
  }
  // adiar: na revelação, o resto do site (gaveta, mensagens, links dos 83 produtos) se atualiza no ócio,
  // fora do quadro em que o cartão aparece; pela gaveta é na hora (o foco vai para a linha nova)
  function guardar(adiar) {
    if (!vigente) return;
    const novo = !ler();
    gravar({});
    if (!novo) return;
    const avisar = () => document.dispatchEvent(new CustomEvent('qb:cupom', { detail: { estado: 'guardado' } }));
    if (!adiar) avisar();
    else if ('requestIdleCallback' in window) requestIdleCallback(avisar, { timeout: 2500 });
    else setTimeout(avisar, 700);
  }
  window.QBCupom = {
    config: vigente,                                   // null quando desligado ou vencido
    guardado: () => !!(vigente && ler()),
    vigente: () => (vigente && ler() ? vigente : null),
    guardar: () => guardar(false),
    _cena: { ler, gravar, guardar }, // usado por js/mimo-cena.js
    pendente: null                    // evento do presente que chegou antes da cena
  };
  if (!vigente) return;

  // A cena chega no primeiro ócio depois do load, ou na hora se o presente começar a abrir antes disso;
  // o evento que chegar antes dela fica guardado e é repetido quando ela montar
  let pedida = false;
  function carregarCena() {
    if (pedida) return;
    pedida = true;
    for (const src of ['js/confete.js?v=4', 'js/mimo-cena.js?v=4']) {
      const s = document.createElement('script');
      s.src = src; s.async = false; // mantém a ordem: o confete antes da cena
      document.head.appendChild(s);
    }
  }
  document.addEventListener('qb:presente', (e) => {
    if (window.QBMimo) return;
    window.QBCupom.pendente = e.detail;
    carregarCena();
  });
  const ocioso = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1200));
  if (document.readyState === 'complete') ocioso(carregarCena);
  else window.addEventListener('load', () => ocioso(carregarCena), { once: true });
})();
