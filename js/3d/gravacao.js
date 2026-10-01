/* Gravação: texturas de texto e foto (laser e cor), pontilhado Floyd–Steinberg e o feixe do laser. */
import * as THREE from 'three';
import { texturaBrilho } from './base.js';

export const FONTES = {
  manuscrita: (px) => px + 'px "Great Vibes", "Brush Script MT", cursive',
  classica: (px) => 'italic 700 ' + px + 'px Playfair, Georgia, serif',
  moderna: (px) => '800 ' + px + 'px Inter, Arial, sans-serif'
};
const ESCALA_FONTE = { manuscrita: 1.25, classica: 1, moderna: 0.82 };

let _fontes = null;
export function fontesProntas() {
  if (_fontes) return _fontes;
  _fontes = Promise.all([
    document.fonts.load('60px "Great Vibes"'),
    document.fonts.load('italic 700 60px Playfair'),
    document.fonts.load('800 60px Inter')
  ]).catch(() => null);
  return _fontes;
}

/* Uma superfície gravável. modo 'mascara' (branco = gravado, para alphaMap) ou 'cor' (mapa colorido com transparência). */
export class Gravura {
  constructor(w, h, { vertical = false, modo = 'mascara' } = {}) {
    this.w = w; this.h = h; this.vertical = vertical; this.modo = modo;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.anisotropy = 4;
    if (modo === 'cor') this.textura.colorSpace = THREE.SRGBColorSpace;
    this.fonte = null; // conteúdo atual
    this.limpar();
  }
  limpar() {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.modo === 'mascara') { g.fillStyle = '#000'; g.fillRect(0, 0, this.w, this.h); }
    else g.clearRect(0, 0, this.w, this.h);
    this.textura.needsUpdate = true;
  }
  /* Dimensões do layout (ao longo da leitura × atravessado) */
  get L() { return this.vertical ? this.h : this.w; }
  get A() { return this.vertical ? this.w : this.h; }
  _layout(g) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.vertical) { g.translate(0, this.h); g.rotate(-Math.PI / 2); }
  }
  /* layout (lx, ly) -> uv */
  uv(lx, ly) {
    if (this.vertical) return { u: ly / this.w, v: lx / this.h };
    return { u: lx / this.w, v: 1 - ly / this.h };
  }

  /* Texto em até duas linhas, centralizado, com revelação da esquerda para a direita. Retorna a frente do laser em uv. */
  texto(linhas, fonte = 'manuscrita', progresso = 1, { cor = '#fff', margem = 0.1, tamanho = 0.42, subir = 0, escala2 = 0.55 } = {}) {
    const g = this.ctx;
    const L = this.L, A = this.A;
    const ls = linhas.map((s) => String(s || '').trim()).filter(Boolean);
    this.limpar();
    if (!ls.length) return null;
    this._layout(g);
    const larguraMax = L * (1 - margem * 2);
    const base = A * tamanho * (ESCALA_FONTE[fonte] || 1) * (ls.length > 1 ? 0.78 : 1);
    const tamanhos = ls.map((l, i) => {
      let px = i === 0 ? base : base * escala2;
      g.font = FONTES[fonte](px);
      const m = g.measureText(l).width;
      if (m > larguraMax) px *= larguraMax / m;
      return px;
    });
    const alturaTotal = tamanhos.reduce((s, px, i) => s + px * (i ? 1.05 : 1), 0);
    let y = (A - alturaTotal) / 2 - A * subir;
    let xmin = L, xmax = 0;
    const desenhos = ls.map((l, i) => {
      g.font = FONTES[fonte](tamanhos[i]);
      const w = g.measureText(l).width;
      const x = (L - w) / 2;
      xmin = Math.min(xmin, x); xmax = Math.max(xmax, x + w);
      const yy = y + tamanhos[i] * 0.82;
      y += tamanhos[i] * (i ? 1.05 : 1.1);
      return { l, x, y: yy, px: tamanhos[i] };
    });
    const corte = xmin + (xmax - xmin) * progresso;
    g.save();
    g.beginPath(); g.rect(0, 0, corte, A); g.clip();
    g.fillStyle = this.modo === 'mascara' ? '#fff' : cor;
    g.textBaseline = 'alphabetic';
    desenhos.forEach((d) => { g.font = FONTES[fonte](d.px); g.fillText(d.l, d.x, d.y); });
    g.restore();
    this.textura.needsUpdate = true;
    const linhaAtiva = desenhos.length > 1 && progresso > 0.5 ? desenhos[1] : desenhos[0];
    return this.uv(corte, linhaAtiva.y - linhaAtiva.px * 0.3);
  }

  /* Foto: 'pontilhado' (laser) varre de cima para baixo; 'cor' aparece com uma onda morna. */
  foto(fonteCanvas, progresso = 1, { texto = null, fonte = 'classica', corTexto = '#1408B8', area = 0.72 } = {}) {
    const g = this.ctx;
    this.limpar();
    if (!fonteCanvas) return null;
    this._layout(g);
    const L = this.L, A = this.A;
    const temTexto = texto && texto.some((s) => String(s || '').trim());
    const alturaFoto = A * (temTexto ? area : 0.86);
    const s = Math.min(L * 0.86 / fonteCanvas.width, alturaFoto / fonteCanvas.height);
    const dw = fonteCanvas.width * s, dh = fonteCanvas.height * s;
    const x = (L - dw) / 2, y = temTexto ? A * 0.04 : (A - dh) / 2;
    g.save();
    if (this.modo === 'mascara') {
      const ate = y + dh * progresso;
      g.beginPath(); g.rect(0, 0, L, ate); g.clip();
      g.imageSmoothingEnabled = false;
      g.drawImage(fonteCanvas, x, y, dw, dh);
    } else {
      const corte = x + dw * progresso;
      g.beginPath(); g.rect(0, 0, corte, A); g.clip();
      g.drawImage(fonteCanvas, x, y, dw, dh);
    }
    g.restore();
    if (temTexto) {
      const linhas = texto.map((t) => String(t || '').trim()).filter(Boolean);
      const px0 = A * 0.12;
      let yy = y + dh + px0 * 1.1;
      g.save();
      if (this.modo === 'cor') { const corte = L * progresso; g.beginPath(); g.rect(0, 0, corte, A); g.clip(); }
      g.fillStyle = this.modo === 'mascara' ? '#fff' : corTexto;
      linhas.forEach((l, i) => {
        let px = i ? px0 * 0.6 : px0;
        g.font = FONTES[fonte](px);
        const m = g.measureText(l).width;
        if (m > L * 0.86) { px *= L * 0.86 / m; g.font = FONTES[fonte](px); }
        g.fillText(l, (L - g.measureText(l).width) / 2, yy);
        yy += px * 1.15;
      });
      g.restore();
    }
    this.textura.needsUpdate = true;
    if (this.modo === 'mascara') {
      const linhaY = y + dh * progresso;
      return this.uv(x + dw * (0.5 + 0.48 * Math.sin(performance.now() * 0.045)), linhaY);
    }
    return this.uv(x + dw * progresso, A / 2);
  }
}

