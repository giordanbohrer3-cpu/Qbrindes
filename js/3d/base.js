/* Base dos palcos 3D: renderer sob demanda, ambiente de estúdio, luzes, sombra e utilitários. */
import * as THREE from 'three';

export const toque = matchMedia('(hover: none), (pointer: coarse)').matches;
// Nitidez: resolução real da tela até 2x, nunca abaixo de 1 (o 3D pixelado do celular vinha daqui)
export const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
export const ligado = () => document.documentElement.classList.contains('motion-on');
export const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const trecho = (p, a, b) => limitar((p - a) / (b - a));
export const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const saida = (t) => 1 - Math.pow(1 - t, 3);
export const elastico = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
export const lerp = (a, b, t) => a + (b - a) * t;

/* Textura de brilho radial (pontos de luz, faíscas, faixa do laser) */
let _brilho = null;
export function texturaBrilho() {
  if (_brilho) return _brilho;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _brilho = new THREE.CanvasTexture(c);
  _brilho.colorSpace = THREE.SRGBColorSpace;
  return _brilho;
}

/* Sombra de contato barata: um disco com degradê, sem shadow map */
export function sombra(raio = 1, opacidade = 0.55) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,.5)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(raio * 2, raio * 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: opacidade, depthWrite: false, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -2;
  return m;
}

/* Luz indireta no chão: halo aditivo colorido embaixo do objeto */
export function brilhoChao(raio = 1.4, cor = 0xffb21e, opacidade = 0.35) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(raio * 2, raio * 2),
    new THREE.MeshBasicMaterial({ map: texturaBrilho(), color: cor, transparent: true, opacity: opacidade, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = -1;
  return m;
}

export function luzes(cena, { quente = 0xffb21e, frio = 0x5a48ff } = {}) {
  const hemi = new THREE.HemisphereLight(0xd8d4ff, 0x170e48, 0.7);
  const chave = new THREE.DirectionalLight(0xfff1df, 2.4);
  chave.position.set(-3.2, 5.5, 4.5);
  const preench = new THREE.DirectionalLight(0xb9b2ff, 0.6);
  preench.position.set(4, 1.5, 3);
  const contraA = new THREE.PointLight(frio, 26, 18, 2);
  contraA.position.set(3.4, 2.6, -2.6);
  const contraB = new THREE.PointLight(quente, 18, 18, 2);
  contraB.position.set(-3.4, 1.2, -2.2);
  cena.add(hemi, chave, preench, contraA, contraB);
  return { hemi, chave, preench, contraA, contraB };
}

/* Palco: canvas + renderer + câmera, renderiza só quando visível e quando algo mudou */
export function criarPalco(host, opcoes = {}) {
  const { fov = 30, exposicao = 1.05, ambiente = 0.85 } = opcoes;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opcoes.preservar });
  // GPU por software (sem aceleração): o 3D ao vivo travaria; quem chama decide ficar no pôster
  let softwareGPU = false;
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const nome = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    softwareGPU = /swiftshader|llvmpipe|software|basic render/i.test(nome);
  } catch (e) { /* sem informação: segue */ }
  if (softwareGPU && opcoes.recusarSoftware) { renderer.dispose(); canvas.remove(); return { softwareGPU, destruir() {} }; }
  renderer.setPixelRatio(DPR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposicao;
  renderer.setClearColor(0x000000, 0);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sala = new THREE.RoomEnvironment();
  cena.environment = pmrem.fromScene(sala, 0.035).texture;
  cena.environmentIntensity = ambiente;
  sala.dispose && sala.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 60);
  const palco = {
    renderer, cena, camera, canvas, host, softwareGPU,
    w: 1, h: 1, visivel: false, sujo: true, destruido: false,
    centro: { x: 0.5, y: 0.5 },
    tick: null, aoRedimensionar: null,
    marcar() { this.sujo = true; this.acordar(); },
    acordar, destruir
  };

  function aplicarCentro() {
    const { w, h } = palco;
    camera.setViewOffset(w, h, (0.5 - palco.centro.x) * w, (0.5 - palco.centro.y) * h, w, h);
    camera.updateProjectionMatrix();
  }
  palco.centralizar = (x, y) => { palco.centro.x = x; palco.centro.y = y; aplicarCentro(); palco.marcar(); };

  function dimensionar() {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (w === palco.w && h === palco.h) return;
    palco.w = w; palco.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (palco.aoRedimensionar) palco.aoRedimensionar(w, h);
    aplicarCentro();
    palco.marcar();
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(dimensionar));
  ro.observe(host);

  let raf = 0, ultimo = 0, somaQuadros = 0, nQuadros = 0, dprAtual = DPR;
  palco.dpr = () => dprAtual;
  function quadro(t) {
    raf = 0;
    if (palco.destruido || !palco.visivel || document.hidden) return;
    const dt = Math.min(64, ultimo ? t - ultimo : 16);
    ultimo = t;
    const mudou = palco.tick ? palco.tick(dt, t) : false;
    if (mudou || palco.sujo) {
      renderer.render(cena, camera);
      palco.sujo = false;
      // GPU lenta: desce uma vez só, de 2x para 1,5x (nunca fica borrado)
      if (mudou && !window.QB_QUALIDADE_FIXA && dprAtual > 1.5) {
        somaQuadros += dt; nQuadros++;
        if (nQuadros >= 30) {
          if (somaQuadros / nQuadros > 40) {
            dprAtual = 1.5;
            renderer.setPixelRatio(dprAtual);
            renderer.setSize(palco.w, palco.h, false);
          }
          somaQuadros = 0; nQuadros = 0;
        }
      }
    }
    raf = requestAnimationFrame(quadro);
  }
  function acordar() {
    if (!raf && palco.visivel && !document.hidden && !palco.destruido) { ultimo = 0; raf = requestAnimationFrame(quadro); }
  }
  const io = new IntersectionObserver(([en]) => { palco.visivel = en.isIntersecting; if (palco.visivel) { dimensionar(); acordar(); } }, { rootMargin: '5% 0px' });
  io.observe(host);
  document.addEventListener('visibilitychange', acordar);

  function destruir() {
    palco.destruido = true;
    io.disconnect(); ro.disconnect();
    renderer.dispose();
    canvas.remove();
  }

  dimensionar();
  return palco;
}

/* Converte um ponto do mundo para pixels dentro do host */
const _v = new THREE.Vector3();
export function paraTela(palco, ponto) {
  _v.copy(ponto).project(palco.camera);
  return { x: (_v.x * 0.5 + 0.5) * palco.w, y: (-_v.y * 0.5 + 0.5) * palco.h, z: _v.z };
}
