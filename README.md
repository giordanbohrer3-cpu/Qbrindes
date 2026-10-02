# QBrindes & Presentes — site (demonstração)

Site de página única para a QBrindes: brindes e presentes personalizados com gravação a laser, foto a laser e foto colorida. HTML, CSS e JavaScript puros, sem etapa de build no site.

**O que tem:**

- **Hero em vídeo:** um presente que se abre no clique (ou sozinho, 4 s depois de a página abrir, uma vez só). O laço desata, a tampa sobe com luz e pó de ouro, os produtos saem e o laser grava "Seu nome" no copo. O vídeo é pré-renderizado do nosso próprio 3D: toca liso em qualquer celular, sem travar o carregamento.
- **Presente de boas-vindas:** quando o presente termina de abrir, um cartão de papel marfim sai de dentro da caixa (verso azul com o Q em ouro), vira no ar e pousa na frente dela: "Você ganhou 15% de desconto na primeira compra", com o código, botão de copiar e as condições no verso. Luz indireta da caixa aberta, folhas de ouro e inclinação com o mouse no PC. O cupom fica guardado no pedido e vai sozinho na mensagem do WhatsApp.
- **Vitrine em abas:** 5 produtos reais em vídeos que tocam em sequência, com rótulos nítidos em HTML posicionados quadro a quadro e botão de pausar.
  - copo abrindo em camadas e recebendo o logo;
  - caneta recebendo o nome a laser;
  - chaveiro gravado frente e verso;
  - garrafa mostrando tampa, anel e canudo;
  - taça de gin que desmonta e vira copo.
- **Estúdio de personalização (3D ao vivo):** o cliente escolhe produto, técnica, texto, fonte, cor e foto e vê a prévia girando com o dedo. A foto tem o fundo removido no próprio aparelho (segmentação do MediaPipe), vira pontilhado a laser na tábua ou estampa colorida na caneca, e não sai do aparelho.
- **Catálogo completo:** os 83 produtos, com fotos recortadas por IA, filtros, ordenação, ficha, busca rápida (`/` ou `Ctrl+K`) e pedido pronto para o WhatsApp.
- **Navegação própria:** cápsula flutuante no computador (some ao descer, volta ao subir) e dock de app no celular, com o WhatsApp no centro.
- **Movimento:** só `transform` e `opacity`. Anel do "Como funciona" e túnel da galeria movidos pela rolagem (`animation-timeline`), com cena final e fundo contínuo. Sons sintetizados bem baixos.
- **Acessibilidade e reserva:** botão "Pausar efeitos" (no chip DEMO) e respeito a `prefers-reduced-motion`. Sem JavaScript, sem WebGL ou com os efeitos pausados, aparecem os pôsteres e tudo fica legível e parado.

## Rodar localmente

