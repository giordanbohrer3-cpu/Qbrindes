'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pedido-model.js');

test('formata preço em reais', () => {
  assert.equal(P.formatarPreco(48), 'R$ 48,00');
  assert.equal(P.formatarPreco(57.99), 'R$ 57,99');
  assert.equal(P.formatarPreco(1998), 'R$ 1.998,00');
  assert.equal(P.formatarPreco(null), 'Sob consulta');
});

test('saudação pelo horário', () => {
  assert.equal(P.saudacao(new Date(2026, 9, 1, 8)), 'Bom dia');
  assert.equal(P.saudacao(new Date(2026, 9, 1, 13)), 'Boa tarde');
  assert.equal(P.saudacao(new Date(2026, 9, 1, 21)), 'Boa noite');
  assert.equal(P.saudacao(new Date(2026, 9, 1, 3)), 'Boa noite');
});

test('soma itens iguais e separa personalizações diferentes', () => {
  const ped = P.criarPedido();
  P.adicionar(ped, { id: 1, nome: 'Copo Café', preco: 48, cor: 'Preto', qtd: 2 });
  P.adicionar(ped, { id: 1, nome: 'Copo Café', preco: 48, cor: 'Preto', qtd: 3 });
  P.adicionar(ped, { id: 1, nome: 'Copo Café', preco: 48, cor: 'Preto', qtd: 1, personalizacao: { tecnica: 'laser', texto: 'Ana' } });
  assert.equal(ped.itens.length, 2);
  assert.equal(ped.itens[0].qtd, 5);
});

test('caixa fechada e personalização vão sob consulta', () => {
  const ped = P.criarPedido();
  P.adicionar(ped, { id: 1, nome: 'Copo Café', preco: 48, qtd: 2 });
  let t = P.totais(ped);
  assert.deepEqual([t.subtotal, t.consulta], [96, false]);
  P.adicionar(ped, { id: 2, nome: 'Caneta', preco: 28, embalagem: 'Caixa com 50 un.', qtd: 1 });
  t = P.totais(ped);
  assert.deepEqual([t.subtotal, t.consulta, t.qtd], [96, true, 3]);
});

test('alterar quantidade para zero remove o item', () => {
  const ped = P.criarPedido([{ id: 1, nome: 'A', preco: 10, qtd: 2 }]);
  P.alterarQtd(ped, 0, 0);
  assert.equal(ped.itens.length, 0);
});

test('mensagem do pedido para o WhatsApp', () => {
  const ped = P.criarPedido();
  P.adicionar(ped, { id: 1, nome: 'Copo Café', preco: 48, cor: 'Preto', qtd: 2, personalizacao: { tecnica: 'laser', texto: 'Ana', fonte: 'Manuscrita' } });
  const tecnicas = { laser: { nome: 'Gravação a laser' } };
  const msg = P.mensagemPedido(ped, { nome: 'maria souza', obs: 'Para sexta', data: new Date(2026, 9, 1, 9), tecnicas });
  assert.match(msg, /^Bom dia! Aqui é Maria\. Vim pelo site/);
  assert.match(msg, /1\. 2x Copo Café \(Preto, Unidade\) — R\$ 48,00\/un/);
  assert.match(msg, /Personalização: Gravação a laser, texto "Ana", fonte Manuscrita/);
  assert.match(msg, /Estimativa dos itens com preço: R\$ 96,00 \(\+ itens sob consulta\)/);
  assert.match(msg, /Observações: Para sexta/);
});

test('mensagens de produto, contato e busca', () => {
  const d = new Date(2026, 9, 1, 15);
  assert.equal(P.mensagemContato({ data: d }), 'Boa tarde! Vim pelo site e gostaria de atendimento.');
  assert.match(P.mensagemProduto({ nome: 'Taça de Gin' }, { data: d, cor: 'Vermelha' }), /produto Taça de Gin \(Vermelha\)\. Qual o valor/);
  assert.match(P.mensagemBusca('caneca de chopp', { data: d }), /Procurei por "caneca de chopp"/);
});

test('link do WhatsApp codificado', () => {
  const url = P.linkWhats('55 55 99971-3946', 'Olá & tchau');
  assert.equal(url, 'https://wa.me/5555999713946?text=Ol%C3%A1%20%26%20tchau');
});
