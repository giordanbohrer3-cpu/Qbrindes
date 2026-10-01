/* Hero: o presente que se abre. Caixa → laço desata → tampa sobe com luz e confete →
   produtos sobem em órbita → o laser grava o nome no copo. Tudo amarrado à rolagem. */
import * as THREE from 'three';
import { criarPalco, luzes, sombra, brilhoChao, trecho, suave, saida, elastico, lerp, limitar, ligado, toque } from './base.js';
import { criarCaixa, criarCopo, criarCaneta, criarChaveiro, criarCaneca } from './modelos.js';
import { criarLaser, fontesProntas } from './gravacao.js';

const ETAPAS = [0.13, 0.35, 0.53, 0.73];

export function iniciarHero(secao) {
  const host = secao.querySelector('#palco-hero');
  const intro = secao.querySelector('.hero__intro');
  const barra = secao.querySelector('.hero__barra b');
  const palco = criarPalco(host, { fov: 28, exposicao: 1.12, ambiente: 0.8 });
  const { cena, camera } = palco;
  luzes(cena);

  const mundo = new THREE.Group();
  cena.add(mundo);
  const caixa = criarCaixa();
  mundo.add(caixa);
  const P = caixa.userData.partes;
  const A = caixa.userData.A, AT = caixa.userData.AT;
  const tampaBaseY = P.tampa.position.y;
  const chao = sombra(1.7, 0.6);
  chao.position.y = 0.002;
  const halo = brilhoChao(2.4, 0xffb21e, 0);
  halo.position.y = 0.004;
  mundo.add(chao, halo);

  /* Produtos que saem da caixa (cada um num suporte que orbita) */
  const copo = criarCopo({ cor: 0x17171c });
  const caneta = criarCaneta({ cor: 0x2614d6 });
  const chaveiro = criarChaveiro();
  const caneca = criarCaneca({ cor: 0xf4f3ef });
  const itens = [
    { m: copo, esc: 0.86, ajusteY: -0.74 },
    { m: caneta, esc: 1.05, ajusteY: -0.69, rotZ: -0.9 },
    { m: chaveiro, esc: 2.3, ajusteY: 0.3 },
    { m: caneca, esc: 1.05, ajusteY: -0.5 }
  ].map((it, i) => {
    const suporte = new THREE.Group();
    const giro = new THREE.Group();
    it.m.scale.setScalar(it.esc);
    it.m.position.y = it.ajusteY;
    if (it.rotZ) giro.rotation.z = it.rotZ;
    giro.add(it.m);
    suporte.add(giro);
    suporte.visible = false;
    mundo.add(suporte);
    return Object.assign(it, { suporte, giro, ang: i * Math.PI / 2, spin: i * 1.3 });
  });

  // Estampa da caneca com a marca, e a frente do chaveiro já gravada
  fontesProntas().then(() => {
    caneca.userData.gravura.texto(['QBrindes', 'e presentes personalizados'], 'classica', 1, { cor: '#1408B8', tamanho: 0.4 });
    chaveiro.userData.gravura.texto(['Ana', '& Leo'], 'manuscrita', 1, { tamanho: 0.52, subir: 0.1, escala2: 0.72, margem: 0.2 });
    gravarTexto(progressoGravura, true);
    palco.marcar();
  });

  /* Laser */
  const laser = criarLaser({ faiscas: toque ? 40 : 70 });
  mundo.add(laser.grupo);
  let textoHero = ['Seu nome'];
  let fonteHero = 'manuscrita';
  let progressoGravura = 0, ultimaGravura = -1, brasa = 0, laserLigado = false;
  const frente = { u: 0.5, v: 0.5 };
  function gravarTexto(e, forcar) {
    const q = Math.round(e * 240) / 240;
    if (!forcar && q === ultimaGravura) return;
    ultimaGravura = q;
    const f = copo.userData.gravura.texto(textoHero, fonteHero, q, { tamanho: 0.46 });
    if (f) { frente.u = f.u; frente.v = f.v; }
  }
  document.addEventListener('qb:estudio', (ev) => {
    const est = ev.detail && ev.detail.estado;
    if (!est || (ev.detail.motivo !== 'texto' && ev.detail.motivo !== 'produto')) return;
    const linhas = [est.texto, est.texto2].map((s) => (s || '').trim()).filter(Boolean);
    textoHero = linhas.length ? linhas : ['Seu nome'];
    fonteHero = est.fonte || 'manuscrita';
    gravarTexto(progressoGravura, true);
    palco.marcar();
  });

  /* Confete na abertura da tampa */
  const N = toque ? 90 : 160;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.055, 0.1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), N);
  conf.frustumCulled = false;
  conf.visible = false;
  const cpos = new Float32Array(N * 3), cvel = new Float32Array(N * 3), crot = new Float32Array(N * 3), cvr = new Float32Array(N * 3);
  const paleta = [0xffc857, 0xffb21e, 0xffffff, 0x8f86ff, 0xff3dae, 0x38e1ff, 0x2a1bff];
  const cor = new THREE.Color();
  for (let i = 0; i < N; i++) conf.setColorAt(i, cor.setHex(paleta[i % paleta.length]));
  mundo.add(conf);
  let confVida = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _pp = new THREE.Vector3();
  function soltarConfete() {
    for (let i = 0; i < N; i++) {
      cpos[i * 3] = (Math.random() - 0.5) * 1.2; cpos[i * 3 + 1] = A + 0.2; cpos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      const a = Math.random() * Math.PI * 2, f = 0.6 + Math.random() * 1.6;
      cvel[i * 3] = Math.cos(a) * f; cvel[i * 3 + 1] = 3.4 + Math.random() * 2.8; cvel[i * 3 + 2] = Math.sin(a) * f;
      for (let k = 0; k < 3; k++) { crot[i * 3 + k] = Math.random() * 6.28; cvr[i * 3 + k] = (Math.random() - 0.5) * 12; }
    }
    confVida = 3.2;
    conf.visible = true;
    document.dispatchEvent(new CustomEvent('qb:confete'));
  }
  function atualizarConfete(dt) {
    if (confVida <= 0) { conf.visible = false; return false; }
    const s = dt / 1000;
    confVida -= s;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      cvel[j + 1] -= 5.2 * s;
      cvel[j] *= 0.985; cvel[j + 2] *= 0.985; cvel[j + 1] *= 0.992;
      cpos[j] += cvel[j] * s; cpos[j + 1] += cvel[j + 1] * s; cpos[j + 2] += cvel[j + 2] * s;
      crot[j] += cvr[j] * s; crot[j + 1] += cvr[j + 1] * s; crot[j + 2] += cvr[j + 2] * s;
      _pp.set(cpos[j], Math.max(0.02, cpos[j + 1]), cpos[j + 2]);
      const f = Math.min(1, confVida / 0.6);
      _s.setScalar(f);
      _m.compose(_pp, _q.setFromEuler(_e.set(crot[j], crot[j + 1], crot[j + 2])), _s);
      conf.setMatrixAt(i, _m);
    }
    conf.instanceMatrix.needsUpdate = true;
    return true;
  }

  /* Progresso da rolagem com amortecimento exponencial */
  let topo = 0, altura = 1, alturaPin = 1;
  function medir() {
    const r = secao.getBoundingClientRect();
    topo = r.top + window.scrollY;
    altura = secao.offsetHeight;
    alturaPin = host.offsetHeight;
  }
  medir();
  new ResizeObserver(() => { medir(); enquadrar(); }).observe(secao);
  const alvoP = () => limitar((window.scrollY - topo) / Math.max(1, altura - alturaPin));
  let p = alvoP();
  let etapa = -1;

  function enquadrar() {
    const w = palco.w;
    if (w < 761) palco.centralizar(0.5, 0.75);
    else if (w < 1021) palco.centralizar(0.64, 0.54);
    else palco.centralizar(0.68, 0.53);
  }
  palco.aoRedimensionar = enquadrar;
  enquadrar();

  /* Ponteiro: parallax leve */
  let px = 0, py = 0, mx = 0, my = 0;
  if (!toque) window.addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });

  // Sem montagem quando o 3D liga depois do pôster: começa do mesmo quadro que a imagem mostra.
  const t0 = performance.now() - (performance.now() > 1800 ? 4000 : 0);
  let ultimoRender = 0, introAnt = -1, barraAnt = -1, pAnterior = p;
  const camPos = new THREE.Vector3(), camAlvo = new THREE.Vector3(), alvoLaser = new THREE.Vector3(), normalLaser = new THREE.Vector3(), origemLaser = new THREE.Vector3();

  palco.tick = (dt, t) => {
    if (!ligado()) return false;
    const alvo = alvoP();
    const d = alvo - p;
    const tau = window.QBMotion && window.QBMotion.lenis ? 60 : 95;
    p = Math.abs(d) < 0.00005 ? alvo : p + d * (1 - Math.exp(-dt / tau));
    const montagem = limitar((t - t0) / 1700);
    const rapido = Math.abs(d) > 0.0003 || montagem < 1 || confVida > 0 || (progressoGravura > 0 && progressoGravura < 1) || brasa > 0.01;
    if (!rapido && t - ultimoRender < 33) return false; // ocioso: ~30 fps para a flutuação
    ultimoRender = t;
    const seg = t / 1000;

    /* Etapas, texto de abertura e barra */
    let n = 0;
    for (const lim of ETAPAS) if (p >= lim) n++;
    if (n !== etapa) {
      if (etapa !== -1) document.dispatchEvent(new CustomEvent('qb:etapa', { detail: n }));
      etapa = n;
      secao.dataset.step = String(n);
    }
    const sai = Math.round(suave(trecho(p, 0.03, 0.13)) * 1000) / 1000;
    if (sai !== introAnt) {
      introAnt = sai;
      intro.style.opacity = String(1 - sai);
      intro.style.transform = sai ? 'translateY(' + (-40 * sai).toFixed(1) + 'px)' : '';
      intro.style.visibility = sai >= 1 ? 'hidden' : '';
    }
    const bp = Math.round(p * 1000) / 1000;
    if (bp !== barraAnt) { barraAnt = bp; barra.style.transform = 'scaleX(' + bp + ')'; }

    /* Montagem inicial e flutuação */
    const m = saida(montagem);
    const pop = elastico(limitar((t - t0 - 700) / 1000));
    mundo.position.y = Math.sin(seg * Math.PI * 2 / 8) * 0.06 * (1 - trecho(p, 0.7, 0.8) * 0.6);
    mx += (px - mx) * 0.06; my += (py - my) * 0.06;
    mundo.rotation.y = mx * 0.22;
    mundo.rotation.x = my * 0.06;

    /* Caixa: giro, laço, tampa */
    const giro1 = suave(trecho(p, 0, 0.16));
    const giro2 = suave(trecho(p, 0.36, 0.82));
    const foco = suave(trecho(p, 0.72, 0.86));
    caixa.rotation.y = -0.62 + giro1 * 0.82 + giro2 * Math.PI * 0.5 + (1 - m) * -2.2;
    caixa.scale.setScalar((0.55 + 0.45 * m) * (1 - foco * 0.12));
    caixa.position.y = -(1 - m) * 1.2 - foco * 0.25;

    const l = suave(trecho(p, 0.14, 0.32));
    const sumir = suave(trecho(p, 0.14, 0.24)); // o laço se desfaz primeiro, depois as fitas recolhem
    P.laco.scale.setScalar(Math.max(0.0001, pop * (1 - sumir)));
    P.laco.position.y = AT / 2 + sumir * 0.35;
    P.laco.rotation.y = sumir * 1.8;
    P.laco.visible = sumir < 1;
    const recolhe = Math.max(0.0001, 1 - l);
    P.fitasTampa.scale.set(recolhe, 1, recolhe);
    P.fitasTampa.visible = l < 1;
    P.fitasCorpo.scale.set(recolhe, 1, recolhe);
    P.fitasCorpo.visible = l < 1;

    const tp = suave(trecho(p, 0.34, 0.55));
    P.tampa.position.set(tp * 2.1, tampaBaseY + tp * 2.7 + (1 - m) * 2.6, -tp * 0.7);
    P.tampa.rotation.set(-tp * 0.4, (1 - m) * 1.4, -tp * 0.6);
    P.tampa.visible = tp < 1;

    const luz = trecho(p, 0.36, 0.62);
    P.raios.material.opacity = luz * 0.5 * (1 - foco * 0.55) * (0.9 + 0.1 * Math.sin(seg * 3));
    P.raios.visible = luz > 0;
    P.raios.rotation.y = seg * 0.2;
    P.luzInterna.intensity = luz * 9 * (1 - foco * 0.4);
    halo.material.opacity = luz * 0.5;
    if (pAnterior < 0.4 && p >= 0.4) soltarConfete();
    pAnterior = p;

    /* Produtos em órbita */
    itens.forEach((it, i) => {
      const s = saida(trecho(p, 0.53 + i * 0.03, 0.7 + i * 0.03));
      it.suporte.visible = s > 0.001;
      if (!it.suporte.visible) return;
      const ang = it.ang + seg * 0.18 + p * 2.2;
      const ehCopo = i === 0;
      const R = lerp(0, 2.05, s) + (ehCopo ? 0 : foco * 0.35);
      let x = Math.sin(ang) * R, z = Math.cos(ang) * R;
      let y = lerp(A * 0.5, 2.15 + Math.sin(seg * 1.2 + i) * 0.08, s) + (ehCopo ? 0 : foco * 0.25);
      let esc = lerp(0.2, 1, s) * (ehCopo ? 1 + foco * 0.12 : 1 - foco * 0.55);
      if (ehCopo) {
        x = lerp(x, 0, foco); z = lerp(z, 1.1, foco); y = lerp(y, 1.85, foco);
      } else {
        z -= foco * 1.4;
      }
      it.suporte.position.set(x, y, z);
      it.suporte.scale.setScalar(esc);
      // Gira no próprio eixo; o copo para de frente no foco
      it.spin += dt * 0.0011 * (ehCopo ? 1 - foco : 1);
      const rotY = ehCopo ? lerp(it.spin, Math.round(it.spin / (Math.PI * 2)) * Math.PI * 2, foco) : it.spin;
      it.giro.rotation.y = rotY - mundo.rotation.y * (ehCopo ? foco : 0);
    });

    /* Câmera (no celular o objeto sobe para o meio quando o texto de abertura sai) */
    if (palco.w < 761) {
      const fy = Math.round(lerp(0.75, 0.46, suave(trecho(p, 0.03, 0.18))) * 200) / 200;
      if (fy !== palco.centro.y) palco.centralizar(0.5, fy);
    }
    const longe = palco.w < 761 ? 1.6 : 1;
    camPos.set(0, lerp(2.5, 2.25, foco), lerp(8.3, 6.9, foco) * longe);
    camAlvo.set(0, lerp(1.05, 1.7, foco), lerp(0, 0.6, foco));
    camera.position.copy(camPos);
    camera.lookAt(camAlvo);

    /* Gravação a laser no copo */
    const e = trecho(p, 0.76, 0.93);
    progressoGravura = e;
    gravarTexto(e, false);
    const gravando = e > 0 && e < 1 && itens[0].suporte.visible;
    brasa = gravando ? 1.5 : Math.max(0, brasa - dt * 0.0012);
    copo.userData.matGravura.emissiveIntensity = brasa;
    laser.ligar(gravando);
    if (gravando !== laserLigado) { laserLigado = gravando; document.dispatchEvent(new CustomEvent('qb:laser', { detail: { on: gravando } })); }
    if (gravando) {
      cena.updateMatrixWorld();
      copo.userData.alvo(frente.u, frente.v, alvoLaser, normalLaser);
      mundo.worldToLocal(alvoLaser);
      normalLaser.applyQuaternion(mundo.quaternion.clone().invert());
      origemLaser.set(alvoLaser.x * 0.4, alvoLaser.y + 2.6, alvoLaser.z + 0.9);
      laser.apontar(origemLaser, alvoLaser, normalLaser);
    }
    laser.atualizar(dt);
    atualizarConfete(dt);
    return true;
  };

  document.addEventListener('qb:motion', (ev) => {
    host.classList.toggle('palco3d--pronto', !!ev.detail);
    if (ev.detail) { medir(); introAnt = -1; barraAnt = -1; palco.marcar(); }
    else { intro.style.opacity = ''; intro.style.transform = ''; intro.style.visibility = ''; } // pausado: texto todo visível
  });

  // Primeiro quadro desenhado: esconde o pôster
  requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('palco3d--pronto')));
  palco.estado = () => ({ p, gravura: progressoGravura, etapa, brasa, confete: confVida });
  palco.marcar();
  return palco;
}