/* Pontilhado Floyd–Steinberg: branco = pixel queimado pelo laser */
export function pontilhar(img, largura = 360) {
  const proporcao = img.height / img.width;
  const w = largura, h = Math.max(1, Math.round(largura * proporcao));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.drawImage(img, 0, 0, w, h);
  const dados = g.getImageData(0, 0, w, h);
  const px = dados.data;
  const lum = new Float32Array(w * h);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
    const a = px[j + 3] / 255;
    let l = (0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]) / 255;
    l = l * a + (1 - a); // transparência vira fundo claro (não queima)
    lum[i] = Math.min(1, Math.max(0, (l - 0.5) * 1.3 + 0.52));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const velho = lum[i];
      const novo = velho < 0.5 ? 0 : 1;
      const erro = velho - novo;
      lum[i] = novo;
      if (x + 1 < w) lum[i + 1] += erro * 7 / 16;
      if (y + 1 < h) {
        if (x > 0) lum[i + w - 1] += erro * 3 / 16;
        lum[i + w] += erro * 5 / 16;
        if (x + 1 < w) lum[i + w + 1] += erro * 1 / 16;
      }
    }
  }
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
    const queimado = lum[i] < 0.5 ? 255 : 0;
    px[j] = px[j + 1] = px[j + 2] = queimado; px[j + 3] = 255;
  }
  g.putImageData(dados, 0, 0);
  return c;
}

