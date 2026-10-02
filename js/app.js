/* QBrindes — catálogo, filtros, busca, ficha, pedido, WhatsApp, tema, menu e painel do estúdio. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const QB = window.QB;
  const CAT = window.QB_CATALOGO;
  const P = window.QBPedido;
  const B = window.QBBusca;
  const html = document.documentElement;
  const loja = QB.loja;
  const som = (nome) => window.QBSom && window.QBSom.tocar(nome);
  const movimento = () => html.classList.contains('motion-on');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Dados derivados ---------- */
  const catPorId = {};
  CAT.categorias.forEach((c) => { catPorId[c.id] = c; });
  const produtos = CAT.produtos;
  const porId = {};
  produtos.forEach((p, i) => { p.catNome = catPorId[p.cat].nome; p.ordem = i; porId[p.id] = p; });

  // ?v=3: as fotos foram recortadas de novo com o mesmo nome de arquivo; a versão fura o cache do navegador
  const imgSrc = (chave, w) => 'assets/produtos/' + chave + '-' + (w || 400) + '.webp?v=3';
  const MODULO_RECORTE = new URL('recorte-foto.js?v=3', document.currentScript ? document.currentScript.src : location.href.replace(/[^/]*$/, 'js/')).href;
  const srcset = (chave) => imgSrc(chave, 400) + ' 400w, ' + imgSrc(chave, 800) + ' 800w';
  const precoHTML = (v) => v == null ? '<span class="preco preco--consulta">Sob consulta</span>' : P.formatarPreco(v) + '<small>/un</small>';
  const icone = (id) => '<svg aria-hidden="true"><use href="#' + id + '"/></svg>';
  const corPonto = (hexes) => hexes.length > 1 ? 'background:linear-gradient(135deg,' + hexes[0] + ' 50%,' + hexes[1] + ' 50%)' : 'background:' + hexes[0];

  function rolarAte(alvo) {
    if (window.QBMotion && window.QBMotion.rolarAte) return window.QBMotion.rolarAte(alvo);
    const el = typeof alvo === 'string' ? $(alvo) : alvo;
    if (el) el.scrollIntoView({ behavior: movimento() ? 'smooth' : 'auto', block: 'start' });
  }

  /* ---------- Contato e links do WhatsApp ---------- */
  function preencherLoja() {
    $$('[data-loja]').forEach((el) => {
      const v = loja[el.dataset.loja];
      if (v) { el.textContent = v; el.classList.remove('preencher'); }
      else el.classList.add('preencher');
    });
    if (loja.instagram) $$('[data-loja="instagram"]').forEach((el) => { el.innerHTML = '<a href="' + esc(loja.instagram) + '" target="_blank" rel="noopener">' + esc(loja.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')) + '</a>'; });
    atualizarWhatsContato();
  }
  function atualizarWhatsContato() {
    const nome = $('#ped-nome') ? $('#ped-nome').value : '';
    const url = P.linkWhats(loja.whatsapp, P.mensagemContato({ nome, cupom: cupomGanho() }));
    $$('[data-whats="contato"]').forEach((a) => { a.href = url; });
  }
  $$('[data-preco-de]').forEach((el) => {
    const p = porId[el.dataset.precoDe];
    if (p) el.innerHTML = precoHTML(p.preco);
  });

  /* ---------- Categorias ---------- */
  function renderCategorias() {
    const ul = $('#lista-categorias');
    ul.innerHTML = CAT.categorias.map((c, i) => {
      const capa = QB.capas[c.id];
      const prod = produtos.find((p) => p.imgs.includes(capa));
      const recorte = prod ? prod.recorte[prod.imgs.indexOf(capa)] : true;
      return '<li style="--i:' + i + '"><a class="cat" href="#catalogo" data-filtro-cat="' + c.id + '">' +
        '<span class="cat__foto' + (recorte ? '' : ' cat__foto--foto') + '"><img src="' + imgSrc(capa) + '" alt="" width="400" height="500" loading="lazy" decoding="async"></span>' +
        '<svg class="cat__icone" aria-hidden="true"><use href="#c-' + c.icone + '"/></svg>' +
        '<span class="cat__info"><span class="cat__nome">' + esc(c.nome) + '<span class="cat__qtd">' + c.qtd + (c.qtd === 1 ? ' item' : ' itens') + '</span></span>' +
        '<span class="cat__texto">' + esc(c.texto) + '</span></span>' +
        '<svg class="cat__seta" aria-hidden="true"><use href="#i-seta"/></svg></a></li>';
    }).join('');
    $('#rodape-cats').innerHTML = CAT.categorias.slice(0, 7).map((c) => '<a href="#catalogo" data-filtro-cat="' + c.id + '">' + esc(c.nome) + '</a>').join('');
  }

  /* ---------- Catálogo ---------- */
  const estadoCat = { cat: 'todos', ocasiao: null, ordem: 'destaque', limite: 12 };
  const PASSO = 12;

  function listaFiltrada() {
    let lista = produtos.slice();
    if (estadoCat.ocasiao) {
      const oc = QB.ocasioes.find((o) => o.id === estadoCat.ocasiao);
      lista = oc ? oc.itens.map((id) => porId[id]).filter(Boolean) : lista;
    } else if (estadoCat.cat !== 'todos') lista = lista.filter((p) => p.cat === estadoCat.cat);
    const ord = estadoCat.ordem;
    if (ord === 'menor') lista.sort((a, b) => (a.preco ?? 1e9) - (b.preco ?? 1e9));
    else if (ord === 'maior') lista.sort((a, b) => (b.preco ?? -1) - (a.preco ?? -1));
    else if (ord === 'az') lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    else if (!estadoCat.ocasiao) lista.sort((a, b) => a.ordem - b.ordem);
    return lista;
  }

  function renderChips() {
    const chips = [{ id: 'todos', nome: 'Todos', qtd: produtos.length }].concat(CAT.categorias);
    let h = chips.map((c) => '<button type="button" class="chip" data-chip="' + c.id + '" aria-pressed="' + (!estadoCat.ocasiao && estadoCat.cat === c.id) + '">' + esc(c.nome) + ' <small>' + c.qtd + '</small></button>').join('');
    if (estadoCat.ocasiao) {
      const oc = QB.ocasioes.find((o) => o.id === estadoCat.ocasiao);
      h = '<button type="button" class="chip chip--ocasiao" data-chip="todos" aria-pressed="true">' + esc(oc.nome) + ' ' + icone('i-fechar') + '<span class="sr">remover filtro</span></button>' + h;
    }
    $('#chips').innerHTML = h;
  }

  function cardHTML(p, i, novo) {
    const chave = p.imgs[0];
    // Selos de técnica ficam só na ficha; no cartão, no máximo 4 cores
    const cores = p.cores.slice(0, 4).map((c) => '<i title="' + esc(c[0]) + '" style="' + corPonto(c[1]) + '"></i>').join('') + (p.cores.length > 4 ? '<small>+' + (p.cores.length - 4) + '</small>' : '');
    return '<li class="card' + (novo ? ' novo' : '') + '" style="--i:' + i + '" data-id="' + p.id + '">' +
      '<span class="card__foto' + (p.recorte[0] ? '' : ' card__foto--foto') + '"><img src="' + imgSrc(chave) + '" srcset="' + srcset(chave) + '" sizes="(max-width: 760px) 50vw, (max-width: 1020px) 33vw, 300px" alt="' + esc(p.nome) + '" width="400" height="500" loading="lazy" decoding="async"></span>' +
      '<div class="card__info"><p class="card__cat">' + esc(p.catNome) + '</p><h3 class="card__nome"><a href="#produto-' + p.id + '" data-ficha="' + p.id + '">' + esc(p.nome) + '</a></h3>' +
      (cores ? '<div class="card__cores" aria-label="' + p.cores.length + ' cores">' + cores + '</div>' : '') + '</div>' +
      '<div class="card__rodape"><p class="preco">' + precoHTML(p.preco) + '</p><div class="card__acoes">' +
      '<a class="btn-wpp" href="' + P.linkWhats(loja.whatsapp, P.mensagemProduto(p, { cupom: cupomGanho() })) + '" target="_blank" rel="noopener" aria-label="Perguntar no WhatsApp sobre ' + esc(p.nome) + '">' + icone('i-whats') + '</a>' +
      '<button class="btn-add" type="button" data-add="' + p.id + '" aria-label="Adicionar ' + esc(p.nome) + ' ao pedido">' + icone('i-mais') + '</button></div></div></li>';
  }

  function renderGrade(acrescentar) {
    const lista = listaFiltrada();
    const grade = $('#grade');
    const vis = lista.slice(0, estadoCat.limite);
    if (acrescentar) {
      const ja = grade.children.length;
      grade.insertAdjacentHTML('beforeend', vis.slice(ja).map((p, i) => cardHTML(p, i, true)).join(''));
    } else {
      grade.innerHTML = vis.map((p, i) => cardHTML(p, i, false)).join('');
    }
    $('#ver-mais').parentElement.hidden = vis.length >= lista.length;
    const oc = estadoCat.ocasiao && QB.ocasioes.find((o) => o.id === estadoCat.ocasiao);
    const nomeFiltro = oc ? oc.nome : (estadoCat.cat === 'todos' ? '' : catPorId[estadoCat.cat].nome);
    $('#cat-info').textContent = (nomeFiltro ? nomeFiltro + ': ' : '') + lista.length + (lista.length === 1 ? ' produto' : ' produtos') + (vis.length < lista.length ? ' · mostrando ' + vis.length : '');
    document.dispatchEvent(new CustomEvent('qb:conteudo', { detail: { raiz: grade } }));
  }

  function filtrarCategoria(cat, rolar) {
    estadoCat.cat = cat || 'todos'; estadoCat.ocasiao = null; estadoCat.limite = PASSO;
    renderChips(); renderGrade();
    if (rolar) rolarAte('#catalogo');
  }
  function filtrarOcasiao(id) {
    estadoCat.ocasiao = id; estadoCat.cat = 'todos'; estadoCat.limite = PASSO;
    renderChips(); renderGrade(); rolarAte('#catalogo');
  }

  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-chip]');
    if (!b) return;
    som('alternar');
    filtrarCategoria(b.dataset.chip, false);
  });
  $('#ordem').addEventListener('change', (e) => { estadoCat.ordem = e.target.value; estadoCat.limite = PASSO; renderGrade(); som('alternar'); });
  $('#ver-mais').addEventListener('click', () => { estadoCat.limite += PASSO; renderGrade(true); });

  /* ---------- Linha artesanal, ocasiões e galeria ---------- */
  function renderFacas() {
    $('#lista-facas').innerHTML = QB.artesanal.map((id, i) => {
      const p = porId[id];
      if (!p) return '';
      const chave = p.imgs[0];
      return '<li style="--i:' + i + '"><article class="faca"><span class="faca__foto"><img src="' + imgSrc(chave, 800) + '" alt="' + esc(p.nome) + '" width="800" height="1000" loading="lazy" decoding="async"></span>' +
        '<div class="faca__info"><h3><a href="#produto-' + p.id + '" data-ficha="' + p.id + '">' + esc(p.nome) + '</a></h3><p class="preco">' + precoHTML(p.preco) + '</p></div></article></li>';
    }).join('');
  }
  function renderOcasioes() {
    $('#lista-ocasioes').innerHTML = QB.ocasioes.map((o, i) => {
      const imgs = o.itens.map((id) => porId[id]).filter((p) => p && p.recorte[0]).slice(0, 3);
      return '<li style="--i:' + i + '"><button type="button" class="ocasiao" data-oc="' + o.id + '" data-ocasiao="' + o.id + '">' +
        '<span class="ocasiao__palco" aria-hidden="true">' + imgs.map((p) => '<img src="' + imgSrc(p.imgs[0]) + '" alt="" width="400" height="500" loading="lazy" decoding="async">').join('') + '</span>' +
        '<span class="ocasiao__info"><span class="ocasiao__eyebrow">' + o.itens.length + ' produtos</span><h3>' + esc(o.nome) + '</h3><p>' + esc(o.texto) + '</p><span class="ocasiao__ver">Ver a seleção ' + icone('i-seta') + '</span></span></button></li>';
    }).join('');
  }
  function renderGaleria() {
    // Cada foto tem a sua faixa da rolagem (--ini a --fim): todas passam pela câmera antes da cena final.
    const pos = [[26, 40], [74, 58], [30, 66], [70, 34], [22, 52], [78, 46], [34, 32], [66, 70]];
    const fotos = QB.galeria.slice(0, pos.length);
    $('#galeria-tunel').innerHTML = fotos.map((chave, i) => {
      const id = Number(chave.split('-')[0]);
      const p = porId[id];
      const ini = 2 + i * 6.5, fim = ini + 28; // a última sai em 75,5%, antes da cena final (78%)
      const [x, y] = pos[i];
      return '<li style="--x:' + x + '%;--y:' + y + '%;--ini:' + ini + '%;--fim:' + fim + '%;--ry:' + (x < 50 ? 10 : -10) + 'deg">' +
        '<img src="' + imgSrc(chave, 800) + '" srcset="' + srcset(chave) + '" sizes="(max-width: 760px) 45vw, 300px" alt="' + esc(p ? p.nome : 'Produto QBrindes') + '" width="800" height="1000" loading="lazy" decoding="async"></li>';
    }).join('');
  }

  /* ---------- Pedido ---------- */
  let pedido = P.criarPedido();
  /* Cupom da primeira compra: guardado ao abrir o presente (js/mimo.js, evento 'qb:cupom') ou pela gaveta.
     Entra na estimativa do pedido e em todas as mensagens do WhatsApp. */
  const C = window.QBCupom || { config: null, vigente: () => null, guardado: () => false, guardar() {} };
  const cupomGanho = () => C.vigente();
  if (C.config) $$('[data-cupom-pct]').forEach((el) => { el.textContent = C.config.pct + '%'; });
  $('#pedido-aplicar').addEventListener('click', () => {
    C.guardar();
    $('#pedido-cupom').focus({ preventScroll: true }); // o botão some; o leitor de tela lê a linha nova
    toast('Cupom <b>' + C.config.codigo + '</b> guardado: ' + C.config.pct + '% na primeira compra');
    som('adicionar');
  });
  document.addEventListener('qb:cupom', () => {
    renderPedido(); atualizarWhatsContato(); atualizarResumo();
    $$('.card').forEach((card) => {
      const p = porId[card.dataset.id], a = $('.btn-wpp', card);
      if (p && a) a.href = P.linkWhats(loja.whatsapp, P.mensagemProduto(p, { cupom: cupomGanho() }));
    });
  });

  try {
    const salvo = JSON.parse(localStorage.getItem(QB.pedido.chave) || 'null');
    if (salvo && Array.isArray(salvo.itens)) pedido = P.criarPedido(salvo.itens.filter((i) => porId[i.id]));
    if (salvo && salvo.nome) $('#ped-nome').value = salvo.nome;
    if (salvo && salvo.obs) $('#ped-obs').value = salvo.obs;
  } catch (e) { /* armazenamento indisponível: segue sem salvar */ }

  function salvarPedido() {
    try { localStorage.setItem(QB.pedido.chave, JSON.stringify({ itens: pedido.itens, nome: $('#ped-nome').value, obs: $('#ped-obs').value })); } catch (e) { /* ok */ }
  }

  function renderPedido() {
    const cupom = cupomGanho();
    const t = P.totais(pedido, cupom);
    $$('[data-contador]').forEach((el) => { el.textContent = t.qtd; el.dataset.n = t.qtd; });
    $$('[data-contador-sr]').forEach((el) => { el.textContent = t.qtd + (t.qtd === 1 ? ' item' : ' itens') + ' no pedido'; });
    const lista = $('#pedido-lista');
    lista.innerHTML = pedido.itens.map((it, i) => {
      const p = porId[it.id];
      const det = [it.cor, it.embalagem].filter(Boolean).join(' · ');
      const pers = P.descreverPersonalizacao(it.personalizacao, QB.tecnicas);
      const preco = P.precoItem(it);
      return '<li class="item" style="--i:' + i + '"><img src="' + imgSrc(it.img || (p && p.imgs[0])) + '" alt="" width="64" height="64">' +
        '<div><p class="item__nome">' + esc(it.nome) + '</p>' + (det ? '<p class="item__det">' + esc(det) + '</p>' : '') + (pers ? '<p class="item__pers">' + esc(pers) + '</p>' : '') +
        '<button class="item__remover" type="button" data-remover="' + i + '">Remover</button></div>' +
        '<div class="item__lado"><p class="preco">' + (preco == null ? '<span class="preco preco--consulta">Sob consulta</span>' : P.formatarPreco(preco * it.qtd)) + '</p>' +
        '<div class="qtd" role="group" aria-label="Quantidade de ' + esc(it.nome) + '"><button type="button" class="icone" data-item-qtd="' + i + '" data-delta="-1" aria-label="Diminuir">' + icone('i-menos') + '</button>' +
        '<input type="number" min="0" max="9999" value="' + it.qtd + '" data-item-input="' + i + '" inputmode="numeric" aria-label="Quantidade"><button type="button" class="icone" data-item-qtd="' + i + '" data-delta="1" aria-label="Aumentar">' + icone('i-mais') + '</button></div></div></li>';
    }).join('');
    $('#pedido-vazio').hidden = pedido.itens.length > 0;
    $('#pedido-form').hidden = pedido.itens.length === 0;
    $('#pedido-cupom').hidden = !cupom;
    $('#pedido-aplicar').hidden = !C.config || !!cupom;
    $('#pedido-vazio-mimo').hidden = !cupom;
    if (cupom) {
      $('#pedido-cupom-cod').textContent = cupom.codigo + ' · ' + cupom.pct + '% na primeira compra';
      $('#pedido-cupom-valor').textContent = t.desconto > 0 ? '− ' + P.formatarPreco(t.desconto) : 'no valor final';
      $('#pedido-vazio-mimo').textContent = 'Seu desconto de ' + cupom.pct + '% já está guardado para o primeiro pedido.';
    }
    $('.pedido-total span').textContent = cupom && t.desconto > 0 ? 'Estimativa com desconto' : 'Estimativa';
    $('#pedido-total').textContent = t.subtotal > 0 ? P.formatarPreco(t.total) + (t.consulta ? ' +' : '') : (t.consulta ? 'Sob consulta' : 'R$ 0,00');
    $('#pedido-nota').hidden = !t.consulta;
    const enviar = $('#pedido-enviar');
    if (pedido.itens.length) {
      enviar.href = P.linkWhats(loja.whatsapp, P.mensagemPedido(pedido, { nome: $('#ped-nome').value, obs: $('#ped-obs').value, tecnicas: QB.tecnicas, cupom }));
      enviar.removeAttribute('aria-disabled');
    } else {
      enviar.href = '#';
      enviar.setAttribute('aria-disabled', 'true');
    }
    salvarPedido();
  }

  function voar(origem) {
    const img = origem && (origem.tagName === 'IMG' ? origem : origem.querySelector('img'));
    const destino = $$('.ilha__sacola, .dock [data-abrir-pedido]').find((el) => el.getBoundingClientRect().width > 0);
    if (!img || !destino || !movimento() || !img.getBoundingClientRect().width) return;
    const a = img.getBoundingClientRect();
    const b = destino.getBoundingClientRect();
    const v = document.createElement('img');
    v.src = img.currentSrc || img.src; v.className = 'voador'; v.alt = '';
    document.body.appendChild(v);
    const x0 = a.left + a.width / 2 - 35, y0 = a.top + a.height / 2 - 35;
    const x1 = b.left + b.width / 2 - 35, y1 = b.top + b.height / 2 - 35;
    const meio = { x: (x0 + x1) / 2, y: Math.min(y0, y1) - 120 };
    v.animate([
      { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1.2) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + meio.x + 'px,' + meio.y + 'px) scale(.9) rotate(-14deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.2) rotate(8deg)', opacity: .2 }
    ], { duration: 820, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => {
      v.remove();
      destino.classList.remove('pulou'); void destino.offsetWidth; destino.classList.add('pulou');
    };
  }

  let toastTimer = 0;
  function toast(htmlTexto, img) {
    const t = $('#toast');
    t.innerHTML = (img ? '<img src="' + img + '" alt="">' : '') + '<span>' + htmlTexto + '</span>';
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  function adicionarAoPedido(item, origem) {
    P.adicionar(pedido, item);
    renderPedido();
    som('adicionar');
    voar(origem);
    toast('<b>' + esc(item.nome) + '</b> no pedido', imgSrc(item.img));
  }

  function itemPadrao(p) {
    return { id: p.id, nome: p.nome, preco: p.preco, img: p.imgs[0], cor: p.cores[0] ? p.cores[0][0] : null, embalagem: 'Unidade', qtd: 1 };
  }

  $('#pedido-lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-item-qtd]');
    if (b) {
      const i = Number(b.dataset.itemQtd);
      P.alterarQtd(pedido, i, pedido.itens[i].qtd + Number(b.dataset.delta));
      renderPedido(); som('clique');
      return;
    }
    const r = e.target.closest('[data-remover]');
    if (r) { P.remover(pedido, Number(r.dataset.remover)); renderPedido(); som('alternar'); }
  });
  $('#pedido-lista').addEventListener('change', (e) => {
    const inp = e.target.closest('[data-item-input]');
    if (inp) { P.alterarQtd(pedido, Number(inp.dataset.itemInput), inp.value); renderPedido(); }
  });
  ['#ped-nome', '#ped-obs'].forEach((s) => $(s).addEventListener('input', () => { renderPedido(); atualizarWhatsContato(); }));

  /* ---------- Diálogos ---------- */
  function abrir(dlg) {
    if (!dlg || dlg.open) return;
    dlg.showModal();
    html.classList.add('dlg-aberto');
  }
  function fechar(dlg) {
    if (!dlg || !dlg.open) return;
    const fim = () => {
      dlg.classList.remove('fechando'); dlg.close();
      if (!$$('dialog[open]').length) html.classList.remove('dlg-aberto');
    };
    if (movimento()) { dlg.classList.add('fechando'); setTimeout(fim, 230); } else fim();
  }
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); fechar(dlg); });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-fechar]')) fechar(dlg);
      if (e.target.closest('[data-fechar-ir]')) { e.preventDefault(); fechar(dlg); setTimeout(() => rolarAte('#catalogo'), 260); }
    });
  });

  /* ---------- Ficha do produto ---------- */
  const ficha = { p: null, cor: null, emb: 'Unidade', img: 0 };
  const ESTUDIO_POR_ID = { 148236: 'copo', 148850: 'caneca', 148857: 'caneca', 145111: 'caneta', 146625: 'chaveiro', 148790: 'tabua' };

  function abrirFicha(id) {
    const p = porId[id];
    if (!p) return;
    ficha.p = p; ficha.cor = p.cores[0] ? p.cores[0][0] : null; ficha.emb = 'Unidade'; ficha.img = 0;
    $('#ficha-cat').textContent = p.catNome;
    $('#ficha-titulo').textContent = p.nome;
    $('#ficha-resumo').textContent = p.resumo || '';
    $('#ficha-medidas').innerHTML = p.medidas.map((m) => '<div><dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd></div>').join('');
    $('#ficha-tec').innerHTML = p.tecnicas.length
      ? p.tecnicas.map((t) => '<span class="tag">' + icone(t === 'laser' ? 'i-laser' : 'i-foto') + esc(QB.tecnicas[t].nome) + '</span>').join('')
      : '<span class="tag">' + icone('i-info') + 'Personalização sob consulta</span>';
    $('#ficha-texto').value = '';
    $('#ficha-qtd').value = 1;
    const est = ESTUDIO_POR_ID[p.id];
    const linkEst = $('#ficha-estudio');
    linkEst.hidden = !est;
    if (est) linkEst.dataset.estudio = est;
    renderFichaFotos(); renderFichaOpcoes(); atualizarFicha();
    abrir($('#dlg-ficha'));
  }
  function renderFichaFotos() {
    const p = ficha.p;
    const chave = p.imgs[ficha.img];
    const foto = $('#ficha-foto');
    foto.className = 'ficha__foto' + (p.recorte[ficha.img] ? '' : ' ficha__foto--foto');
    foto.innerHTML = '<img src="' + imgSrc(chave, 800) + '" alt="' + esc(p.nome) + '" width="800" height="1000">';
    $('#ficha-mini').innerHTML = p.imgs.length > 1 ? p.imgs.map((k, i) => '<button type="button" data-mini="' + i + '" aria-pressed="' + (i === ficha.img) + '" aria-label="Foto ' + (i + 1) + '"><img src="' + imgSrc(k) + '" alt=""></button>').join('') : '';
  }
  function renderFichaOpcoes() {
    const p = ficha.p;
    let h = '';
    if (p.cores.length) h += '<div><h3>Cor</h3><div class="chips">' + p.cores.map((c) => '<button type="button" class="chip" data-ficha-cor="' + esc(c[0]) + '" aria-pressed="' + (ficha.cor === c[0]) + '"><i style="' + corPonto(c[1]) + '"></i>' + esc(c[0]) + '</button>').join('') + '</div></div>';
    if (p.embalagens.length) h += '<div><h3>Embalagem</h3><div class="chips">' + ['Unidade'].concat(p.embalagens).map((e) => '<button type="button" class="chip" data-ficha-emb="' + esc(e) + '" aria-pressed="' + (ficha.emb === e) + '">' + esc(e) + (e === 'Unidade' ? '' : ' <small>sob consulta</small>') + '</button>').join('') + '</div></div>';
    $('#ficha-opcoes').innerHTML = h;
  }
  function atualizarFicha() {
    const p = ficha.p;
    $('#ficha-preco').innerHTML = ficha.emb === 'Unidade' ? precoHTML(p.preco) : '<span class="preco preco--consulta">' + esc(ficha.emb) + ': sob consulta</span>';
    $('#ficha-whats').href = P.linkWhats(loja.whatsapp, P.mensagemProduto(p, { cor: ficha.cor, embalagem: ficha.emb, nome: $('#ped-nome').value, cupom: cupomGanho() }));
  }
  $('#dlg-ficha').addEventListener('click', (e) => {
    const m = e.target.closest('[data-mini]');
    if (m) { ficha.img = Number(m.dataset.mini); renderFichaFotos(); return; }
    const c = e.target.closest('[data-ficha-cor]');
    if (c) { ficha.cor = c.dataset.fichaCor; renderFichaOpcoes(); atualizarFicha(); som('alternar'); return; }
    const em = e.target.closest('[data-ficha-emb]');
    if (em) { ficha.emb = em.dataset.fichaEmb; renderFichaOpcoes(); atualizarFicha(); som('alternar'); return; }
    const q = e.target.closest('[data-qtd]');
    if (q) { const inp = $('#ficha-qtd'); inp.value = Math.max(1, Math.min(9999, (parseInt(inp.value, 10) || 1) + Number(q.dataset.qtd))); som('clique'); return; }
    if (e.target.closest('#ficha-estudio')) { e.preventDefault(); fechar($('#dlg-ficha')); irEstudio($('#ficha-estudio').dataset.estudio); }
  });
  $('#ficha-add').addEventListener('click', () => {
    const p = ficha.p;
    const texto = $('#ficha-texto').value.trim();
    const item = Object.assign(itemPadrao(p), { cor: ficha.cor, embalagem: ficha.emb, qtd: $('#ficha-qtd').value, img: p.imgs[ficha.img] });
    if (texto) item.personalizacao = { tecnica: p.tecnicas[0] || null, texto };
    adicionarAoPedido(item, $('#ficha-foto'));
    fechar($('#dlg-ficha'));
  });

  /* ---------- Busca rápida ---------- */
  const dlgBusca = $('#dlg-busca');
  const campo = $('#busca-campo');
  let resultados = [];
  let sel = -1;

  function abrirBusca(termo) {
    abrir(dlgBusca);
    if (typeof termo === 'string') campo.value = termo;
    renderBusca();
    setTimeout(() => campo.focus(), 30);
  }
  function renderBusca() {
    const q = campo.value.trim();
    const pop = $('#busca-populares');
    const lista = $('#busca-lista');
    const vazio = $('#busca-vazio');
    if (!q) {
      pop.hidden = false;
      pop.innerHTML = '<p>Mais buscados</p>' + QB.buscaPopular.map((t, i) => '<button type="button" class="chip" style="--i:' + i + '" data-termo="' + esc(t) + '">' + esc(t) + '</button>').join('');
      resultados = B.buscar(produtos, '', 0);
      lista.innerHTML = ''; vazio.hidden = true; sel = -1;
      return;
    }
    pop.hidden = true;
    resultados = B.buscar(produtos, q, 8);
    sel = resultados.length ? 0 : -1;
    lista.innerHTML = resultados.map((r, i) => {
      const p = r.produto;
      const nome = B.destacar(p.nome, q).map((x) => x.hit ? '<mark>' + esc(x.t) + '</mark>' : esc(x.t)).join('');
      return '<li class="res" role="option" id="res-' + i + '" style="--i:' + i + '" data-res="' + i + '" aria-selected="' + (i === sel) + '"><img src="' + imgSrc(p.imgs[0]) + '" alt="" width="56" height="56"><div><p class="res__nome">' + nome + '</p><p class="res__cat">' + esc(p.catNome) + '</p></div><p class="preco">' + precoHTML(p.preco) + '</p></li>';
    }).join('');
    campo.setAttribute('aria-activedescendant', sel >= 0 ? 'res-' + sel : '');
    vazio.hidden = resultados.length > 0;
    if (!resultados.length) {
      vazio.innerHTML = '<p>Nada encontrado para <b>"' + esc(q) + '"</b>. A gente pode ter fora do catálogo.</p><a class="btn btn--whats btn--p" target="_blank" rel="noopener" href="' + P.linkWhats(loja.whatsapp, P.mensagemBusca(q, { nome: $('#ped-nome').value, cupom: cupomGanho() })) + '">' + icone('i-whats') + 'Perguntar no WhatsApp</a>';
    }
    const linha = $('.busca__linha');
    linha.classList.remove('correr'); void linha.offsetWidth; linha.classList.add('correr');
  }
  function marcar(i) {
    sel = i;
    $$('.res').forEach((el, k) => el.setAttribute('aria-selected', String(k === sel)));
    campo.setAttribute('aria-activedescendant', sel >= 0 ? 'res-' + sel : '');
    const el = $('#res-' + sel);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function escolher(i) {
    const r = resultados[i];
    if (!r) return;
    fechar(dlgBusca);
    setTimeout(() => irParaProduto(r.produto.id), 250);
  }
  function irParaProduto(id) {
    let lista = listaFiltrada();
    if (!lista.some((p) => p.id === id)) { estadoCat.cat = 'todos'; estadoCat.ocasiao = null; renderChips(); lista = listaFiltrada(); }
    const idx = lista.findIndex((p) => p.id === id);
    if (idx >= estadoCat.limite) estadoCat.limite = Math.ceil((idx + 1) / PASSO) * PASSO;
    renderGrade();
    const card = $('.card[data-id="' + id + '"]');
    if (!card) return;
    rolarAte(card);
    setTimeout(() => { card.classList.remove('piscar'); void card.offsetWidth; card.classList.add('piscar'); }, movimento() ? 750 : 50);
  }
  campo.addEventListener('input', renderBusca);
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (resultados.length) marcar((sel + 1) % resultados.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (resultados.length) marcar((sel - 1 + resultados.length) % resultados.length); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(sel >= 0 ? sel : 0); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(dlgBusca); }
  });
  dlgBusca.addEventListener('click', (e) => {
    const t = e.target.closest('[data-termo]');
    if (t) { campo.value = t.dataset.termo; renderBusca(); campo.focus(); som('alternar'); return; }
    const r = e.target.closest('[data-res]');
    if (r) escolher(Number(r.dataset.res));
  });
  document.addEventListener('keydown', (e) => {
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); abrirBusca(); }
    else if (e.key === '/' && !digitando && !$$('dialog[open]').length) { e.preventDefault(); abrirBusca(); }
    else if (e.key === 'Escape' && !demoPop.hidden) fecharDemo(true);
  });

  /* ---------- Tema ---------- */
  function definirTema(t) {
    html.setAttribute('data-theme', t);
    try { localStorage.setItem('qb-tema', t); } catch (e) { /* ok */ }
    document.dispatchEvent(new CustomEvent('qb:tema', { detail: t }));
  }
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    definirTema(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    som('alternar');
  }));

  /* ---------- Chip da demo: abre um painel pequeno com som, efeitos, tema e sobre ---------- */
  const demoBtn = $('.demo-chip__btn');
  const demoPop = $('#demo-pop');
  function fecharDemo(focar) {
    demoPop.hidden = true;
    demoBtn.setAttribute('aria-expanded', 'false');
    if (focar) demoBtn.focus();
  }
  demoBtn.addEventListener('click', () => {
    const abrirPop = demoPop.hidden;
    demoPop.hidden = !abrirPop;
    demoBtn.setAttribute('aria-expanded', String(abrirPop));
    if (abrirPop) $('button', demoPop).focus();
  });
  document.addEventListener('pointerdown', (e) => { if (!demoPop.hidden && !e.target.closest('.demo-chip')) fecharDemo(false); });
  demoPop.addEventListener('click', (e) => { if (e.target.closest('[data-abrir]')) fecharDemo(false); });

  /* ---------- Estúdio (painel; a cena 3D escuta 'qb:estudio') ---------- */
  const ESTUDIO = {
    copo: { id: 148236, nome: 'Copo térmico 500 ml', tecnicas: ['laser'], cores: [['Preto', '#17171c'], ['Vermelho', '#b3191f']] },
    caneca: { id: 148850, nome: 'Xícara de cerâmica 330 ml', tecnicas: ['foto-cor'], cores: [['Branca', '#f4f3ef', 148850], ['Mágica (preta fosca)', '#1c1c22', 148857]] },
    caneta: { id: 145111, nome: 'Caneta metal fina', tecnicas: ['laser'], cores: (porId[145111] ? porId[145111].cores.map((c) => [c[0], c[1][0]]) : [['Azul Escuro', '#1b2a6b']]) },
    chaveiro: { id: 146625, nome: 'Chaveiro coração', tecnicas: ['laser', 'foto-laser'], cores: [['Inox', '#c9ccd1']] },
    tabua: { id: 148790, nome: 'Tábua de corte com canaleta', tecnicas: ['laser', 'foto-laser'], cores: [['Bambu', '#d6a15c']] }
  };
  const FONTES = { manuscrita: 'Manuscrita', classica: 'Clássica', moderna: 'Moderna' };
  const form = $('#form-estudio');
  const estudio = { produto: 'copo', tecnica: 'laser', texto: '', texto2: '', fonte: 'manuscrita', cor: 'Preto', corHex: '#17171c', produtoId: 148236, foto: null, fotoNome: null };
  window.QBEstudio = { estado: estudio, defs: ESTUDIO };

  function avisarEstudio(motivo) {
    document.dispatchEvent(new CustomEvent('qb:estudio', { detail: { estado: estudio, motivo } }));
  }
  function aplicarProduto() {
    const def = ESTUDIO[estudio.produto];
    $$('[data-tec]', form).forEach((l) => { l.hidden = !def.tecnicas.includes(l.dataset.tec); });
    if (!def.tecnicas.includes(estudio.tecnica)) estudio.tecnica = def.tecnicas[0];
    $$('input[name="tecnica"]', form).forEach((r) => { r.checked = r.value === estudio.tecnica; });
    if (!def.cores.some((c) => c[0] === estudio.cor)) { estudio.cor = def.cores[0][0]; estudio.corHex = def.cores[0][1]; }
    const corDef = def.cores.find((c) => c[0] === estudio.cor);
    estudio.produtoId = (corDef && corDef[2]) || def.id;
    $('#est-cores').innerHTML = def.cores.map((c) => '<button type="button" class="cor" data-cor="' + esc(c[0]) + '" aria-pressed="' + (c[0] === estudio.cor) + '" aria-label="' + esc(c[0]) + '" title="' + esc(c[0]) + '"><i style="background:' + c[1] + '"></i></button>').join('');
    aplicarTecnica();
  }
  function aplicarTecnica() {
    const t = estudio.tecnica;
    form.classList.toggle('estudio--texto', t === 'laser' || t === 'foto-cor');
    form.classList.toggle('estudio--foto', t === 'foto-laser' || t === 'foto-cor');
    atualizarResumo();
  }
  function itemEstudio() {
    const p = porId[estudio.produtoId];
    const texto = [estudio.texto, estudio.texto2].map((s) => s.trim()).filter(Boolean).join(' / ');
    const usaTexto = estudio.tecnica !== 'foto-laser';
    return Object.assign(itemPadrao(p), {
      cor: estudio.cor,
      personalizacao: { tecnica: estudio.tecnica, texto: usaTexto ? texto : '', fonte: usaTexto && texto ? FONTES[estudio.fonte] : null, foto: estudio.tecnica !== 'laser' && !!estudio.foto, produto3d: estudio.produto }
    });
  }
  function atualizarResumo() {
    const p = porId[estudio.produtoId];
    $('#est-resumo').textContent = (p ? p.nome : ESTUDIO[estudio.produto].nome) + ' · ' + estudio.cor + ' · ' + QB.tecnicas[estudio.tecnica].nome;
    $('#est-preco').innerHTML = p ? precoHTML(p.preco) : '';
    const tmp = P.criarPedido();
    P.adicionar(tmp, itemEstudio());
    $('#est-whats').href = P.linkWhats(loja.whatsapp, P.mensagemPedido(tmp, { nome: $('#ped-nome').value, tecnicas: QB.tecnicas, cupom: cupomGanho() }));
  }
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'produto') { estudio.produto = t.value; aplicarProduto(); avisarEstudio('produto'); som('alternar'); }
    else if (t.name === 'tecnica') { estudio.tecnica = t.value; aplicarTecnica(); avisarEstudio('tecnica'); som('alternar'); }
    else if (t.name === 'fonte') { estudio.fonte = t.value; atualizarResumo(); avisarEstudio('texto'); som('alternar'); }
  });
  let textoTimer = 0;
  form.addEventListener('input', (e) => {
    if (e.target.id === 'est-texto' || e.target.id === 'est-texto2') {
      estudio.texto = $('#est-texto').value; estudio.texto2 = $('#est-texto2').value;
      atualizarResumo();
      clearTimeout(textoTimer);
      textoTimer = setTimeout(() => avisarEstudio('texto'), 280);
    }
  });
  $('#est-cores').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cor]');
    if (!b) return;
    const c = ESTUDIO[estudio.produto].cores.find((x) => x[0] === b.dataset.cor);
    estudio.cor = c[0]; estudio.corHex = c[1]; estudio.produtoId = c[2] || ESTUDIO[estudio.produto].id;
    $$('.cor', $('#est-cores')).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    atualizarResumo(); avisarEstudio('cor'); som('alternar');
  });
  function carregarImagem(src) {
    return new Promise((ok, falha) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = falha; im.src = src; });
  }
  /* Foto: por padrão tira o fundo no próprio aparelho (só a pessoa vai para a gravação) */
  const semFundo = $('#est-sem-fundo');
  const fotoStatus = $('#est-foto-status');
  let fotoOriginal = null, fotoRecortavel = false, fotoVez = 0;
  async function usarFoto(img, nome, recortavel) {
    const vez = ++fotoVez; // só a escolha mais recente (foto ou interruptor) aplica o resultado
    fotoOriginal = img; fotoRecortavel = recortavel; estudio.fotoNome = nome;
    estudio.foto = img; // enquanto recorta, o pedido já conta com a foto
    const recortar = recortavel && semFundo.checked;
    form.classList.toggle('foto-processando', recortar);
    atualizarResumo();
    if (!recortar) {
      fotoStatus.textContent = '';
      avisarEstudio('foto'); som('adicionar');
      return;
    }
    fotoStatus.textContent = 'Tirando o fundo da foto…';
    let aviso;
    try {
      const { recortarFundo } = await import(MODULO_RECORTE);
      const r = await recortarFundo(img);
      if (vez !== fotoVez) return; // outra foto ou o interruptor mudou no meio do caminho
      estudio.foto = r.imagem;
      aviso = r.pessoa ? 'Fundo removido.' : 'Não deu para separar alguém do fundo: usamos o centro da foto, com as bordas suaves.';
    } catch (err) {
      if (vez !== fotoVez) return;
      aviso = 'Não deu para tirar o fundo neste aparelho; usando a foto inteira.';
    }
    fotoStatus.textContent = aviso;
    form.classList.remove('foto-processando');
    avisarEstudio('foto'); som('adicionar');
  }
  $('#est-foto').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    e.target.value = ''; // permite escolher a mesma foto de novo
    let img = null;
    try { img = await carregarImagem(url); } catch (err) { toast('Não consegui abrir essa imagem. Tente outra.'); return; }
    usarFoto(img, f.name, true);
  });
  $('[data-foto-exemplo]').addEventListener('click', async () => {
    try { usarFoto(await carregarImagem('assets/exemplo-logo.png'), 'exemplo', false); } // logo já vem sem fundo
    catch (err) { /* sem exemplo */ }
  });
  semFundo.addEventListener('change', () => { if (fotoOriginal && fotoRecortavel) usarFoto(fotoOriginal, estudio.fotoNome, true); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    adicionarAoPedido(itemEstudio(), $('#palco-estudio canvas') ? null : $('#palco-estudio img'));
  });
  $('[data-regravar]').addEventListener('click', () => { avisarEstudio('regravar'); som('clique'); });

  function irEstudio(prod) {
    if (prod && ESTUDIO[prod]) {
      estudio.produto = prod;
      $$('input[name="produto"]', form).forEach((r) => { r.checked = r.value === prod; });
      aplicarProduto(); avisarEstudio('produto');
    }
    rolarAte('#estudio');
  }

  /* ---------- Cliques delegados ---------- */
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const p = porId[add.dataset.add];
      if (p) adicionarAoPedido(itemPadrao(p), add.closest('.card'));
      return;
    }
    const fic = e.target.closest('[data-ficha]');
    if (fic) { e.preventDefault(); abrirFicha(Number(fic.dataset.ficha)); return; }
    const card = e.target.closest('.card__foto');
    if (card) { abrirFicha(Number(card.closest('.card').dataset.id)); return; }
    const fc = e.target.closest('[data-filtro-cat]');
    if (fc) { e.preventDefault(); filtrarCategoria(fc.dataset.filtroCat, true); return; }
    const oc = e.target.closest('[data-ocasiao]');
    if (oc) { filtrarOcasiao(oc.dataset.ocasiao); return; }
    const est = e.target.closest('[data-estudio]');
    if (est && !est.closest('#dlg-ficha')) { e.preventDefault(); irEstudio(est.dataset.estudio); return; }
    if (e.target.closest('[data-abrir-busca]')) { abrirBusca(); return; }
    if (e.target.closest('[data-abrir-pedido]')) { renderPedido(); abrir($('#dlg-pedido')); return; }
    const ab = e.target.closest('[data-abrir]');
    if (ab) { abrir(document.getElementById(ab.dataset.abrir)); return; }
    const env = e.target.closest('#pedido-enviar');
    if (env && env.getAttribute('aria-disabled') === 'true') e.preventDefault();
    const ancora = e.target.closest('a[href^="#"]');
    if (ancora && ancora.getAttribute('href').length > 1 && !ancora.closest('dialog')) {
      const alvo = document.querySelector(ancora.getAttribute('href'));
      if (alvo) { e.preventDefault(); rolarAte(alvo); }
    }
  });

  /* ---------- Cápsula: some ao descer e volta ao subir; marcador desliza até a seção atual ---------- */
  const ilha = $('.ilha');
  const linksIlha = $$('.ilha__links a');
  const linksDock = $$('.dock a.dock__item');
  const marcador = $('.ilha__marcador');
  const caixaLinks = $('.ilha__links');
  let yAntes = window.scrollY, agendado = false, secaoAtual = null;
  function estadoIlha() {
    agendado = false;
    const y = window.scrollY;
    const descendo = y > yAntes + 4, subindo = y < yAntes - 4;
    if (y < 80 || subindo || html.classList.contains('dlg-aberto')) ilha.classList.remove('oculta');
    else if (descendo) ilha.classList.add('oculta');
    if (Math.abs(y - yAntes) > 4) yAntes = y;
  }
  window.addEventListener('scroll', () => { if (!agendado) { agendado = true; requestAnimationFrame(estadoIlha); } }, { passive: true });
  ilha.addEventListener('focusin', () => ilha.classList.remove('oculta'));

  function moverMarcador() {
    const a = linksIlha.find((l) => l.getAttribute('href') === '#' + secaoAtual);
    caixaLinks.classList.toggle('com-marcador', !!a);
    if (!a) return;
    marcador.style.setProperty('--mx', a.offsetLeft + 'px');
    marcador.style.setProperty('--mw', a.offsetWidth + 'px');
  }
  const ioNav = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) secaoAtual = en.target.id; });
    [...linksIlha, ...linksDock].forEach((l) => l.setAttribute('aria-current', String(l.getAttribute('href') === '#' + secaoAtual)));
    moverMarcador();
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['inicio', 'categorias', 'vitrine', 'estudio', 'catalogo', 'artesanal', 'ocasioes', 'como', 'galeria', 'duvidas', 'sobre', 'contato'].forEach((id) => { const s = document.getElementById(id); if (s) ioNav.observe(s); });
  window.addEventListener('resize', moverMarcador);
  if (document.fonts) document.fonts.ready.then(moverMarcador);

  /* ---------- Início ---------- */
  renderCategorias();
  renderChips();
  renderGrade();
  renderFacas();
  renderOcasioes();
  renderGaleria();
  preencherLoja();
  renderPedido();
  aplicarProduto();
  document.dispatchEvent(new CustomEvent('qb:conteudo', { detail: { raiz: document } }));

  window.QBApp = { adicionarAoPedido, abrirFicha, filtrarCategoria, irParaProduto, irEstudio, porId, imgSrc, toast };
})();
