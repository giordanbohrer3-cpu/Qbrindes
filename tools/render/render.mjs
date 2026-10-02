#!/usr/bin/env node
/* Render offline de uma cena 3D para um mezanino sem perdas (FFV1, RGB 16 bits).
   Uso: node tools/render/render.mjs --cena hero --w 1920 --h 1080 [--ss 2] [--fps 60] [--ate 60] --saida /tmp/hero-d.mkv
   Requer: ffmpeg com zscale, Chromium do Playwright e tools/render/node_modules/three (npm i three@0.186.1). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, l) => (v.startsWith('--') ? a.concat([[v.slice(2), l[i + 1]]]) : a), []));
const W = Number(args.w), H = Number(args.h), SS = Number(args.ss || 2), FPS = Number(args.fps || 60);
const saida = path.resolve(args.saida);
if (!args.cena || !W || !H || !args.saida) { console.error('faltam --cena --w --h --saida'); process.exit(1); }

const { chromium } = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');

/* ffmpeg: RGBA 2x → vira (WebGL lê de baixo para cima) → reduz com Mitchell em ponto flutuante → RGB 16 bits sem perdas */
const FOTOS = args.fotos ? args.fotos.split(',').map(Number) : null;
const filtro = 'vflip'; // o quadro já chega reduzido (1x) e pontilhado pela GPU
const ff = FOTOS ? null : spawn('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-vf', filtro + ',format=gbrp',
  '-c:v', 'ffv1', '-level', '3', '-g', '1', '-slices', '4', '-slicecrc', '0', saida
], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffFim = FOTOS ? Promise.resolve() : new Promise((ok, erro) => ff.on('close', (c) => (c === 0 ? ok() : erro(new Error('ffmpeg saiu com ' + c)))));
// Modo fotos: cada quadro pedido vira um PNG (para conferir a direção de arte sem gerar o vídeo)
function salvarFoto(i, dados) {
  return new Promise((ok) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', filtro + ',format=rgb24', '-frames:v', '1', saida.replace(/\.[^.]+$/, '') + '-' + String(i).padStart(4, '0') + '.png'], { stdio: ['pipe', 'inherit', 'inherit'] });
    p.on('close', ok);
    p.stdin.end(dados);
  });
}

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const pendentes = new Map();
let proximo = Number(args.de || 0), escoando = Promise.resolve();
function escoar() {
  escoando = escoando.then(async () => {
    while (pendentes.has(proximo)) {
      const b = pendentes.get(proximo); pendentes.delete(proximo); proximo++;
      if (!ff.stdin.write(b)) await new Promise((ok) => ff.stdin.once('drain', ok));
    }
  });
  return escoando;
}
let metaOk = null;
const metaPronta = new Promise((ok) => { metaOk = ok; });
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/quadro') {
    if (FOTOS) {
      const partes = [];
      req.on('data', (b) => partes.push(b));
      req.on('end', async () => { await salvarFoto(Number(url.searchParams.get('i')), Buffer.concat(partes)); res.writeHead(204); res.end(); });
      return;
    }
    // até 2 quadros chegam ao mesmo tempo: guarda e grava sempre na ordem
    const partes = [];
    req.on('data', (b) => partes.push(b));
    req.on('end', async () => {
      pendentes.set(Number(url.searchParams.get('i')), Buffer.concat(partes));
      await escoar();
      res.writeHead(204); res.end();
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/meta') {
    const partes = [];
    req.on('data', (b) => partes.push(b));
    req.on('end', () => {
      fs.writeFileSync(saida.replace(/\.[^.]+$/, '.json'), Buffer.concat(partes));
      res.writeHead(204); res.end(); metaOk();
    });
    return;
  }
  const arq = path.join(RAIZ, decodeURIComponent(url.pathname));
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (e, dados) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(dados);
  });
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const porta = servidor.address().port;

const navegador = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--max-active-webgl-contexts=4']
});
const pagina = await navegador.newPage({ viewport: { width: 400, height: 300 } });
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[pagina]', m.text()); });
pagina.on('pageerror', (e) => { console.error('[pagina] erro:', e.message); process.exitCode = 2; });
// Se o processo da página cair (ex.: falta de memória), encerra com erro em vez de ficar esperando para sempre
pagina.on('crash', () => { console.error('[pagina] o renderizador caiu'); process.exit(3); });
const busca = new URLSearchParams({ cena: args.cena, w: W, h: H, ss: SS, fps: FPS });
for (const k of Object.keys(args)) if (!['cena', 'w', 'h', 'ss', 'fps', 'saida'].includes(k)) busca.set(k, args[k]);
await pagina.goto(`http://127.0.0.1:${porta}/tools/render/harness.html?${busca}`);
await pagina.waitForFunction(() => window.QB_RENDER && window.QB_RENDER.pronto, null, { timeout: 120000 });
const { total } = await pagina.evaluate(() => window.QB_RENDER);
console.log(`${args.cena} ${W}x${H} ss${SS} ${FPS}fps: ${total} quadros → ${saida}`);
const t0 = Date.now();
const relogio = setInterval(async () => {
  try {
    const f = await pagina.evaluate(() => window.QB_RENDER.feito);
    const s = (Date.now() - t0) / 1000;
    console.log(`  ${f}/${total}  ${(s / Math.max(1, f)).toFixed(2)} s/quadro`);
  } catch (e) { /* página ocupada */ }
}, 30000);
const r = await pagina.evaluate(() => window.renderizar());
clearInterval(relogio);
await metaPronta;
if (ff) ff.stdin.end();
await ffFim;
await navegador.close();
servidor.close();
const T = r.tempos, n = Math.max(1, T.n);
console.log(`pronto: ${T.n} quadros desenhados em ${(r.ms / 1000).toFixed(1)} s · por quadro: desenho ${(T.desenho / n / 1000).toFixed(2)} s, leitura ${(T.leitura / n / 1000).toFixed(2)} s, envio ${(T.envio / n / 1000).toFixed(2)} s`);
