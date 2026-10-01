/* Estúdio: prévia 3D ao vivo do produto escolhido, com texto ou foto gravados. Gira com o dedo ou o mouse. */
import * as THREE from 'three';
import { criarPalco, luzes, sombra, brilhoChao, limitar, saida, elastico, lerp, ligado, toque } from './base.js';
import { criarCopo, criarCaneca, criarCaneta, criarChaveiro, criarTabua } from './modelos.js';
import { criarLaser, fontesProntas, pontilhar, prepararCor } from './gravacao.js';

const QUADRO = {
  copo: { criar: () => criarCopo(), esc: 1.05, y: -0.9, x: 0, rx: 0, rz: 0, dist: 5.4, alvoY: 0.05 },
  caneca: { criar: () => criarCaneca(), esc: 1.75, y: -0.84, x: -0.12, rx: 0, rz: 0, dist: 5.2, alvoY: 0.0, rot0: -0.25 },
  caneta: { criar: () => criarCaneta(), esc: 1.55, y: -1.015, x: 0, rx: 0, rz: -Math.PI / 2, dist: 5.0, alvoY: 0 },
  chaveiro: { criar: () => criarChaveiro(), esc: 2.35, y: 0.55, x: 0, rx: 0, rz: 0, dist: 5.0, alvoY: -0.1 },
  tabua: { criar: () => criarTabua(), esc: 0.8, y: -0.05, x: 0, rx: 0.9, rz: 0, dist: 5.6, alvoY: 0 }
};

