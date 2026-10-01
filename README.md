# QBrindes & Presentes — site 3D (demonstração)

Site de página única para a QBrindes: brindes e presentes personalizados com gravação a laser, foto a laser e foto colorida. HTML, CSS e JavaScript puros, sem etapa de build.

**O que tem:**

- **Hero 3D:** um presente que se abre na rolagem. O laço desata, a tampa sobe com luz e confete, os produtos saem em órbita e o laser grava "Seu nome" no copo.
- **Vitrine 3D:** 5 produtos reais do catálogo, com animação amarrada à rolagem.
  - copo explodindo em camadas;
  - caneta na diagonal recebendo o nome a laser;
  - chaveiro virando como moeda;
  - garrafa mostrando tampa, anel e canudo;
  - taça de gin que desmonta e vira copo.
- **Estúdio de personalização:** o cliente escolhe produto, técnica, texto, fonte, cor e foto e vê a prévia 3D ao vivo, girando com o dedo. A foto vira pontilhado a laser na tábua ou estampa colorida na caneca, e não sai do aparelho.
- **Catálogo completo:** os 83 produtos do catálogo antigo, com filtros, ordenação, ficha, busca rápida (`/` ou `Ctrl+K`) e pedido pronto para o WhatsApp.
- **Movimento e som:**
  - entradas 3D por `animation-timeline: view()`, eyebrows digitados, títulos letra a letra, fitas torcidas, túnel de fotos e anel 3D no "Como funciona";
  - bokeh de luz nas seções escuras;
  - sons sintetizados bem baixos: cliques, um sopro abafado na rolagem e uma trilha de cordas.
- **Acessibilidade e reserva:** botão "Pausar efeitos" e respeito a `prefers-reduced-motion`. Sem WebGL, sem JavaScript ou com os efeitos pausados, aparecem pôsteres renderizados do próprio 3D.

## Rodar localmente

```bash
python3 -m http.server 8000   # e abra http://localhost:8000
node --test tests/*.test.js   # regras de pedido e busca
```

## Como editar

| Quero mudar… | Onde |
| --- | --- |
| WhatsApp, e-mail, cidade, endereço, horário, Instagram, prazo, mínimo | `js/data.js` → `loja` (o que estiver `null` aparece como [preencher]) |
| Produtos, preços, descrições, medidas, cores e técnicas | `js/catalogo.js` (preço `null` vira "Sob consulta") |
| Categorias (nome, texto, foto de capa) | `js/catalogo.js` → `categorias` e `js/data.js` → `capas` |
| Ocasiões (atalhos do catálogo) | `js/data.js` → `ocasioes` (lista de ids de produto) |
| Facas da linha artesanal e fotos da galeria | `js/data.js` → `artesanal` e `galeria` |
| Técnicas de personalização (nomes e textos) | `js/data.js` → `tecnicas` |
| Textos das seções, perguntas frequentes e capítulos da vitrine | `index.html` |
| Cores, fontes e espaçamentos | `css/styles.css` → `:root` e `[data-theme="dark"]` |
| Animações de página | `css/motion.css` e `js/motion.js` |
| Modelos e cenas 3D | `js/3d/` (`modelos.js`, `hero.js`, `vitrine.js`, `estudio.js`) |
| Sons | `js/som.js` |
| Fotos dos produtos | `assets/produtos/{id}-{n}-400.webp` e `-800.webp` |

Depois de publicar uma mudança, suba o `?v=N` nos `<link>` e `<script>` do `index.html` para furar o cache.

O `js/vendor/three.qb.min.js` é o three.js r186 só com as classes usadas, gerado com esbuild a partir de `tools/three-entry.js`. Se o código 3D passar a usar uma classe nova, gere de novo:

```bash
npm i three@0.186 && npx esbuild tools/three-entry.js --bundle --format=esm --minify --outfile=js/vendor/three.qb.min.js
```

## Publicação

O site fica em **https://giordanbohrer3-cpu.github.io/Qbrindes/**, publicado pelo GitHub Pages a partir do branch `gh-pages`.

O workflow `.github/workflows/pages.yml` roda os testes a cada push na `main` e, se passarem, copia a `main` para o `gh-pages`. Edite sempre na `main`, nunca direto no `gh-pages`.

Se algum dia o Pages for desligado, religue em **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**.

## Para a versão final

Falta confirmar com o cliente:

- cidade, endereço, horário, Instagram e CNPJ;
- prazo de produção e quantidade mínima;
- história da marca e logo original em vetor (o atual foi redesenhado a partir do PNG do catálogo antigo);
- quais técnicas valem para cada produto (a matriz em `catalogo.js` é uma sugestão);
- preços de caixa e pacote: no catálogo antigo estão inconsistentes (ex.: caixa com 25 copos a R$ 1.998 sai a R$ 79,92/un contra R$ 48 avulso), por isso aparecem como "sob consulta".

Ao virar versão final: tirar o `noindex` e a barra de demo, ajustar `og:url` e `og:image` para o domínio definitivo e adicionar Schema.org `LocalBusiness`.

## Créditos

- **Fotos dos produtos:** catálogo da QBrindes (qbbrindes.gopage.bio), recortadas e tratadas.
- **Fontes:** Playfair Display, Inter e Great Vibes (SIL Open Font License, em `assets/fonts/`).
- **Bibliotecas:** three.js (MIT) e Lenis (MIT), em `js/vendor/` com as licenças.
- **3D e sons:** modelos 3D desenhados no próprio código (ilustrativos) e sons sintetizados com Web Audio, sem arquivos.
