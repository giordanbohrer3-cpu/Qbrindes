/* Busca rápida: normalização, sinônimos, pontuação e trecho destacado. Sem DOM. */
(function (raiz) {
  'use strict';

  function normalizar(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Termos que o cliente digita e como o catálogo chama.
  const SINONIMOS = {
    'chimarrao': ['cuia', 'garrafa'], 'mate': ['cuia'], 'vinho': ['vinho', 'taca', 'saca'], 'gin': ['taca'],
    'churrasco': ['churrasco', 'faca', 'tabua', 'espeto'], 'pet': ['pet'], 'cachorro': ['pet'], 'gato': ['pet'],
    'empresa': ['caneta', 'executivo', 'desk', 'mouse'], 'escritorio': ['caneta', 'desk', 'mouse'],
    'termico': ['termic'], 'termica': ['termic'], 'cafe': ['cafe', 'xicara', 'caneca'], 'cerveja': ['copo', 'caneca'],
    'agua': ['garrafa', 'squeeze'], 'casamento': ['taca', 'vinho', 'coracao'], 'pai': ['churrasco', 'faca'], 'mae': ['xicara', 'necessaire', 'manicure'],
    'foto': ['xicara', 'caneca', 'tabua'], 'som': ['som'], 'faca': ['faca', 'cutelo']
  };

  function termos(consulta) {
    return normalizar(consulta).split(' ').filter((t) => t.length > 1 || /\d/.test(t));
  }

  function texto(p) {
    return {
      nome: normalizar(p.nome),
      cat: normalizar((p.catNome || '') + ' ' + (p.sub || '')),
      resumo: normalizar(p.resumo)
    };
  }

  function pontuar(produto, consulta) {
    const ts = termos(consulta);
    if (!ts.length) return 0;
    const t = produto._busca || (produto._busca = texto(produto));
    let total = 0;
    for (const termo of ts) {
      let melhor = 0;
      const variantes = [termo].concat(SINONIMOS[termo] || []);
      for (let k = 0; k < variantes.length; k++) {
        const v = variantes[k];
        const peso = k === 0 ? 1 : 0.62 - k * 0.04; // o primeiro sinônimo pesa mais
        let s = 0;
        if (t.nome.startsWith(v)) s = 10;
        else if ((' ' + t.nome).includes(' ' + v)) s = 7;
        else if (t.nome.includes(v)) s = 4;
        else if (t.cat.includes(v)) s = 3;
        else if (t.resumo.includes(v)) s = 1;
        melhor = Math.max(melhor, s * peso);
      }
      if (melhor === 0) return 0; // todo termo precisa aparecer em algum lugar
      total += melhor;
    }
    return total;
  }

  function buscar(produtos, consulta, limite) {
    const lim = limite || 8;
    return produtos
      .map((p) => ({ produto: p, score: pontuar(p, consulta) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.produto.preco || 0) - (b.produto.preco || 0))
      .slice(0, lim);
  }

  // Divide o texto em pedaços {t, hit} sem perder acentos do original.
  function destacar(original, consulta) {
    const ts = termos(consulta);
    const base = String(original || '');
    if (!ts.length) return [{ t: base, hit: false }];
    // Mapa de índice do texto normalizado (por caractere) para o original.
    let norm = '';
    const mapa = [];
    for (let i = 0; i < base.length; i++) {
      const c = base[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      for (let k = 0; k < c.length; k++) { norm += c[k]; mapa.push(i); }
    }
    const marcas = new Array(base.length).fill(false);
    for (const t of ts) {
      let i = norm.indexOf(t);
      while (i !== -1) {
        for (let k = i; k < i + t.length; k++) marcas[mapa[k]] = true;
        i = norm.indexOf(t, i + t.length);
      }
    }
    const partes = [];
    for (let i = 0; i < base.length; i++) {
      const ult = partes[partes.length - 1];
      if (ult && ult.hit === marcas[i]) ult.t += base[i];
      else partes.push({ t: base[i], hit: marcas[i] });
    }
    return partes;
  }

  const api = { normalizar, termos, pontuar, buscar, destacar, SINONIMOS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.QBBusca = api;
})(typeof window !== 'undefined' ? window : globalThis);