export function iniciarEstudio(secao) {
  const host = secao.querySelector('#palco-estudio');
  const palco = criarPalco(host, { fov: 30, exposicao: 1.12, ambiente: 0.9 });
  const { cena, camera } = palco;
  luzes(cena);
  const chao = sombra(1.2, 0.55);
  chao.position.y = -1.0;
  const halo = brilhoChao(1.8, 0xffb21e, 0.22);
  halo.position.y = -0.998;
  cena.add(chao, halo);
  const laser = criarLaser({ faiscas: toque ? 40 : 70 });
  cena.add(laser.grupo);

  const raiz = new THREE.Group(); // rotação do usuário
  cena.add(raiz);
  const modelos = {};
  let atual = null, saindo = null, troca = 1, trocaT = 0;

  function obter(nome) {
    if (modelos[nome]) return modelos[nome];
    const q = QUADRO[nome];
    const m = q.criar();
    const pose = new THREE.Group();
    m.scale.setScalar(q.esc);
    m.position.set(q.x, q.y, 0);
    pose.rotation.set(q.rx, 0, q.rz);
    pose.add(m);
    pose.visible = false;
    raiz.add(pose);
    modelos[nome] = { nome, m, pose, q };
    return modelos[nome];
  }

  /* Gravação */
  let est = null, inicioGravura = 0, duracao = 0, gravando = false, laserLado = 1, laserLigado = false;
  const fotoCache = new WeakMap();
  function fotoPara(img, tipo) {
    let c = fotoCache.get(img);
    if (!c) { c = {}; fotoCache.set(img, c); }
    if (!c[tipo]) c[tipo] = tipo === 'laser' ? pontilhar(img, 420) : prepararCor(img);
    return c[tipo];
  }
  function linhasTexto() {
    const l = [est.texto, est.texto2].map((s) => (s || '').trim()).filter(Boolean);
    return l.length ? l : ['Seu nome'];
  }
  const frente = { u: 0.5, v: 0.5 };
  function desenhar(k) {
    if (!est || !atual) return;
    const ud = atual.m.userData;
    const t = est.tecnica;
    let f = null;
    if (atual.nome === 'caneca') {
      const foto = est.foto ? fotoPara(est.foto, 'cor') : null;
      const escura = new THREE.Color(est.corHex).getHSL({}).l < 0.3;
      if (foto) f = ud.gravura.foto(foto, k, { texto: [est.texto, est.texto2], fonte: est.fonte, corTexto: escura ? '#FFC857' : '#1408B8' });
      else f = ud.gravura.texto(linhasTexto(), est.fonte, k, { cor: escura ? '#FFC857' : '#1408B8', tamanho: 0.4 });
    } else if (t === 'foto-laser') {
      const foto = est.foto ? fotoPara(est.foto, 'laser') : null;
      if (foto) f = ud.gravura.foto(foto, k);
      else f = ud.gravura.texto(['Escolha', 'uma foto'], 'moderna', k, { tamanho: 0.3 });
    } else {
      const tam = atual.nome === 'caneta' ? 0.62 : atual.nome === 'chaveiro' ? 0.5 : atual.nome === 'tabua' ? 0.42 : 0.46;
      const ehChav = atual.nome === 'chaveiro';
      f = ud.gravura.texto(linhasTexto(), est.fonte, k, { tamanho: tam, margem: atual.nome === 'caneta' ? 0.05 : ehChav ? 0.2 : 0.1, subir: ehChav ? 0.1 : 0, escala2: ehChav ? 0.72 : 0.55 });
    }
    if (f) { frente.u = f.u; frente.v = f.v; }
  }
  function regravar() {
    if (!est || !atual) return;
    const ehFoto = est.tecnica !== 'laser' && est.foto;
    duracao = ehFoto ? 2600 : 1200;
    inicioGravura = performance.now();
    gravando = ligado();
    if (!gravando) desenhar(1);
    palco.marcar();
  }

  /* Troca de produto */
  function aplicar(estado, motivo) {
    est = estado;
    const novo = obter(estado.produto);
    if (novo !== atual) {
      if (atual) { saindo = atual; }
      atual = novo;
      atual.pose.visible = true;
      troca = ligado() ? 0 : 1;
      trocaT = performance.now();
      alvoRot = (atual.q.rot0 || 0); rot = alvoRot + (ligado() ? -1.8 : 0);
    }
    if (atual.m.userData.definirCor) atual.m.userData.definirCor(estado.corHex);
    if (motivo === 'cor') { palco.marcar(); return; }
    fontesProntas().then(regravar);
  }
  document.addEventListener('qb:estudio', (e) => aplicar(e.detail.estado, e.detail.motivo));

  /* Arrastar para girar (com inércia) */
  let alvoRot = 0, rot = 0, vel = 0, arrastando = false, x0 = 0, ultimoToque = 0;
  host.addEventListener('pointerdown', (e) => { arrastando = true; x0 = e.clientX; vel = 0; ultimoToque = performance.now(); palco.marcar(); });
  window.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    const dx = e.clientX - x0;
    x0 = e.clientX;
    alvoRot += dx * 0.011;
    vel = dx * 0.011;
    ultimoToque = performance.now();
    palco.marcar();
  }, { passive: true });
  const soltar = () => { arrastando = false; };
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);

  function enquadrar() { palco.centralizar(0.5, 0.52); }
  palco.aoRedimensionar = enquadrar;
  enquadrar();

  const alvoL = new THREE.Vector3(), normL = new THREE.Vector3(), origL = new THREE.Vector3();
  let ultimoRender = 0;
  palco.tick = (dt, t) => {
    if (!atual) return false;
    const mov = ligado();
    let animando = false;
    // Inércia e giro ocioso de vitrine
    if (!arrastando && Math.abs(vel) > 0.0004) { alvoRot += vel; vel *= 0.92; animando = true; }
    const ocioso = mov && !arrastando && t - ultimoToque > 2600 && !gravando;
    const base = atual.q.rot0 || 0;
    if (ocioso) alvoRot = lerp(alvoRot, base + Math.sin(t * 0.00045) * 0.55, 1 - Math.exp(-dt / 900));
    const d = alvoRot - rot;
    rot += d * (1 - Math.exp(-dt / (mov ? 90 : 1)));
    if (Math.abs(d) > 0.0005) animando = true;
    raiz.rotation.y = rot;
    // Troca de produto
    if (troca < 1) {
      troca = limitar((t - trocaT) / 650);
      animando = true;
    }
    const entra = elastico(troca);
    atual.pose.scale.setScalar(Math.max(0.0001, entra));
    if (saindo) {
      const s = 1 - saida(limitar(troca * 1.8));
      saindo.pose.scale.setScalar(Math.max(0.0001, s));
      saindo.pose.rotation.y = (1 - s) * 2.2;
      if (s <= 0.001) { saindo.pose.visible = false; saindo.pose.rotation.y = 0; saindo = null; }
    }
    // Gravação animada
    const ud = atual.m.userData;
    let k = 1;
    if (gravando) {
      k = limitar((t - inicioGravura) / duracao);
      desenhar(k);
      if (k >= 1) gravando = false;
      animando = true;
    }
    if (ud.matGravura && ud.matGravura.emissiveIntensity !== undefined) {
      const usaLaser = est && est.tecnica !== 'foto-cor' && atual.nome !== 'caneca';
      ud.matGravura.emissiveIntensity = gravando && usaLaser ? 1.4 : Math.max(0, ud.matGravura.emissiveIntensity - dt * 0.0016);
      if (ud.matGravura.emissiveIntensity > 0) animando = true;
    }
    const comLaser = gravando && est && est.tecnica !== 'foto-cor' && atual.nome !== 'caneca' && troca >= 1;
    if (comLaser) {
      cena.updateMatrixWorld();
      ud.alvo(frente.u, frente.v, alvoL, normL, laserLado);
      origL.set(alvoL.x * 0.3 + normL.x * 0.6, alvoL.y + 2.4, alvoL.z + normL.z * 1.2 + 0.5);
      laser.apontar(origL, alvoL, normL);
    }
    laser.ligar(comLaser);
    if (comLaser !== laserLigado) { laserLigado = comLaser; document.dispatchEvent(new CustomEvent('qb:laser', { detail: { on: comLaser } })); }
    if (laser.atualizar(dt)) animando = true;
    // Câmera por produto
    camera.position.set(0, 0.55, atual.q.dist * (palco.w < 420 ? 1.12 : 1));
    camera.lookAt(0, atual.q.alvoY, 0);
    // Ocioso a ~30 fps; parado, não desenha
    if (!animando && !ocioso) return false;
    if (!animando && t - ultimoRender < 33) return false;
    ultimoRender = t;
    return true;
  };

  document.addEventListener('qb:motion', () => palco.marcar());
  const inicial = window.QBEstudio && window.QBEstudio.estado;
  if (inicial) aplicar(inicial, 'produto');
  requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('palco3d--pronto')));
  return palco;
}
