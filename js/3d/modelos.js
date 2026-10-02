/* Modelos procedurais (1 unidade = 10 cm). Nada de .glb: tudo é torno, extrusão e caixas arredondadas.
   Cada modelo tem a base em y = 0 e expõe em userData as partes, a gravura e alvo(u, v) para o laser. */
import * as THREE from 'three';
import { Gravura } from './gravacao.js';

const V2 = (r, y) => new THREE.Vector2(r, y);
const torno = (pts, segs = 72, phi0 = 0, phiLen = Math.PI * 2) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), segs, phi0, phiLen);
// Perfil suave: interpola os pontos com spline antes de tornear (curvas orgânicas, sem facetas)
const tornoSuave = (pts, n = 48, segs = 96) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([r, y]) => V2(r, y))).getPoints(n), segs);
const lerp = (a, b, t) => a + (b - a) * t;

export const M = {
  pintura: (cor, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color: cor, metalness: 0.25, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.32 }, extra)),
  inox: (extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xdfe2e7, metalness: 1, roughness: 0.27 }, extra)),
  cromo: () => new THREE.MeshPhysicalMaterial({ color: 0xf5f6f9, metalness: 1, roughness: 0.07 }),
  plastico: (cor, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color: cor, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4 }, extra)),
  borracha: () => new THREE.MeshStandardMaterial({ color: 0x18181d, roughness: 0.92 }),
  ceramica: (cor) => new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })
};

/* Material da marca gravada: 'aco' (laser tira a pintura e mostra o inox), 'escuro' (laser no inox),
   'madeira' (queimado) e 'cor' (estampa colorida). */
