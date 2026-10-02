/* Motor do render offline: monta a cena pedida na URL e desenha quadro a quadro com tempo fixo.
   Cada quadro é desenhado em 2x (supersampling), reduzido na própria GPU com filtro Mitchell–Netravali
   em duas passadas (horizontal e vertical) com pontilhado triangular contra faixas, lido em 1x
   (RGBA, de baixo para cima) e enviado ao servidor local, que repassa ao ffmpeg em ordem. */
import * as THREE from 'three';
import { fontesProntas } from '/js/3d/gravacao.js';

const q = new URLSearchParams(location.search);
const nome = q.get('cena');
const W = Number(q.get('w')), H = Number(q.get('h'));
const SS = Number(q.get('ss') || 2);
const FPS = Number(q.get('fps') || 60);
const de = Number(q.get('de') || 0);
const formato = q.get('formato') || (W > H ? 'd' : 'm');
const fotos = q.has('fotos') ? new Set(q.get('fotos').split(',').map(Number)) : null;
if (SS !== 2) throw new Error('o redutor na GPU espera ss=2');

const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.get('aa') === '1', alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W * SS, H * SS, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

await fontesProntas();
await document.fonts.ready;
const mod = await import('./cenas/' + nome + '.js');
const cena = await mod.criar({ THREE, renderer, W, H, SS, formato, fps: FPS, q: Object.fromEntries(q) });
const total = q.has('ate') ? Math.min(Number(q.get('ate')), Math.round(cena.dur * FPS)) : Math.round(cena.dur * FPS);

/* Redução 2x → 1x na GPU. Pesos do Mitchell (B = C = 1/3) esticado 2x, amostras a ±0,5 ±1,5 ±2,5 ±3,5 px da origem. */
const PESOS = [0.39106, 0.12804, -0.01172, -0.00738];
const quadrado = new THREE.PlaneGeometry(2, 2);
const camOrto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fonte = new THREE.FramebufferTexture(W * SS, H * SS);
const meio = new THREE.WebGLRenderTarget(W, H * SS, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const saidaRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
function passada(tex, eixo, pontilhar) {
  const m = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { tSrc: { value: tex } },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tSrc;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      vec4 px(ivec2 c){ ivec2 t = textureSize(tSrc, 0); return texelFetch(tSrc, clamp(c, ivec2(0), t - 1), 0); }
      void main(){
        ivec2 o = ivec2(gl_FragCoord.xy);
        ivec2 e = ${eixo === 'x' ? 'ivec2(1, 0)' : 'ivec2(0, 1)'};
        ivec2 b = o + o * e; // pixel 2x à esquerda/abaixo do centro, no eixo reduzido
        vec4 s = vec4(0.0);
        ${[0, 1, 2, 3].map((k) => `s += ${PESOS[k].toFixed(5)} * (px(b + e * ${k + 1}) + px(b - e * ${k}));`).join('\n        ')}
        ${pontilhar ? 's.rgb += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 17.0) - 1.0) / 255.0;' : ''}
        gl_FragColor = vec4(s.rgb, 1.0);
      }`
  });
  const c = new THREE.Scene();
  const malha = new THREE.Mesh(quadrado, m);
  malha.frustumCulled = false;
  c.add(malha);
  return c;
}
const passadaX = passada(fonte, 'x', false);
const passadaY = passada(meio.texture, 'y', true);
function reduzir() {
  renderer.setRenderTarget(null);
  renderer.copyFramebufferToTexture(fonte);
  renderer.setRenderTarget(meio);
  renderer.render(passadaX, camOrto);
  renderer.setRenderTarget(saidaRT);
  renderer.render(passadaY, camOrto);
  renderer.setRenderTarget(null);
}

const metas = [];
window.QB_RENDER = { total, feito: 0, pronto: true, tempos: { desenho: 0, leitura: 0, envio: 0, n: 0 } };
window.renderizar = async () => {
  const dt = 1 / FPS;
  const t0 = performance.now();
  const fim = fotos ? Math.min(total, Math.max(...fotos) + 1) : total;
  const T = window.QB_RENDER.tempos;
  const voando = new Set(); // envios em andamento (no máximo 2; o servidor grava em ordem)
  for (let i = 0; i < fim; i++) {
    const extra = cena.quadro(i / FPS, dt, i);
    if (i < de || (fotos && !fotos.has(i))) continue;
    const a = performance.now();
    renderer.setRenderTarget(null);
    if (cena.render) cena.render(); else renderer.render(cena.scene, cena.camera);
    reduzir();
    const b = performance.now();
    const buf = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(saidaRT, 0, 0, W, H, buf);
    const c = performance.now();
    T.desenho += b - a; T.leitura += c - b; T.n++;
    while (voando.size >= 2) await Promise.race(voando);
    T.envio += performance.now() - c;
    const envio = fetch('/quadro?i=' + i, { method: 'POST', body: buf }).then((r) => {
      voando.delete(envio);
      if (!r.ok) throw new Error('quadro ' + i + ' recusado');
    });
    voando.add(envio);
    if (extra) metas.push(Object.assign({ i }, extra));
    window.QB_RENDER.feito = i + 1;
  }
  await Promise.all(voando);
  await fetch('/meta', {
    method: 'POST',
    body: JSON.stringify({ cena: nome, formato, w: W, h: H, fps: FPS, dur: cena.dur, quadros: total, cues: cena.cues || {}, extra: cena.meta ? cena.meta() : null, porQuadro: metas })
  });
  return { total, ms: performance.now() - t0, tempos: T };
};
