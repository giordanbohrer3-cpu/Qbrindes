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

test('cupom vigente: ativo, código e percentual válidos, dentro da validade', () => {
  const hoje = new Date(2026, 9, 2);
  assert.deepEqual(P.cupomVigente({ ativo: true, codigo: 'presente15', pct: 15 }, hoje), { codigo: 'PRESENTE15', pct: 15, validade: null, teto: null });
  assert.equal(P.cupomVigente({ ativo: false, codigo: 'PRESENTE15', pct: 15 }, hoje), null);
  assert.equal(P.cupomVigente({ ativo: true, codigo: 'P 15', pct: 15 }, hoje), null);
  assert.equal(P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 0 }, hoje), null);
  assert.equal(P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 60 }, hoje), null);
  assert.equal(P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15, teto: 0 }, hoje), null);
  assert.ok(P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15, validade: '2026-10-02' }, hoje)); // vale no último dia
  assert.equal(P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15, validade: '2026-10-01' }, hoje), null);
  assert.equal(P.cupomVigente(null), null);
});

test('cupom: desconto nos itens com preço, arredondado ao centavo e limitado ao teto', () => {
  const cupom = P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15 });
  const ped = P.criarPedido([{ id: 1, nome: 'Copo Café', preco: 57.99, qtd: 1 }, { id: 2, nome: 'Caneta', preco: 28, qtd: 2 }]);
  const t = P.totais(ped, cupom);
  assert.deepEqual([t.subtotal, t.desconto, t.total], [113.99, 17.1, 96.89]);
  assert.deepEqual([P.totais(ped).desconto, P.totais(ped).total], [0, 113.99]);
  const grande = P.criarPedido([{ id: 2, nome: 'Caneta', preco: 28, qtd: 500 }]);
  const tt = P.totais(grande, P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15, teto: 150 }));
  assert.deepEqual([tt.subtotal, tt.desconto, tt.total], [14000, 150, 13850]);
});

test('cupom na mensagem do WhatsApp (pedido, produto e contato); sem cupom nada muda', () => {
  const cupom = P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15 });
  const d = new Date(2026, 9, 1, 9);
  const ped = P.criarPedido([{ id: 1, nome: 'Copo Café', preco: 48, qtd: 2 }]);
  const msg = P.mensagemPedido(ped, { data: d, cupom });
  assert.match(msg, /Cupom de primeira compra: PRESENTE15 \(15% de desconto\)\./);
  assert.match(msg, /Estimativa com o cupom: R\$ 81,60$/m);
  assert.doesNotMatch(P.mensagemPedido(ped, { data: d }), /cupom/i);
  const pers = P.criarPedido([{ id: 1, nome: 'Copo Café', preco: 48, qtd: 1, personalizacao: { tecnica: 'laser', texto: 'Ana' } }]);
  const mp = P.mensagemPedido(pers, { data: d, cupom });
  assert.match(mp, /\(\+ itens sob consulta, também com desconto\)/);
  assert.match(mp, /valor final com a personalização e o desconto\?/);
  assert.match(P.mensagemProduto({ nome: 'Taça' }, { data: d, cupom }), /disponibilidade\? Cupom de primeira compra: PRESENTE15/);
  assert.match(P.mensagemContato({ data: d, cupom: P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15, teto: 150 }) }), /\(15% de desconto, até R\$ 150,00\)\.$/);
  assert.equal(P.mensagemContato({ data: d, cupom: null }), 'Bom dia! Vim pelo site e gostaria de atendimento.');
});

test('condições do cupom geradas da config (validade e teto opcionais)', () => {
  const base = P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15 }, new Date(2026, 9, 2));
  assert.equal(P.textoCondicoes(base), 'Vale no primeiro pedido de cada cliente, feito pelo WhatsApp. O desconto de 15% é calculado sobre o valor dos produtos, com a personalização, e não inclui frete. Não se soma a outras promoções.');
  const cheio = P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15, validade: '2026-12-31', teto: 100 }, new Date(2026, 9, 2));
  assert.match(P.textoCondicoes(cheio), /feito pelo WhatsApp até 31\/12\/2026\./);
  assert.match(P.textoCondicoes(cheio), /Desconto máximo de R\$ 100,00 por pedido\./);
  assert.equal(P.dataBR('2026-12-31'), '31/12/2026');
  assert.equal(P.dataBR('31/12'), '');
});

test('busca sem resultado também leva o cupom ao WhatsApp', () => {
  const cupom = P.cupomVigente({ ativo: true, codigo: 'PRESENTE15', pct: 15 });
  assert.match(P.mensagemBusca('abridor', { cupom }), /Vocês trabalham com isso\? Cupom de primeira compra: PRESENTE15/);
  assert.doesNotMatch(P.mensagemBusca('abridor', {}), /PRESENTE15/);
});