export function matGravura(tipo, gravura) {
  const comum = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide };
  if (tipo === 'cor') return revelavel(new THREE.MeshPhysicalMaterial(Object.assign({ map: gravura.textura, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }, comum)), gravura);
  const base = {
    aco: { color: 0xe7e9ee, metalness: 1, roughness: 0.32 },
    escuro: { color: 0x2a2c33, metalness: 0.45, roughness: 0.55 },
    madeira: { color: 0x3b2110, metalness: 0, roughness: 1 }
  }[tipo];
  return revelavel(new THREE.MeshPhysicalMaterial(Object.assign({ alphaMap: gravura.textura, emissive: 0xff6a2a, emissiveMap: gravura.textura, emissiveIntensity: 0 }, base, comum)), gravura);
}
/* A gravura aparece até o corte (uCorte), sem redesenhar a textura: o laser só move um uniform. */
function revelavel(mat, gravura) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCorte = gravura.corte;
    sh.fragmentShader = 'uniform vec3 uCorte;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      #ifdef USE_ALPHAMAP
        vec2 uvCorte = vAlphaMapUv;
      #else
        vec2 uvCorte = vMapUv;
      #endif
      float eixoCorte = uCorte.y < 0.5 ? uvCorte.x : (uCorte.y < 1.5 ? uvCorte.y : 1.0 - uvCorte.y);
      diffuseColor.a *= 1.0 - smoothstep(uCorte.x - 0.0015, uCorte.x + 0.0015, eixoCorte);`);
  };
  mat.customProgramCacheKey = () => 'gravura-corte';
  return mat;
}

const _p = new THREE.Vector3();

/* ================= Copo térmico 500 ml (Copo Café) ================= */
export function criarCopo({ cor = 0x17171c, tipoGravura = 'aco' } = {}) {
  const g = new THREE.Group();
  g.name = 'copo';
  const rFora = (y) => lerp(0.372, 0.44, (y - 0.07) / (1.385 - 0.07));
  const matCorpo = M.pintura(cor, { side: THREE.DoubleSide });
  const corpo = new THREE.Group();
  corpo.add(new THREE.Mesh(torno([[0.352, 0.05], [0.372, 0.07], [0.44, 1.385], [0.446, 1.4]]), matCorpo));
  const interna = new THREE.Mesh(torno([[0, 0.13], [0.32, 0.13], [0.345, 0.16], [0.412, 1.37], [0.42, 1.405], [0.446, 1.412]]), M.inox({ side: THREE.DoubleSide }));
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.443, 0.011, 10, 72), M.inox());
  aro.rotation.x = Math.PI / 2; aro.position.y = 1.405;
  const tampa = new THREE.Group();
  const matTampa = M.plastico(0x101013);
  tampa.add(new THREE.Mesh(torno([[0, 1.705], [0.3, 1.705], [0.4, 1.68], [0.448, 1.645], [0.46, 1.6], [0.46, 1.45], [0.452, 1.425], [0, 1.425]]), matTampa));
  const bocal = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.2, 0.026, 0.09, 2, 0.01), M.plastico(0x040405));
  bocal.position.set(0, 1.712, 0.255);
  const trava = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.11, 0.032, 0.06, 2, 0.012), M.plastico(0x2b2b31));
  trava.position.set(0, 1.716, 0.11);
  tampa.add(bocal, trava);
  const borracha = new THREE.Mesh(torno([[0, 0], [0.345, 0], [0.362, 0.012], [0.37, 0.066], [0, 0.066]]), M.borracha());

  // Faixa gravável na frente do corpo
  const phiLen = Math.PI * 0.62, phi0 = -phiLen / 2, y0 = 0.4, y1 = 1.14;
  const perfil = [];
  for (let i = 0; i <= 10; i++) { const y = y0 + (y1 - y0) * i / 10; perfil.push([rFora(y) + 0.0035, y]); }
  const gravura = new Gravura(1024, 940);
  const matG = matGravura(tipoGravura, gravura);
  const faixa = new THREE.Mesh(torno(perfil, 64, phi0, phiLen), matG);
  faixa.renderOrder = 2;
  corpo.add(faixa);
  g.add(corpo, interna, aro, tampa, borracha);

  g.userData = {
    altura: 1.72, partes: { corpo, interna, aro, tampa, borracha, faixa }, gravura, matGravura: matG, matCorpo,
    definirCor(hex) { matCorpo.color.set(hex); },
    alvo(u, v, pos, normal) {
      const phi = phi0 + u * phiLen, y = y0 + v * (y1 - y0), r = rFora(y) + 0.0035;
      pos.set(Math.sin(phi) * r, y, Math.cos(phi) * r);
      corpo.localToWorld(pos);
      if (normal) normal.set(Math.sin(phi), 0, Math.cos(phi)).transformDirection(corpo.matrixWorld);
    }
  };
  return g;
}

/* ================= Xícara / caneca de cerâmica ================= */
export function criarCaneca({ cor = 0xf4f3ef } = {}) {
  const g = new THREE.Group();
  g.name = 'caneca';
  const matCorpo = M.ceramica(cor);
  const corpo = new THREE.Mesh(torno([[0, 0], [0.37, 0], [0.395, 0.015], [0.405, 0.05], [0.405, 0.93], [0.4, 0.955], [0.386, 0.958], [0.372, 0.94], [0.372, 0.09], [0, 0.09]]), matCorpo);
  const alca = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.047, 16, 40, Math.PI * 1.12), matCorpo);
  alca.rotation.z = -Math.PI * 0.56; alca.scale.y = 1.2; alca.position.set(0.415, 0.5, 0);
  const phiLen = Math.PI * 0.86, phi0 = -phiLen / 2, y0 = 0.12, y1 = 0.86, r = 0.4085;
  const gravura = new Gravura(1024, 660, { modo: 'cor' });
  const matG = matGravura('cor', gravura);
  const faixa = new THREE.Mesh(torno([[r, y0], [r, y1]], 64, phi0, phiLen), matG);
  faixa.renderOrder = 2;
  g.add(corpo, alca, faixa);
  g.userData = {
    altura: 0.96, partes: { corpo, alca, faixa }, gravura, matGravura: matG, matCorpo,
    definirCor(hex) {
      matCorpo.color.set(hex);
      const escura = new THREE.Color(hex).getHSL({}).l < 0.3;
      matCorpo.roughness = escura ? 0.62 : 0.2; matCorpo.clearcoat = escura ? 0.1 : 1;
    },
    alvo(u, v, pos, normal) {
      const phi = phi0 + u * phiLen, y = y0 + v * (y1 - y0);
      pos.set(Math.sin(phi) * r, y, Math.cos(phi) * r); g.localToWorld(pos);
      if (normal) normal.set(Math.sin(phi), 0, Math.cos(phi)).transformDirection(g.matrixWorld);
    }
  };
  return g;
}

/* ================= Caneta metal fina (eixo Y, ponta em y = 0) ================= */
export function criarCaneta({ cor = 0x1b2a6b } = {}) {
  const g = new THREE.Group();
  g.name = 'caneta';
  const r = 0.05;
  const matCorpo = new THREE.MeshPhysicalMaterial({ color: cor, metalness: 0.55, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12 });
  const cromo = M.cromo();
  const ponta = new THREE.Mesh(torno([[0, 0], [0.006, 0.01], [0.028, 0.1], [0.047, 0.166]], 40), cromo);
  const refil = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.6, roughness: 0.3 }));
  refil.position.y = 0.03;
  const inferior = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.97, 0.55, 48), matCorpo);
  inferior.position.y = 0.44;
  const anel = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.03, 48), cromo);
  anel.position.y = 0.73;
  const superior = new THREE.Group();
  const sup = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.99, r, 0.5, 48), matCorpo);
  sup.position.y = 0.995;
  const topo = new THREE.Mesh(torno([[r * 0.99, 1.244], [r * 0.92, 1.285], [r * 0.55, 1.308], [0, 1.312]], 40), cromo);
  const clipe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.012), cromo);
  clipe.position.set(0, 1.06, r + 0.017);
  const clipeBola = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), cromo);
  clipeBola.position.set(0, 0.865, r + 0.02);
  const clipeBase = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), cromo);
  clipeBase.position.set(0, 1.245, r + 0.008);
  superior.add(sup, topo, clipe, clipeBola, clipeBase);
  // Faixa gravável no corpo inferior: texto ao longo do comprimento, virado para +z
  const tLen = Math.PI * 0.9, comp = 0.46, yc = 0.44;
  const gravura = new Gravura(256, 820, { vertical: true });
  const matG = matGravura('aco', gravura);
  const faixa = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0016, r * 0.97 + 0.0016, comp, 48, 1, true, -tLen / 2, tLen), matG);
  faixa.position.y = yc; faixa.renderOrder = 2;
  g.add(ponta, refil, inferior, anel, superior, faixa);
  g.userData = {
    altura: 1.312, partes: { ponta, refil, inferior, anel, superior, faixa }, gravura, matGravura: matG, matCorpo,
    definirCor(hex) { matCorpo.color.set(hex); },
    alvo(u, v, pos, normal) {
      const t = -tLen / 2 + u * tLen, y = yc - comp / 2 + v * comp, rr = r * (0.97 + 0.03 * v) + 0.0016;
      pos.set(Math.sin(t) * rr, y, Math.cos(t) * rr); g.localToWorld(pos);
      if (normal) normal.set(Math.sin(t), 0, Math.cos(t)).transformDirection(g.matrixWorld);
    }
  };
  return g;
}

/* ================= Chaveiro coração ================= */
function pontosCoracao(e, n = 80) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(V2(x * e, (y + 2.5) * e));
  }
  return pts;
}
function uvQuadrado(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox, s = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
  const cx = (bb.max.x + bb.min.x) / 2, cy = (bb.max.y + bb.min.y) / 2;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - cx) / s + 0.5, (pos.getY(i) - cy) / s + 0.5);
  uv.needsUpdate = true;
  return { s, cx, cy };
}
export function criarChaveiro({ tipoGravura = 'escuro' } = {}) {
  const g = new THREE.Group();
  g.name = 'chaveiro';
  const e = 0.0194;
  const fora = new THREE.Shape(pontosCoracao(e));
  fora.holes.push(new THREE.Path(pontosCoracao(e * 0.8)));
  const moldura = new THREE.ExtrudeGeometry(fora, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 3, curveSegments: 1 });
  moldura.translate(0, 0, -0.025);
  const placaGeo = new THREE.ExtrudeGeometry(new THREE.Shape(pontosCoracao(e * 0.81)), { depth: 0.024, bevelEnabled: false, curveSegments: 1 });
  placaGeo.translate(0, 0, -0.012);
  const coracao = new THREE.Group();
  coracao.add(new THREE.Mesh(moldura, M.cromo()), new THREE.Mesh(placaGeo, M.inox({ roughness: 0.34 })));
  // Gravação frente e verso
  const frente = new Gravura(512, 512), verso = new Gravura(512, 512);
  const geoG = new THREE.ShapeGeometry(new THREE.Shape(pontosCoracao(e * 0.74)), 1);
  const map = uvQuadrado(geoG);
  const matF = matGravura(tipoGravura, frente), matV = matGravura(tipoGravura, verso);
  const gF = new THREE.Mesh(geoG, matF); gF.position.z = 0.0135;
  const gV = new THREE.Mesh(geoG, matV); gV.position.z = -0.0135; gV.rotation.y = Math.PI;
  coracao.add(gF, gV);
  coracao.position.y = -0.33;
  // Argolas: o pivô do grupo fica no alto, para o balanço de pêndulo
  const elo = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 10, 28), M.cromo());
  elo.position.y = -0.06;
  const argola = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.013, 12, 64), M.cromo());
  argola.rotation.y = Math.PI / 2; argola.position.y = 0.14;
  g.add(coracao, elo, argola);
  g.userData = {
    altura: 0.62, partes: { coracao, elo, argola, frente: gF, verso: gV }, gravura: frente, gravuraVerso: verso, matGravura: matF, matVerso: matV,
    alvo(u, v, pos, normal, lado = 1) {
      const x = (u - 0.5) * map.s + map.cx, y = (v - 0.5) * map.s + map.cy;
      const malha = lado > 0 ? gF : gV;
      pos.set(x, y, 0); malha.localToWorld(pos);
      if (normal) normal.set(0, 0, 1).transformDirection(malha.matrixWorld);
    }
  };
  return g;
}

/* ================= Garrafa térmica 900 ml ================= */
export function criarGarrafa({ cor = 0x16161b } = {}) {
  const g = new THREE.Group();
  g.name = 'garrafa';
  const matCorpo = M.pintura(cor, { roughness: 0.55, clearcoat: 0.25 });
  const corpo = new THREE.Mesh(torno([[0, 0.03], [0.39, 0.03], [0.43, 0.05], [0.445, 0.12], [0.445, 1.96], [0.435, 2.03], [0.4, 2.08], [0.372, 2.1], [0.372, 2.135]]), matCorpo);
  const fundo = new THREE.Mesh(torno([[0, 0], [0.4, 0], [0.432, 0.035], [0, 0.035]]), M.inox());
  const rosca = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 48), M.inox());
  rosca.position.y = 2.17;
  const matAnel = new THREE.MeshStandardMaterial({ color: 0x8796ab, roughness: 0.7, emissive: 0x38e1ff, emissiveIntensity: 0 });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.366, 0.015, 12, 64), matAnel);
  anel.rotation.x = Math.PI / 2; anel.position.y = 2.14;
  const tampa = new THREE.Group();
  tampa.position.y = 2.135;
  const matTampa = M.plastico(0x111115);
  tampa.add(new THREE.Mesh(torno([[0, 0.32], [0.27, 0.32], [0.34, 0.295], [0.38, 0.24], [0.386, 0.045], [0.376, 0], [0, 0]]), matTampa));
  const alca = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.034, 12, 32, Math.PI), matTampa);
  alca.position.y = 0.3;
  const bico = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.058, 0.1, 20), matTampa);
  bico.position.set(0, 0.36, 0.2);
  tampa.add(alca, bico);
  const canudo = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.4, 16), new THREE.MeshPhysicalMaterial({ color: 0xe9eef5, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.75 }));
  canudo.position.y = 1.15;
  g.add(corpo, fundo, rosca, anel, tampa, canudo);
  g.userData = { altura: 2.455, partes: { corpo, fundo, rosca, anel, tampa, canudo }, matCorpo, matAnel, definirCor(hex) { matCorpo.color.set(hex); } };
  return g;
}

/* ================= Taça de gin (desmonta e vira copo) ================= */
export function criarTaca({ cor = 0xc8102e } = {}) {
  const g = new THREE.Group();
  g.name = 'taca';
  const matCor = M.pintura(cor, { metalness: 0.3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const bojo = new THREE.Group();
  bojo.add(new THREE.Mesh(tornoSuave([[0, 0.94], [0.15, 0.95], [0.32, 1.03], [0.47, 1.19], [0.55, 1.4], [0.545, 1.62], [0.505, 1.82], [0.472, 1.975], [0.465, 1.99]]), matCor));
  bojo.add(new THREE.Mesh(tornoSuave([[0.452, 1.985], [0.49, 1.82], [0.525, 1.62], [0.53, 1.42], [0.45, 1.2], [0.3, 1.06], [0, 1.02]]), M.inox({ side: THREE.DoubleSide })));
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.459, 0.008, 8, 72), M.inox());
  aro.rotation.x = Math.PI / 2; aro.position.y = 1.988;
  bojo.add(aro);
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.86, 24), matCor);
  haste.position.y = 0.51;
  const base = new THREE.Group();
  base.add(new THREE.Mesh(torno([[0, 0.008], [0.39, 0.008], [0.405, 0.02], [0.39, 0.052], [0.12, 0.074], [0.06, 0.084], [0, 0.084]]), matCor));
  base.add(new THREE.Mesh(torno([[0, 0], [0.385, 0], [0.388, 0.009], [0, 0.009]]), M.borracha()));
  g.add(bojo, haste, base);
  g.userData = { altura: 1.99, partes: { bojo, haste, base }, matCor, definirCor(hex) { matCor.color.set(hex); } };
  return g;
}

/* ================= Tábua de corte com canaleta ================= */
function texturaBambu() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 660;
  const g = c.getContext('2d');
  g.fillStyle = '#c48e4c'; g.fillRect(0, 0, c.width, c.height);
  // Ripas de bambu ao longo do comprimento
  let y = 0, k = 0;
  while (y < c.height) {
    const h = 22 + (k * 37 % 19);
    const tons = ['#c99552', '#be8744', '#cd9b58', '#b98140', '#c6914e'];
    g.fillStyle = tons[k % tons.length];
    g.fillRect(0, y, c.width, h);
    g.fillStyle = 'rgba(120,70,20,.18)';
    g.fillRect(0, y + h - 1.5, c.width, 1.5);
    // nós
    for (let n = 0; n < 3; n++) {
      const x = ((k * 211 + n * 337) % 1000) + 12;
      g.fillStyle = 'rgba(110,62,18,.28)';
      g.fillRect(x, y + 2, 5, h - 4);
    }
    y += h; k++;
  }
  // Fibras finas
  g.globalAlpha = 0.08;
  for (let i = 0; i < 900; i++) {
    const yy = (i * 7.3) % c.height;
    g.fillStyle = i % 2 ? '#8a5a2b' : '#f3d29b';
    g.fillRect((i * 97) % c.width, yy, 40 + (i % 90), 1);
  }
  g.globalAlpha = 1;
  // Canaleta
  const m = 46, r = 70;
  g.lineWidth = 12; g.strokeStyle = 'rgba(105,60,20,.55)';
  g.beginPath(); g.roundRect(m, m, c.width - m * 2, c.height - m * 2, r); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,230,180,.35)';
  g.beginPath(); g.roundRect(m + 6, m + 6, c.width - m * 2 - 12, c.height - m * 2 - 12, r - 6); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function criarTabua() {
  const g = new THREE.Group();
  g.name = 'tabua';
  const W = 2.8, H = 1.8, R = 0.16;
  const s = new THREE.Shape();
  s.moveTo(-W / 2 + R, -H / 2);
  s.lineTo(W / 2 - R, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
  s.lineTo(W / 2, H / 2 - R); s.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2);
  s.lineTo(-W / 2 + R, H / 2); s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R);
  s.lineTo(-W / 2, -H / 2 + R); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
  const furo = new THREE.Path();
  furo.absarc(W / 2 - 0.2, H / 2 - 0.2, 0.07, 0, Math.PI * 2, true);
  s.holes.push(furo);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.012, 0);
  const tex = texturaBambu();
  tex.repeat.set(1 / W, 1 / H); tex.offset.set(0.5, 0.5);
  const placa = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.7, clearcoat: 0.1, envMapIntensity: 0.6 }));
  const gravura = new Gravura(1024, 610);
  const matG = matGravura('madeira', gravura);
  const pw = 2.1, ph = 1.25;
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), matG);
  plano.rotation.x = -Math.PI / 2; plano.position.y = 0.1255; plano.renderOrder = 2;
  g.add(placa, plano);
  g.userData = {
    altura: 0.124, partes: { placa, plano }, gravura, matGravura: matG,
    alvo(u, v, pos, normal) {
      pos.set((u - 0.5) * pw, (v - 0.5) * ph, 0); plano.localToWorld(pos);
      if (normal) normal.set(0, 0, 1).transformDirection(plano.matrixWorld);
    }
  };
  return g;
}

/* ================= Caixa de presente (vídeo do hero) =================
   Papel ultramar fosco com o Q da marca em verniz localizado (só aparece no reflexo),
   fita de cetim champanhe em quatro braços que se soltam, laço e a boca iluminada. */
function uvPlanar(geo, escala) {
  // UV por projeção na face dominante, em unidades do mundo: o padrão não estica em faces de tamanhos diferentes.
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ax >= ay && ax >= az) uv.setXY(i, z * Math.sign(nor.getX(i)) * escala, y * escala);
    else if (ay >= az) uv.setXY(i, x * escala, z * escala);
    else uv.setXY(i, -x * Math.sign(nor.getZ(i)) * escala, y * escala);
  }
  uv.needsUpdate = true;
  return geo;
}
/* Fita plana ao longo de uma curva (pontos [x,y] no plano XY ou [x,y,z]); a largura fica no eixo dado. */
function fitaCurva(pontos, largura, fechada = false, eixo = 'z') {
  const curva = new THREE.CatmullRomCurve3(pontos.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0)), fechada, 'catmullrom', 0.5);
  const n = 64, lado = eixo === 'z' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= n; i++) {
    const p = curva.getPointAt((i / n) % 1);
    for (const sgn of [-0.5, 0.5]) { pos.push(p.x + lado.x * largura * sgn, p.y + lado.y * largura * sgn, p.z + lado.z * largura * sgn); uv.push(sgn + 0.5, i / n); }
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
function texturaMonograma() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(0,166,0)'; // rugosidade ~0,65 (papel fosco)
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgb(0,128,0)'; // ~0,5 (verniz localizado: só aparece no reflexo)
  g.font = '600 96px Playfair, Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  [[128, 128], [384, 384]].forEach(([x, y]) => g.fillText('Q', x, y));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
export function criarCaixa() {
  const g = new THREE.Group();
  g.name = 'caixa';
  const papel = new THREE.MeshPhysicalMaterial({ color: 0x090748, roughness: 1, roughnessMap: texturaMonograma(), metalness: 0, sheen: 0.3, sheenColor: 0x2c2690, sheenRoughness: 0.8, envMapIntensity: 0.35 });
  const fita = new THREE.MeshPhysicalMaterial({ color: 0xd9ad5c, metalness: 0.35, roughness: 0.36, sheen: 0.6, sheenColor: 0xffe7b8, sheenRoughness: 0.35, envMapIntensity: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 1 });
  const B = 1.7, A = 1.25, LT = 1.79, AT = 0.3, SOB = 0.08, LF = 0.24, EF = 0.008;
  const topoCorpo = A - SOB;
  const corpo = new THREE.Mesh(uvPlanar(new THREE.RoundedBoxGeometry(B, A, B, 5, 0.035), 1.5), papel);
  corpo.position.y = A / 2;
  // Boca: interior escuro com a luz quente no fundo (aparece quando a tampa sobe)
  const cb = document.createElement('canvas'); cb.width = cb.height = 256;
  const gb = cb.getContext('2d');
  const rg = gb.createRadialGradient(128, 128, 6, 128, 128, 150);
  rg.addColorStop(0, '#fff1c8'); rg.addColorStop(0.22, '#ffc35c'); rg.addColorStop(0.55, '#6a3a3a'); rg.addColorStop(1, '#0b0733');
  gb.fillStyle = rg; gb.fillRect(0, 0, 256, 256);
  const texBoca = new THREE.CanvasTexture(cb); texBoca.colorSpace = THREE.SRGBColorSpace;
  const boca = new THREE.Mesh(new THREE.PlaneGeometry(B - 0.07, B - 0.07), new THREE.MeshBasicMaterial({ map: texBoca, toneMapped: false, transparent: true, opacity: 0 }));
  boca.rotation.x = -Math.PI / 2; boca.position.y = A + 0.002;

  const tampa = new THREE.Group();
  tampa.add(new THREE.Mesh(uvPlanar(new THREE.RoundedBoxGeometry(LT, AT, LT, 5, 0.035), 1.5), papel));
  tampa.position.y = topoCorpo + AT / 2;

  /* Fita: quatro braços em L (lateral do corpo + lateral da tampa + metade do topo), pivô na aresta de baixo */
  const bracos = [0, 1, 2, 3].map((k) => {
    const ang = k * Math.PI / 2;
    const pivo = new THREE.Group();
    pivo.rotation.y = ang;
    const braco = new THREE.Group();
    braco.position.z = B / 2;
    const lateral = new THREE.Mesh(new THREE.BoxGeometry(LF, topoCorpo, EF), fita);
    lateral.position.set(0, topoCorpo / 2, EF / 2);
    const lateralTampa = new THREE.Mesh(new THREE.BoxGeometry(LF, AT + EF, EF), fita);
    lateralTampa.position.set(0, topoCorpo + AT / 2, (LT - B) / 2 + EF / 2);
    const topo = new THREE.Mesh(new THREE.BoxGeometry(LF, EF, LT / 2), fita);
    topo.position.set(0, topoCorpo + AT + EF / 2, (LT - B) / 2 - LT / 4);
    braco.add(lateral, lateralTampa, topo);
    pivo.add(braco);
    g.add(pivo);
    return { pivo, braco };
  });

  // Laço de cetim: alças e pontas são fitas planas (tira com largura), não tubos
  const laco = new THREE.Group();
  const alcaGeo = fitaCurva([[0, 0], [0.12, 0.2], [0.3, 0.4], [0.5, 0.42], [0.58, 0.26], [0.45, 0.08], [0.2, 0.0]], 0.2, true);
  const esq = new THREE.Group(), dir = new THREE.Group();
  const alcaE = new THREE.Mesh(alcaGeo, fita); alcaE.scale.x = -1;
  esq.add(alcaE); dir.add(new THREE.Mesh(alcaGeo, fita));
  // alças menores por dentro deixam o laço cheio
  const alcaE2 = new THREE.Mesh(alcaGeo, fita); alcaE2.scale.set(-0.72, 0.8, 0.72); alcaE2.rotation.set(0.25, 0.95, 0.1);
  const alcaD2 = new THREE.Mesh(alcaGeo, fita); alcaD2.scale.set(0.72, 0.8, 0.72); alcaD2.rotation.set(0.25, -0.95, -0.1);
  esq.add(alcaE2); dir.add(alcaD2);
  esq.position.y = dir.position.y = 0.07;
  esq.rotation.set(-0.22, -0.38, 0.12); dir.rotation.set(-0.22, 0.38, -0.12);
  const no = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.2, 0.15, 0.22, 3, 0.05), fita); no.position.y = 0.075;
  const pontaGeo = fitaCurva([[0, 0, 0], [0.04, -0.02, 0.2], [0.1, -0.06, 0.42], [0.15, -0.075, 0.62]], 0.17, false, 'y');
  const pontaA = new THREE.Mesh(pontaGeo, fita); pontaA.rotation.y = 0.5;
  const pontaB = new THREE.Mesh(pontaGeo, fita); pontaB.rotation.y = -0.5; pontaB.scale.x = -1;
  pontaA.position.y = pontaB.position.y = 0.02;
  laco.add(esq, dir, no, pontaA, pontaB);
  laco.position.y = topoCorpo + AT + EF;

  // Luz que sai da caixa: feixe macio (plano que a cena vira para a câmera) e luz pontual
  const cr = document.createElement('canvas'); cr.width = 128; cr.height = 256;
  const gr2 = cr.getContext('2d');
  const img = gr2.createImageData(128, 256);
  for (let y = 0; y < 256; y++) {
    const v = y / 255; // 0 = alto, 1 = boca
    const sobe = Math.pow(v, 1.5) * Math.min(1, (1 - v) / 0.1);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127 - 0.5) * 2;
      const larg = 0.52 + 0.4 * (1 - v);
      const a = Math.exp(-(u * u) / (2 * larg * larg * 0.18)) * sobe;
      const i = (y * 128 + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 214 + 30 * v; img.data[i + 2] = 150 + 60 * v; img.data[i + 3] = Math.round(a * 255);
    }
  }
  gr2.putImageData(img, 0, 0);
  const texRaios = new THREE.CanvasTexture(cr); texRaios.colorSpace = THREE.SRGBColorSpace;
  const raiosGeo = new THREE.PlaneGeometry(2.4, 3.6);
  raiosGeo.translate(0, 1.8, 0);
  const raios = new THREE.Mesh(raiosGeo, new THREE.MeshBasicMaterial({ map: texRaios, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  raios.position.y = A - 0.1;
  const luzInterna = new THREE.PointLight(0xffc066, 0, 7, 1.5);
  luzInterna.position.y = A + 0.45;
  g.add(corpo, boca, tampa, laco, raios, luzInterna);
  g.userData = { partes: { corpo, boca, tampa, laco, esq, dir, no, pontaA, pontaB, raios, luzInterna, bracos }, materiais: { papel, fita }, A, AT, B, topo: topoCorpo + AT };
  return g;
}

export function escalaPara(alturaDesejada, modelo) { return alturaDesejada / modelo.userData.altura; }
export { _p };
