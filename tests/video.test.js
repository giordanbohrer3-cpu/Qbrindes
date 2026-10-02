'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../js/video-model.js');

test('formato: prefere MP4, cai para WebM e depois para nenhum', () => {
  assert.equal(V.escolherFormato(() => 'probably'), 'mp4');
  assert.equal(V.escolherFormato((t) => (t.includes('webm') ? 'maybe' : '')), 'webm');
  assert.equal(V.escolherFormato(() => ''), null);
});

test('economia de dados: Save-Data e redes 2G/3G', () => {
  assert.equal(V.emEconomia({ saveData: true }), true);
  assert.equal(V.emEconomia({ effectiveType: '3g' }), true);
  assert.equal(V.emEconomia({ effectiveType: 'slow-2g' }), true);
  assert.equal(V.emEconomia({ effectiveType: '4g' }), false);
  assert.equal(V.emEconomia(undefined), false);
});

test('variante do hero muda em 900 px; vitrine usa 720 em tela pequena ou economia', () => {
  assert.equal(V.varianteHero(390), 'm');
  assert.equal(V.varianteHero(900), 'm');
  assert.equal(V.varianteHero(901), 'd');
  assert.equal(V.usar720(390, 3, false), false); // iPhone: 1170 px físicos
  assert.equal(V.usar720(360, 2, false), true);  // 720 px físicos
  assert.equal(V.usar720(1080, 1, true), true);
});

test('sequência das abas dá a volta nos dois sentidos', () => {
  assert.equal(V.proximaAba(4, 5), 0);
  assert.equal(V.proximaAba(0, 5, -1), 4);
  assert.equal(V.proximaAba(2, 5, 1), 3);
});

test('rótulo interpola entre amostras e gruda nas pontas', () => {
  const pts = [[1, 0.2, 0.4], [2, 0.4, 0.6]];
  assert.deepEqual(V.posicaoRotulo(pts, 0.5), [0.2, 0.4]);
  const m = V.posicaoRotulo(pts, 1.5);
  assert.ok(Math.abs(m[0] - 0.3) < 1e-9 && Math.abs(m[1] - 0.5) < 1e-9);
  assert.deepEqual(V.posicaoRotulo(pts, 9), [0.4, 0.6]);
  assert.equal(V.posicaoRotulo([], 1), null);
});

test('cues disparam em ordem, sem repetir, mesmo se um quadro pular vários', () => {
  const cues = [[0.35, 'laco'], [1.05, 'ouro'], [3.55, 'laser'], [4.45, 'fim']];
  const vistos = [];
  let i = V.dispararCues(cues, 0, 0.2, (c) => vistos.push(c[1]));
  assert.equal(i, 0);
  i = V.dispararCues(cues, i, 3.6, (c) => vistos.push(c[1]));
  assert.deepEqual(vistos, ['laco', 'ouro', 'laser']);
  i = V.dispararCues(cues, i, 3.7, (c) => vistos.push(c[1]));
  assert.equal(vistos.length, 3);
  assert.equal(i, 3);
});

test('auto-abertura do presente: só visível, uma vez, com efeitos ligados e aba ativa', () => {
  assert.equal(V.ESPERA_AUTO_MS, 4000);
  assert.equal(V.deveAgendarAuto({ visivel: true, jaTocou: false, movimento: true, oculto: false }), true);
  assert.equal(V.deveAgendarAuto({ visivel: true, jaTocou: true, movimento: true, oculto: false }), false);
  assert.equal(V.deveAgendarAuto({ visivel: true, jaTocou: false, movimento: false, oculto: false }), false);
  assert.equal(V.deveAgendarAuto({ visivel: false, jaTocou: false, movimento: true, oculto: false }), false);
  assert.equal(V.deveAgendarAuto({ visivel: true, jaTocou: false, movimento: true, oculto: true }), false);
});

test('cartão do desconto: 0,3 s depois do laser; sem laser, perto do fim; sem cues, nada', () => {
  assert.ok(Math.abs(V.momentoMimo({ laserFim: 4.45, fim: 5.5 }) - 4.75) < 1e-9);
  assert.equal(V.momentoMimo({ fim: 5.5 }), 4.75);
  assert.equal(V.momentoMimo({}), null);
  assert.equal(V.momentoMimo(null), null);
});
