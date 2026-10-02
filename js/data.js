/* QBrindes — fonte única de dados da loja.
   Produtos e categorias ficam em js/catalogo.js (gerado do catálogo antigo, editável à mão).
   O que é null aparece no site como [preencher] até o cliente confirmar. */
(function () {
  'use strict';

  window.QB = {
    loja: {
      nome: 'QBrindes & Presentes',
      marca: 'QBrindes',
      slogan: 'E presentes personalizados',
      whatsapp: '5555999713946',
      whatsappExibir: '(55) 99971-3946',
      email: 'qbrindes1015@gmail.com',
      cidade: null,      // [preencher] cidade/UF
      endereco: null,    // [preencher]
      horario: null,     // [preencher] ex.: 'Seg a sex, 8h às 18h'
      instagram: null,   // [preencher] ex.: 'https://instagram.com/...'
      mapa: null,        // [preencher] link do Google Maps
      prazo: null,       // [preencher] prazo médio de produção
      minimo: null       // [preencher] quantidade mínima para personalizar
    },

    // Técnicas confirmadas pelo cliente. A matriz produto × técnica em catalogo.js é sugestão a confirmar.
    tecnicas: {
      'laser': { nome: 'Gravação a laser', curto: 'Laser', texto: 'Nome, frase ou logo gravados no próprio material. Não descasca e não desbota.' },
      'foto-laser': { nome: 'Foto gravada a laser', curto: 'Foto a laser', texto: 'A foto vira um pontilhado queimado na madeira ou no metal.' },
      'foto-cor': { nome: 'Foto colorida', curto: 'Foto colorida', texto: 'Foto e arte em cores na caneca e na xícara (sublimação).' }
    },

    // Capítulos da Vitrine 3D (o texto de cada capítulo está no index.html, seção #vitrine).
    vitrine: [
      { id: 148236, modelo: 'copo', cor: 'ouro' },
      { id: 145111, modelo: 'caneta', cor: 'ultra' },
      { id: 146625, modelo: 'chaveiro', cor: 'rose' },
      { id: 148336, modelo: 'garrafa', cor: 'gelo' },
      { id: 374763, modelo: 'taca', cor: 'gin' }
    ],

    // Ocasiões: atalhos para listas reais do catálogo.
    ocasioes: [
      { id: 'empresa', nome: 'Para empresas', texto: 'Canetas, garrafas e itens de mesa com o logo da marca.', itens: [145111, 147667, 148336, 148805, 148796, 148236] },
      { id: 'churrasco', nome: 'Churrasco e Dia dos Pais', texto: 'Kits de churrasco, facas e tábuas com o nome gravado.', itens: [148273, 148282, 148279, 148790, 332038, 146583] },
      { id: 'casamento', nome: 'Casamento e padrinhos', texto: 'Taças, kits de vinho e chaveiros com a data do grande dia.', itens: [374763, 148064, 148057, 148118, 146625] },
      { id: 'chimarrao', nome: 'Roda de chimarrão', texto: 'Cuia térmica e garrafa de 1,1 litro, prontas para a roda.', itens: [145165, 148829, 148336] },
      { id: 'pet', nome: 'Pet com nome', texto: 'Plaquinhas de identificação com o nome e o telefone do tutor.', itens: [146649, 146654] },
      { id: 'fimdeano', nome: 'Fim de ano', texto: 'Xícaras, copos e kits para presentear equipe e clientes.', itens: [148857, 148850, 148236, 148768, 148770, 147653] }
    ],

    buscaPopular: ['Copo térmico', 'Caneta', 'Chaveiro', 'Kit churrasco', 'Taça de gin', 'Cuia', 'Garrafa'],

    // Imagens fixas do site (fotos reais do catálogo).
    capas: {
      copos: '148236-0', garrafas: '148336-0', canecas: '148857-0', canetas: '144366-0', chaveiros: '146625-0', cuias: '145165-0',
      tacas: '374763-2', facas: '331969-0c', churrasco: '148273-0', kits: '148057-0', acessorios: '148765-0'
    },
    artesanal: [332038, 331954, 331989, 332054, 331969],
    galeria: ['145145-0', '332054-0', '374763-0', '146667-0', '331954-1', '148805-1', '331989-0', '332038-0'],

    pedido: { chave: 'qb-pedido-v1' }
  };
})();
