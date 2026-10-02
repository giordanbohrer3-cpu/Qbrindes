/* Regras do pedido e das mensagens do WhatsApp. Sem DOM: roda no navegador e no Node (testes). */
(function (raiz) {
  'use strict';

  function formatarPreco(v) {
    if (v == null || isNaN(v)) return 'Sob consulta';
    const centavos = Math.round(v * 100);
    const inteiro = Math.floor(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'R$ ' + inteiro + ',' + String(centavos % 100).padStart(2, '0');
  }

  function saudacao(data) {
    const h = (data || new Date()).getHours();
    if (h >= 5 && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function primeiroNome(nome) {
    const n = String(nome || '').trim().split(/\s+/)[0] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  }

  function abertura(nome, data) {
    const pn = primeiroNome(nome);
    return saudacao(data) + '! ' + (pn ? 'Aqui é ' + pn + '. ' : '');
  }

  // Embalagem fechada (caixa/pacote) não tem preço confiável no catálogo: vai sob consulta.
  function precoItem(item) {
    if (item.embalagem && item.embalagem !== 'Unidade') return null;
    return item.preco == null ? null : Number(item.preco);
  }

  function chaveItem(item) {
    const p = item.personalizacao || {};
    return [item.id, item.cor || '', item.embalagem || 'Unidade', p.tecnica || '', p.texto || '', p.fonte || '', p.foto ? 'foto' : ''].join('|');
  }

  function criarPedido(itens) {
    return { itens: Array.isArray(itens) ? itens.map(normalizarItem) : [] };
  }

  function normalizarItem(item) {
    const qtd = Math.max(1, Math.min(9999, parseInt(item.qtd, 10) || 1));
    return {
      id: item.id, nome: String(item.nome || ''), preco: item.preco == null ? null : Number(item.preco),
      img: item.img || null, cor: item.cor || null, embalagem: item.embalagem || 'Unidade', qtd: qtd,
      personalizacao: item.personalizacao ? {
        tecnica: item.personalizacao.tecnica || null, texto: String(item.personalizacao.texto || '').slice(0, 60),
        fonte: item.personalizacao.fonte || null, foto: !!item.personalizacao.foto, produto3d: item.personalizacao.produto3d || null
      } : null
    };
  }

  function adicionar(pedido, item) {
    const novo = normalizarItem(item);
    const k = chaveItem(novo);
    const existente = pedido.itens.find((i) => chaveItem(i) === k);
    if (existente) existente.qtd = Math.min(9999, existente.qtd + novo.qtd);
    else pedido.itens.push(novo);
    return pedido;
  }

  function alterarQtd(pedido, indice, qtd) {
    const it = pedido.itens[indice];
    if (!it) return pedido;
    const n = parseInt(qtd, 10);
    if (!n || n < 1) pedido.itens.splice(indice, 1);
    else it.qtd = Math.min(9999, n);
    return pedido;
  }

  function remover(pedido, indice) {
    pedido.itens.splice(indice, 1);
    return pedido;
  }

  /* Cupom da primeira compra. Config em QB.cupom: { ativo, codigo, pct, validade 'AAAA-MM-DD' | null, teto R$ | null }.
     Vigente só se ativo, com código A–Z/0–9 (4 a 20), percentual inteiro de 1 a 50, dentro da validade e teto positivo. */
  function cupomVigente(cfg, hoje) {
    if (!cfg || cfg.ativo !== true) return null;
    const codigo = String(cfg.codigo || '').trim().toUpperCase();
    const pct = Number(cfg.pct);
    if (!/^[A-Z0-9]{4,20}$/.test(codigo) || !Number.isInteger(pct) || pct < 1 || pct > 50) return null;
    if (cfg.teto != null && !(Number(cfg.teto) > 0)) return null;
    if (cfg.validade) {
      const d = hoje || new Date();
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (iso > String(cfg.validade)) return null;
    }
    return { codigo, pct, validade: cfg.validade || null, teto: cfg.teto == null ? null : Number(cfg.teto) };
  }

  function totais(pedido, cupom) {
    let qtd = 0, subtotal = 0, consulta = false;
    pedido.itens.forEach((i) => {
      qtd += i.qtd;
      const p = precoItem(i);
      if (p == null) consulta = true; else subtotal += p * i.qtd;
      if (i.personalizacao) consulta = true;
    });
    subtotal = Math.round(subtotal * 100) / 100;
    let desconto = 0;
    if (cupom && cupom.pct) {
      desconto = Math.round(subtotal * cupom.pct) / 100;
      if (cupom.teto != null) desconto = Math.min(desconto, cupom.teto);
    }
    return { qtd: qtd, linhas: pedido.itens.length, subtotal: subtotal, desconto: desconto, total: Math.round((subtotal - desconto) * 100) / 100, consulta: consulta };
  }

  function dataBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  /* Texto das condições (verso do cartão e Dúvidas), gerado da config para nunca divergir */
  function textoCondicoes(cupom) {
    return 'Vale no primeiro pedido de cada cliente, feito pelo WhatsApp' + (cupom.validade ? ' até ' + dataBR(cupom.validade) : '') +
      '. O desconto de ' + cupom.pct + '% é calculado sobre o valor dos produtos, com a personalização, e não inclui frete.' +
      (cupom.teto != null ? ' Desconto máximo de ' + formatarPreco(cupom.teto) + ' por pedido.' : '') +
      ' Não se soma a outras promoções.';
  }

  function linhaCupom(cupom) {
    return 'Cupom de primeira compra: ' + cupom.codigo + ' (' + cupom.pct + '% de desconto' + (cupom.teto != null ? ', até ' + formatarPreco(cupom.teto) : '') + ').';
  }

  function descreverPersonalizacao(p, tecnicas) {
    if (!p) return '';
    const partes = [];
    if (p.tecnica) partes.push((tecnicas && tecnicas[p.tecnica] ? tecnicas[p.tecnica].nome : p.tecnica));
    if (p.texto) partes.push('texto "' + p.texto + '"');
    if (p.fonte) partes.push('fonte ' + p.fonte);
    if (p.foto) partes.push('com foto (envio aqui na conversa)');
    return partes.join(', ');
  }

  function mensagemPedido(pedido, opcoes) {
    const o = opcoes || {};
    const linhas = [abertura(o.nome, o.data) + 'Vim pelo site e quero fazer este pedido:', ''];
    pedido.itens.forEach((i, n) => {
      const det = [i.cor, i.embalagem].filter(Boolean).join(', ');
      const preco = precoItem(i);
      linhas.push((n + 1) + '. ' + i.qtd + 'x ' + i.nome + (det ? ' (' + det + ')' : '') + ' — ' + (preco == null ? 'sob consulta' : formatarPreco(preco) + '/un'));
      const pers = descreverPersonalizacao(i.personalizacao, o.tecnicas);
      if (pers) linhas.push('   Personalização: ' + pers);
    });
    const cupom = o.cupom && o.cupom.codigo ? o.cupom : null;
    const t = totais(pedido, cupom);
    linhas.push('');
    if (t.subtotal > 0) linhas.push('Estimativa dos itens com preço: ' + formatarPreco(t.subtotal) + (t.consulta ? ' (+ itens sob consulta)' : ''));
    if (cupom) {
      linhas.push(linhaCupom(cupom));
      if (t.desconto > 0) linhas.push('Estimativa com o cupom: ' + formatarPreco(t.total) + (t.consulta ? ' (+ itens sob consulta, também com desconto)' : ''));
    }
    if (t.consulta) linhas.push('Pode me passar o valor final com a personalização' + (cupom ? ' e o desconto?' : '?'));
    if (o.obs && String(o.obs).trim()) linhas.push('Observações: ' + String(o.obs).trim());
    return linhas.join('\n');
  }

  function mensagemProduto(produto, opcoes) {
    const o = opcoes || {};
    const det = [o.cor, o.embalagem && o.embalagem !== 'Unidade' ? o.embalagem : null].filter(Boolean).join(', ');
    return abertura(o.nome, o.data) + 'Vim pelo site e tenho interesse no produto ' + produto.nome + (det ? ' (' + det + ')' : '') +
      '. Qual o valor com personalização e a disponibilidade?' + (o.cupom && o.cupom.codigo ? ' ' + linhaCupom(o.cupom) : '');
  }

  function mensagemContato(opcoes) {
    const o = opcoes || {};
    return abertura(o.nome, o.data) + 'Vim pelo site e gostaria de atendimento.' + (o.cupom && o.cupom.codigo ? ' ' + linhaCupom(o.cupom) : '');
  }

  function mensagemBusca(termo, opcoes) {
    const o = opcoes || {};
    return abertura(o.nome, o.data) + 'Procurei por "' + String(termo || '').trim() + '" no site e não encontrei. Vocês trabalham com isso?' +
      (o.cupom && o.cupom.codigo ? ' ' + linhaCupom(o.cupom) : '');
  }

  function linkWhats(numero, texto) {
    return 'https://wa.me/' + String(numero).replace(/\D/g, '') + '?text=' + encodeURIComponent(texto);
  }

  const api = { formatarPreco, saudacao, primeiroNome, precoItem, chaveItem, criarPedido, normalizarItem, adicionar, alterarQtd, remover, totais,
    cupomVigente, linhaCupom, dataBR, textoCondicoes, descreverPersonalizacao, mensagemPedido, mensagemProduto, mensagemContato, mensagemBusca, linkWhats };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.QBPedido = api;
})(typeof window !== 'undefined' ? window : globalThis);
