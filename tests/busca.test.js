'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/busca-model.js');

global.window = {};
require('../js/catalogo.js');
const { produtos, categorias } = global.window.QB_CATALOGO;
produtos.forEach((p) => { p.catNome = categorias.find((c) => c.id === p.cat).nome; });

test('normaliza acentos e caixa', () => {
  assert.equal(B.normalizar('Xícara Mágica 350ml'), 'xicara magica 350ml');
});

test('acha o copo térmico sem acento', () => {
  const r = B.buscar(produtos, 'copo termico');
  assert.ok(r.length > 0);
  assert.match(r[0].produto.nome, /Copo/);
});

test('nome começando com o termo vem primeiro', () => {
  const r = B.buscar(produtos, 'caneta');
  assert.ok(r.every((x) => /Caneta/.test(x.produto.nome)));
});

test('sinônimo: chimarrão traz a cuia primeiro', () => {
  const r = B.buscar(produtos, 'chimarrão');
  assert.match(r[0].produto.nome, /Cuia/);
});

test('termo inexistente não retorna nada', () => {
  assert.equal(B.buscar(produtos, 'guarda-chuva').length, 0);
});

test('destaque preserva acentos do original', () => {
  const partes = B.destacar('Xícara Mágica', 'xicara');
  assert.deepEqual(partes, [{ t: 'Xícara', hit: true }, { t: ' Mágica', hit: false }]);
});

test('catálogo íntegro: 83 produtos com foto e categoria válida', () => {
  assert.equal(produtos.length, 83);
  const ids = new Set(categorias.map((c) => c.id));
  for (const p of produtos) {
    assert.ok(ids.has(p.cat), p.nome);
    assert.ok(p.imgs.length > 0, p.nome);
  }
});
