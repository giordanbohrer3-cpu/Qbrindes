/* Vitrine em vídeo: um capítulo por produto (copo, caneta, chaveiro, garrafa, taça).
   Todo capítulo começa e termina no mesmo palco vazio, então a troca entre vídeos não aparece.
   Rótulos não são desenhados no vídeo: a cena exporta a posição de cada um (0–1 do quadro) para o HTML. */
import * as THREE from 'three';
import { criarCopo, criarCaneta, criarChaveiro, criarGarrafa, criarTaca } from '/js/3d/modelos.js';
import { criarLaser } from '/js/3d/gravacao.js';
import { luzes, sombra } from '/js/3d/base.js';
import { trecho, lerp, suave, mola, criarFundo, ambiente, brilho, aleatorio } from './comum.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function criar({ renderer, W, H, q }) {
  const produto = q.produto;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  ambiente(renderer, scene, 0.85);
  const L = luzes(scene);
  L.hemi.intensity = 0.38;
  L.chave.intensity = 2.4;
  const fundo = criarFundo({ cx: 0.5, cy: 0.56, raio: 0.5, aspecto: W / H, centro: 0x17115c });
  renderer.getDrawingBufferSize(fundo.material.uniforms.uRes.value);
  const cenaFundo = new THREE.Scene();
  cenaFundo.add(fundo);

  const mundo = new THREE.Group();
  scene.add(mundo);
  const chao = sombra(1.1, 0.6); chao.position.y = 0.003;
  mundo.add(chao);
  const laser = criarLaser({ faiscas: 90 });
  mundo.add(laser.grupo);
  const suporte = new THREE.Group();
  const giro = new THREE.Group();
  suporte.add(giro);
  mundo.add(suporte);

  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 80);
  const ENQ = { copo: [6.9, 1.12], caneta: [6.2, 1.15], chaveiro: [7.1, 1.66], garrafa: [7.4, 1.38], taca: [6.7, 1.02] }[produto] || [7, 1.1];
  camera.position.set(0, ENQ[1] + 0.62, ENQ[0]);
  camera.lookAt(0, ENQ[1], 0);

  // Vitrine: poça de luz champanhe no chão e um foco suave vindo de cima
  const poca = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: (brilho(0xffffff, 1).material.map), color: 0xf3d9a4, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  poca.rotation.x = -Math.PI / 2; poca.position.y = 0.004; poca.scale.y = 0.62;
  mundo.add(poca);
  const foco = brilho(0x9d93ff, 5.5, 0.07); foco.position.set(0, ENQ[1] + 1.4, -1.2);
  mundo.add(foco);

  const rotulos = [];
  const rot = (texto, obj, ancora, lado, de, ate) => rotulos.push({ texto, obj, ancora: V(...ancora), lado, de, ate });
  const alvoL = V(0, 0, 0), normL = V(0, 0, 1), origL = V(0, 0, 0);
  let brasa = 0, matBrasa = null;
  const cues = {};

  /* Laser: aponta para a frente da gravação e solta faíscas; a gravura acende e esfria depois */
  function gravando(m, fr, ladoVerso, dt, ativo, mat) {
    if (ativo && fr) {
      scene.updateMatrixWorld();
      m.userData.alvo(fr.u, fr.v, alvoL, normL, ladoVerso);
      mundo.worldToLocal(alvoL);
      origL.set(alvoL.x * 0.3 + normL.x * 0.9 + 0.2, alvoL.y + 2.9, alvoL.z + normL.z * 1.3 + 0.5);
      laser.apontar(origL, alvoL, normL);
    }
    laser.ligar(!!(ativo && fr));
    if (mat) {
      if (ativo) { brasa = 1.5; matBrasa = mat; }
      mat.emissiveIntensity = mat === matBrasa ? brasa : 0;
    }
  }
  function esfriar(dt) { brasa = Math.max(0, brasa - dt * 1.3); }

  let DUR = 7, quadroProduto = null;

  if (produto === 'copo') {
    DUR = 7.0;
    const copo = criarCopo({ cor: 0xb3141d, tipoGravura: 'aco' });
    copo.scale.setScalar(1.16);
    giro.add(copo);
    const P = copo.userData.partes;
    Object.assign(cues, { entra: 0, gira: 0.9, abre: 2.0, fecha: 3.9, laser: 4.6, laserFim: 5.75, sai: 6.3 });
    rot('Tampa rosqueável com bocal', P.tampa, [0.46, 1.62, 0], 1, 2.45, 3.95);
    rot('Parede interna de inox', P.interna, [-0.41, 1.3, 0], -1, 2.6, 3.95);
    rot('Parede dupla', P.corpo, [0.43, 0.82, 0], 1, 2.75, 3.95);
    rot('Borracha antideslizante', P.borracha, [-0.37, 0.03, 0], -1, 2.9, 3.95);
    rot('Gravação a laser', P.faixa, [0.3, 0.95, 0.35], 1, 5.1, 6.3);
    quadroProduto = (t, dt) => {
      const ent = mola(t, 0, 0.95), sai = suave(trecho(t, 6.3, 7.0));
      const abreY = mola(t, 2.0, 0.6) * (1 - mola(t, 3.9, 0.6));
      suporte.position.set(lerp(0, -4.4, sai), lerp(3.8, 0, ent) + abreY * 0.52, 0);
      giro.rotation.y = (1 - ent) * 2.2 + suave(trecho(t, 0.9, 2.0)) * Math.PI * 2 + Math.sin(t * 0.8) * 0.05 - sai * 0.8 - 0.15;
      const abre = mola(t, 2.0, 0.6) * (1 - mola(t, 3.9, 0.6));
      P.tampa.position.y = abre * 0.62; P.tampa.rotation.z = abre * 0.1;
      P.interna.position.y = abre * 0.42; P.aro.position.y = 1.405 + abre * 0.42;
      P.borracha.position.y = -abre * 0.42; P.corpo.rotation.y = abre * 0.25;
      const g = trecho(t, 4.6, 5.75);
      const fr = copo.userData.gravura.texto(['SEU LOGO', 'aqui'], 'moderna', g, { tamanho: 0.36 });
      gravando(copo, fr, 1, dt, g > 0 && g < 1, copo.userData.matGravura);
    };
  }

  if (produto === 'caneta') {
    DUR = 6.6;
    const caneta = criarCaneta({ cor: 0x1b2a6b });
    caneta.scale.setScalar(2.25);
    caneta.position.y = -0.655 * 2.25;
    giro.add(caneta);
    const P = caneta.userData.partes;
    Object.assign(cues, { entra: 0, laser: 1.35, laserFim: 3.3, gira: 3.6, sai: 5.8 });
    rot('Nome gravado no corpo', caneta, [0, 0.42, 0.06], 1, 2.5, 4.2);
    rot('Acionamento por rotação', P.superior, [0, 1.02, 0.05], -1, 3.9, 5.6);
    const dir = V(Math.sin(0.62), Math.cos(0.62), 0);
    quadroProduto = (t, dt) => {
      const ent = mola(t, 0, 1.1), sai = suave(trecho(t, 5.8, 6.6));
      const vem = (1 - ent) * 4.6 + sai * 4.6; // entra e sai pelo alto, ao longo do próprio eixo
      suporte.position.set(vem * dir.x, 1.15 + vem * dir.y, 0);
      suporte.rotation.z = -0.62;
      giro.rotation.y = (1 - ent) * Math.PI * 3 - sai * Math.PI * 2 + Math.sin(t * 0.7) * 0.04;
      const g = trecho(t, 1.35, 3.3);
      const fr = caneta.userData.gravura.texto(['Rafael Lima'], 'manuscrita', g, { tamanho: 0.62, margem: 0.06 });
      gravando(caneta, fr, 1, dt, g > 0 && g < 1, caneta.userData.matGravura);
      const tw = suave(trecho(t, 3.6, 4.6));
      P.superior.rotation.y = tw * Math.PI;
      P.refil.position.y = 0.03 - tw * 0.055;
    };
  }

  if (produto === 'chaveiro') {
    DUR = 7.0;
    const ch = criarChaveiro({ tipoGravura: 'escuro' });
    ch.scale.setScalar(3.1);
    giro.add(ch);
    const P = ch.userData.partes;
    Object.assign(cues, { entra: 0, laser: 1.25, laserFim: 2.75, vira: 3.0, laser2: 3.9, laser2Fim: 5.3, sai: 6.2 });
    rot('Frente: os nomes', P.coracao, [0.33, 0, 0], 1, 2.2, 3.3);
    rot('Verso: a data', P.coracao, [-0.36, 0.12, 0], -1, 4.8, 6.2);
    quadroProduto = (t, dt) => {
      const ent = mola(t, 0, 1.0), sai = suave(trecho(t, 6.2, 7.0));
      suporte.position.set(0, 2.16 + (1 - ent) * 3.8 + sai * 4.0, 0);
      // pêndulo amortecido de verdade (sem quique): amplitude cai e some
      suporte.rotation.z = 0.16 * Math.exp(-t * 1.6) * Math.sin(t * 5.2) + Math.sin(t * 1.3) * 0.02;
      const vira = suave(trecho(t, 3.0, 3.8));
      giro.rotation.y = -0.12 + vira * Math.PI + Math.sin(t * 0.9) * 0.05 + sai * 0.6;
      const gf = trecho(t, 1.25, 2.75), gv = trecho(t, 3.9, 5.3);
      const ff = ch.userData.gravura.texto(['Ana', '& Leo'], 'manuscrita', gf, { tamanho: 0.42, subir: 0.12, escala2: 0.64, margem: 0.25 });
      const fv = ch.userData.gravuraVerso.texto(['12.10.2026'], 'classica', gv, { tamanho: 0.24, subir: 0.08, margem: 0.22 });
      if (gf > 0 && gf < 1) gravando(ch, ff, 1, dt, true, ch.userData.matGravura);
      else if (gv > 0 && gv < 1) gravando(ch, fv, -1, dt, true, ch.userData.matVerso);
      else { laser.ligar(false); ch.userData.matGravura.emissiveIntensity = matBrasa === ch.userData.matGravura ? brasa : 0; ch.userData.matVerso.emissiveIntensity = matBrasa === ch.userData.matVerso ? brasa : 0; }
    };
  }

  if (produto === 'garrafa') {
    DUR = 7.6;
    const gar = criarGarrafa({ cor: 0x16161b });
    gar.scale.setScalar(0.86);
    giro.add(gar);
    const P = gar.userData.partes;
    const matAnel = gar.userData.matAnel;
    matAnel.color.set(0xb9a27a); matAnel.emissive.set(0xffd48a);
    Object.assign(cues, { entra: 0, tampa: 1.0, anel: 2.0, canudo: 2.8, frio: 3.8, quente: 4.8, fecha: 5.9, sai: 6.7 });
    rot('Tampa com alça', P.tampa, [0.38, 0.22, 0], 1, 1.6, 3.0);
    rot('Anel de silicone', P.anel, [-0.37, 0, 0], -1, 2.2, 3.4);
    rot('Canudo', P.canudo, [0, 1.25, 0], 1, 3.2, 4.4);
    rot('Parede dupla de inox', P.corpo, [-0.445, 1.0, 0], -1, 4.0, 5.9);
    // gelo e vapor (posições puras do tempo)
    const r = aleatorio(31);
    const gelo = [], vapor = [];
    for (let i = 0; i < 40; i++) { const s = brilho(0xcfe9ff, 0.07 + r() * 0.06, 0); mundo.add(s); gelo.push({ s, x: (r() - 0.5) * 2.2, z: (r() - 0.5) * 1.2 + 0.3, y: r() * 3, v: 0.35 + r() * 0.5, f: r() * 6.3 }); }
    for (let i = 0; i < 26; i++) { const s = brilho(0xffffff, 0.35 + r() * 0.3, 0); mundo.add(s); vapor.push({ s, x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.3, y: r(), v: 0.25 + r() * 0.2, f: r() * 6.3 }); }
    quadroProduto = (t, dt) => {
      const ent = mola(t, 0, 1.0), sai = suave(trecho(t, 6.7, 7.6));
      suporte.position.set(0, lerp(4.4, 0, ent) + sai * 4.6, 0);
      giro.rotation.y = -0.5 + (1 - ent) * 2.6 + t * 0.09 + Math.sin(t * 0.8) * 0.04;
      const ab = mola(t, 1.0, 1.0) * (1 - mola(t, 5.9, 0.8));
      P.tampa.rotation.y = -ab * Math.PI * 3;
      P.tampa.position.y = 2.135 + ab * 0.55;
      P.tampa.rotation.x = -ab * 0.2;
      matAnel.emissiveIntensity = trecho(t, 2.0, 2.4) * (1 - trecho(t, 3.2, 3.8)) * 0.9;
      const can = mola(t, 2.8, 0.8) * (1 - mola(t, 5.7, 0.6));
      P.canudo.position.y = 1.15 + can * 0.85;
      const frio = trecho(t, 3.8, 4.1) * (1 - trecho(t, 4.6, 4.9));
      const quente = trecho(t, 4.8, 5.1) * (1 - trecho(t, 5.6, 5.9));
      L.contraB.color.setHex(0xffb21e).lerp(new THREE.Color(0x9fd4ff), frio);
      L.contraB.intensity = 18 + frio * 14 + quente * 8;
      for (const g of gelo) {
        const yy = ((g.y - t * g.v) % 3 + 3) % 3;
        g.s.position.set(g.x + Math.sin(t + g.f) * 0.05, yy, g.z);
        g.s.material.opacity = frio * 0.85;
      }
      for (const v of vapor) {
        const yy = (v.y * 1.2 + t * v.v) % 1.2;
        v.s.position.set(v.x + Math.sin(t * 1.4 + v.f) * 0.12 * yy, 2.2 * 0.86 + 0.42 + yy, v.z);
        v.s.material.opacity = quente * 0.12 * Math.sin(Math.PI * yy / 1.2);
      }
    };
  }

  if (produto === 'taca') {
    DUR = 7.6;
    const taca = criarTaca({ cor: 0xb3141d });
    taca.scale.setScalar(1.05);
    giro.add(taca);
    const P = taca.userData.partes;
    const cores = [0xb3141d, 0x141418, 0xf2f2f0, 0xb3141d].map((h) => new THREE.Color(h));
    const _c = new THREE.Color();
    Object.assign(cues, { entra: 0, cor: 1.0, haste: 2.8, base: 3.6, copo: 4.4, sai: 6.7 });
    rot('Haste removível', P.haste, [0.06, 0.42, 0], 1, 3.0, 4.2);
    rot('Base antiderrapante', P.base, [-0.4, 0.04, 0], -1, 3.9, 5.0);
    rot('Agora é um copo', P.bojo, [0.55, 1.42, 0], 1, 5.0, 6.6);
    quadroProduto = (t) => {
      const ent = mola(t, 0, 1.0), sai = suave(trecho(t, 6.7, 7.6));
      suporte.position.set(lerp(4.2, 0, ent) + sai * 4.2, 0, 0);
      giro.rotation.y = (1 - ent) * -2.4 - 0.2 + t * 0.07 + sai * 0.7;
      const cc = trecho(t, 1.0, 2.6) * 3;
      const ci = Math.min(2, Math.floor(cc));
      _c.copy(cores[ci]).lerp(cores[ci + 1], suave(cc - ci));
      taca.userData.matCor.color.copy(_c);
      const a = mola(t, 2.8, 0.8), b = mola(t, 3.6, 0.8), c3 = mola(t, 4.4, 0.8);
      P.haste.position.set(a * 0.75 + b * 1.5, 0.51 - a * 0.3, 0);
      P.haste.scale.setScalar(Math.max(0.0001, 1 - b));
      P.haste.visible = b < 0.999;
      const solta = V(a * 0.75, -a * 0.3, 0), encaixe = V(0, 0.94 - 0.084, 0);
      P.base.position.lerpVectors(solta, encaixe, b);
      P.base.position.y -= c3 * 0.856;
      P.bojo.position.y = -c3 * 0.856;
    };
  }

  if (!quadroProduto) throw new Error('produto desconhecido: ' + produto);

  const _w = V(0, 0, 0);
  function quadro(t, dt, i) {
    quadroProduto(t, dt);
    esfriar(dt);
    laser.atualizar(dt * 1000);
    // sombra acompanha a altura do produto (some quando ele sai do chão)
    const alt = Math.max(0, suporte.position.y);
    chao.material.opacity = 0.6 * Math.max(0, 1 - alt / 3) * (Math.abs(suporte.position.x) < 3 ? 1 : 0);
    chao.position.x = suporte.position.x;
    scene.updateMatrixWorld();
    if (i % 3 !== 0) return null;
    const r = [];
    rotulos.forEach((ro, k) => {
      if (t < ro.de - 0.05 || t > ro.ate + 0.05) return;
      _w.copy(ro.ancora); ro.obj.localToWorld(_w); _w.project(camera);
      r.push([k, +(_w.x * 0.5 + 0.5).toFixed(4), +(-_w.y * 0.5 + 0.5).toFixed(4)]);
    });
    return r.length ? { r } : null;
  }

  /* Chão de vitrine com reflexo (mesmo tratamento do hero) */
  const veu = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: Object.assign({}, fundo.material.uniforms, { uForca: { value: 0.24 } }),
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: fundo.material.fragmentShader
      .replace('void main(){', 'varying vec3 vP; uniform float uForca; void main(){')
      .replace('gl_FragColor = vec4(cor, 1.0);', 'float r = length(vP.xz * vec2(1.0, 1.4)); float a = 1.0 - uForca * exp(-r * r / 2.4); gl_FragColor = vec4(cor, a);')
  }));
  veu.rotation.x = -Math.PI / 2;
  const cenaVeu = new THREE.Scene();
  cenaVeu.add(veu);
  const RECORTE = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  function render() {
    renderer.autoClear = false;
    renderer.clear(true, true, true);
    renderer.render(cenaFundo, camera);
    if (q.espelho === '0') { renderer.render(scene, camera); return; }
    mundo.scale.y = -1; chao.visible = false; poca.visible = false; foco.visible = false;
    renderer.clippingPlanes = RECORTE; // só reflete o que está acima do chão
    renderer.render(scene, camera);
    renderer.clippingPlanes = [];
    mundo.scale.y = 1; chao.visible = true; poca.visible = true; foco.visible = true;
    renderer.clearDepth();
    renderer.render(cenaVeu, camera);
    renderer.render(scene, camera);
  }

  return {
    scene, camera, dur: DUR, cues, quadro, render,
    meta: () => ({ produto, rotulos: rotulos.map((r) => ({ texto: r.texto, lado: r.lado, de: r.de, ate: r.ate })) })
  };
}