```bash
python3 -m http.server 8000   # e abra http://localhost:8000
node --test tests/*.test.js   # regras de pedido, busca e vídeos
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
| Desconto do presente (ligar, desligar, percentual, código, validade, teto) | `js/data.js` → `cupom` (veja abaixo) |
| Comportamento dos vídeos (hero e vitrine) | `js/videos.js` (regras puras em `js/video-model.js`) |
| Estúdio 3D | `js/3d/` (`estudio.js`, `modelos.js`, `gravacao.js`, `base.js`) |
| Sons | `js/som.js` |
| Fotos dos produtos | `assets/produtos/{id}-{n}-400.webp` e `-800.webp` |

Depois de publicar uma mudança, suba o `?v=N` nos `<link>` e `<script>` do `index.html` para furar o cache.

## Presente de boas-vindas (desconto da primeira compra)

Tudo sai de um objeto só, em `js/data.js`:

```js
cupom: { ativo: true, pct: 15, codigo: 'PRESENTE15', chave: 'qb-cupom-v1' }
// opcionais: validade: '2026-12-31' (último dia, inclusive), teto: 150 (desconto máximo em R$)
```

- **Desligar:** `ativo: false`. Somem o cartão, a linha da gaveta, o botão "Aplicar", a pergunta nas Dúvidas e o código das mensagens.
- **Mudar percentual ou código:** o cartão, as condições, a gaveta e as mensagens mudam juntos; o vídeo não mostra o número, então não precisa renderizar nada. Código: 4 a 20 letras ou números. Percentual: inteiro de 1 a 50.
- **Validade e teto:** aparecem sozinhos no cartão, nas condições e na mensagem.
- **Primeira compra** não dá para conferir num site estático: quem confere é a loja, no WhatsApp, pelo número ou CPF. O site diz "guardado" e "estimativa com o cupom", nunca "desconto aplicado".
- **Atenção (CDC, art. 30):** a oferta publicada obriga a loja. Confirme com o cliente o percentual, a validade, o teto e se vale para personalizados antes de publicar. Para encerrar, prefira encurtar a validade a desligar de repente, e honre os códigos que já chegaram.

Como funciona por dentro: `js/mimo.js` (cartão, luzes, voo 3D, guardar o cupom), `js/confete.js` (folhas de ouro em canvas 2D), regras puras e testadas em `js/pedido-model.js` (`cupomVigente`, `totais`, `textoCondicoes`) e `js/video-model.js` (`momentoMimo`). Os nomes "mimo" evitam que bloqueadores de anúncio escondam o cartão.

## Ferramentas (não vão para o site)

**Vídeos do hero e da vitrine** (`tools/render/`): as cenas usam os mesmos modelos de `js/3d/modelos.js`, renderizadas quadro a quadro no Chromium headless com tempo fixo, supersampling 2x e redução Mitchell na GPU, e codificadas em H.264 (MP4) e VP9 (WebM) com cor BT.709 e pontilhado contra faixas.

```bash
cd tools/render && npm i three@0.186.1 && cd ../..   # uma vez
tools/render/tudo.sh            # tudo (≈1h20 em 4 núcleos, sem GPU); ou: tudo.sh hero | tudo.sh vitrine
tools/render/posteres.sh        # pôsteres do meio de cada capítulo da vitrine
node tools/render/render.mjs --cena hero --w 960 --h 540 --fotos 0,180,329 --saida /tmp/t.mkv   # conferir quadros soltos em PNG
```

**Recortes por IA** (`tools/recortar.py`): rembg com BiRefNet, remoção de sombra de chão, furos internos e alfa parcial em peças transparentes. Os originais estão listados em `tools/originais.json`.

```bash
pip install "rembg[cpu]" onnxruntime scipy
python3 tools/recortar.py --so 148325-0     # refaz só uma imagem (ou sem --so para todas)
```

**three.js do site** (`js/vendor/three.qb.min.js`): r186 só com as classes usadas, gerado com esbuild a partir de `tools/three-entry.js`:

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
- o desconto de boas-vindas: percentual, validade, teto e se vale para personalizados (`js/data.js` → `cupom`);
- preços de caixa e pacote: no catálogo antigo estão inconsistentes (ex.: caixa com 25 copos a R$ 1.998 sai a R$ 79,92/un contra R$ 48 avulso), por isso aparecem como "sob consulta".

Ao virar versão final: tirar o `noindex` e o chip DEMO, ajustar `og:url` e `og:image` para o domínio definitivo e adicionar Schema.org `LocalBusiness`.

## Créditos

- **Fotos dos produtos:** catálogo da QBrindes (qbbrindes.gopage.bio), recortadas por IA e tratadas.
- **Fontes:** Playfair Display, Inter e Great Vibes (SIL Open Font License, em `assets/fonts/`).
- **Bibliotecas:** three.js (MIT), em `js/vendor/` com a licença; MediaPipe Tasks Vision (Apache 2.0), carregado do jsDelivr só quando alguém escolhe uma foto, com o modelo `selfie_segmenter` em `assets/modelos/`. A telemetria de uso do MediaPipe é bloqueada no próprio site.
- **3D, vídeos e sons:** modelos 3D desenhados no próprio código (ilustrativos), vídeos renderizados deles e sons sintetizados com Web Audio, sem arquivos.