/* Foto colorida, redimensionada para caber na estampa */
export function prepararCor(img, max = 900) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/* Feixe do laser: núcleo, halo, ponto quente, luz e faíscas */
export function criarLaser({ faiscas = 70 } = {}) {
  const grupo = new THREE.Group();
  grupo.visible = false;
  const nucleoGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6, 1, true);
  nucleoGeo.translate(0, -0.5, 0);
  const haloGeo = new THREE.CylinderGeometry(0.024, 0.012, 1, 12, 1, true);
  haloGeo.translate(0, -0.5, 0);
  const aditivo = (cor, op) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const feixe = new THREE.Group();
  feixe.add(new THREE.Mesh(nucleoGeo, aditivo(0xffd2a8, 1)), new THREE.Mesh(haloGeo, aditivo(0xff4d2e, 0.32)));
  const ponto = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrilho(), color: 0xffa060, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
  ponto.scale.set(0.22, 0.22, 1);
  const luz = new THREE.PointLight(0xff7a3d, 0, 2.5, 2);
  const pos = new Float32Array(faiscas * 3);
  const vel = new Float32Array(faiscas * 3);
  const vida = new Float32Array(faiscas);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.028, map: texturaBrilho(), color: 0xffc27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pts.frustumCulled = false;
  grupo.add(feixe, ponto, luz, pts);

  const _dir = new THREE.Vector3();
  const _baixo = new THREE.Vector3(0, -1, 0);
  const origem = new THREE.Vector3();
  const alvo = new THREE.Vector3();
  const normal = new THREE.Vector3(0, 0, 1);
  let ativo = false, emitir = 0, proxima = 0;
  for (let i = 0; i < faiscas; i++) vida[i] = 0;

  return {
    grupo,
    apontar(de, para, n) {
      origem.copy(de); alvo.copy(para); if (n) normal.copy(n);
      feixe.position.copy(origem);
      _dir.subVectors(alvo, origem);
      const comp = _dir.length();
      feixe.quaternion.setFromUnitVectors(_baixo, _dir.normalize());
      feixe.scale.set(1, comp, 1);
      ponto.position.copy(alvo);
      luz.position.copy(alvo).addScaledVector(normal, 0.08);
    },
    ligar(on) {
      ativo = on;
      if (on) grupo.visible = true;
    },
    /* Retorna true enquanto houver algo para desenhar */
    atualizar(dt) {
      const s = dt / 1000;
      if (ativo) {
        const pulso = 0.85 + Math.random() * 0.3;
        ponto.scale.setScalar(0.2 * pulso);
        luz.intensity = 2.2 * pulso;
        feixe.visible = true; ponto.visible = true;
        emitir += s * 260;
      } else {
        luz.intensity *= 0.8; feixe.visible = false; ponto.visible = false;
      }
      let vivos = 0;
      while (emitir >= 1) {
        emitir -= 1;
        const i = proxima; proxima = (proxima + 1) % faiscas;
        pos[i * 3] = alvo.x; pos[i * 3 + 1] = alvo.y; pos[i * 3 + 2] = alvo.z;
        const ang = Math.random() * Math.PI * 2, f = 0.4 + Math.random() * 1.2;
        vel[i * 3] = normal.x * f + Math.cos(ang) * 0.6;
        vel[i * 3 + 1] = 0.5 + Math.random() * 1.1;
        vel[i * 3 + 2] = normal.z * f + Math.sin(ang) * 0.6;
        vida[i] = 0.25 + Math.random() * 0.35;
      }
      for (let i = 0; i < faiscas; i++) {
        if (vida[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
        vivos++;
        vida[i] -= s;
        vel[i * 3 + 1] -= 4.2 * s;
        pos[i * 3] += vel[i * 3] * s; pos[i * 3 + 1] += vel[i * 3 + 1] * s; pos[i * 3 + 2] += vel[i * 3 + 2] * s;
      }
      geo.attributes.position.needsUpdate = true;
      if (!ativo && !vivos && luz.intensity < 0.02) { grupo.visible = false; return false; }
      return true;
    }
  };
}
