/* Vitrine 3D: um palco fixado e cinco capítulos amarrados à rolagem. */
import * as THREE from 'three';
import { criarPalco, luzes, sombra, brilhoChao, trecho, suave, saida, elastico, lerp, limitar, ligado, toque, paraTela, texturaBrilho } from './base.js';
import { criarCopo, criarCaneta, criarChaveiro, criarGarrafa, criarTaca } from './modelos.js';
import { criarLaser, fontesProntas } from './gravacao.js';

const CORES = [0xffb21e, 0x5a48ff, 0xff7aa0, 0x38e1ff, 0xff3dae];

export function iniciarVitrine(secao) {
  const host = secao.querySelector('#palco-vitrine');
  const rotulosEl = secao.querySelector('#rotulos-vitrine');
  const caps = Array.from(secao.querySelectorAll('.cap'));
  const nav = Array.from(secao.querySelectorAll('[data-ir-cap]'));
  const barra = secao.querySelector('.vitrine__progresso b');
  const palco = criarPalco(host, { fov: 30, exposicao: 1.12, ambiente: 0.85 });
  const { cena, camera } = palco;
  const L = luzes(cena);
  const PISO = -1.0;
  const chao = sombra(1.25, 0.6);
  chao.position.y = PISO + 0.002;
  const halo = brilhoChao(2.1, CORES[0], 0.3);
  halo.position.y = PISO + 0.004;
  cena.add(chao, halo);

  const laser = criarLaser({ faiscas: toque ? 40 : 70 });
  cena.add(laser.grupo);

  /* ---------- Modelos em suportes ---------- */
  function suporte(modelo, esc) {
    const s = new THREE.Group();
    const giro = new THREE.Group();
    modelo.scale.setScalar(esc);
    giro.add(modelo);
    s.add(giro);
    s.visible = false;
    cena.add(s);
    return { s, giro, m: modelo };
  }
  const copo = criarCopo({ cor: 0x17171c });
  const caneta = criarCaneta({ cor: 0x1b2a6b });
  const chaveiro = criarChaveiro();
  const garrafa = criarGarrafa();
  const taca = criarTaca({ cor: 0xc8102e });
  const S = [
    suporte(copo, 1.16),
    suporte(caneta, 1.9),
    suporte(chaveiro, 2.6),
    suporte(garrafa, 0.86),
    suporte(taca, 1.05)
  ];
  copo.position.y = PISO;
  garrafa.position.y = PISO;
  taca.position.y = PISO;
  caneta.position.y = -0.655 * 1.9; // centro da caneta no eixo do suporte (já escalada)
  S[1].giro.rotation.z = -0.62;
  S[2].s.position.y = 1.15;

  /* Gravações de cada capítulo */
  const textos = {
    copo: (k) => copo.userData.gravura.texto(['SEU LOGO', 'aqui'], 'moderna', k, { tamanho: 0.36 }),
    caneta: (k) => caneta.userData.gravura.texto(['Rafael Lima'], 'manuscrita', k, { tamanho: 0.62, margem: 0.06 }),
    frente: (k) => chaveiro.userData.gravura.texto(['Ana', '& Leo'], 'manuscrita', k, { tamanho: 0.52, subir: 0.1, escala2: 0.72, margem: 0.2 }),
    verso: (k) => chaveiro.userData.gravuraVerso.texto(['12.10.2026'], 'classica', k, { tamanho: 0.26, subir: 0.08, margem: 0.2 })
  };
  const cacheG = {};
  function gravar(nome, k) {
    const q = Math.round(k * 200) / 200;
    if (cacheG[nome] && cacheG[nome].q === q) return cacheG[nome].f;
    const f = textos[nome](q);
    cacheG[nome] = { q, f };
    return f;
  }
  fontesProntas().then(() => { Object.keys(cacheG).forEach((k) => delete cacheG[k]); palco.marcar(); });

  /* ---------- Partículas da garrafa: gelo e vapor ---------- */
  function particulas(n, cor, tam) {
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: tam, map: texturaBrilho(), color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false;
    const sem = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 2.2, y: Math.random() * 3, z: (Math.random() - 0.5) * 1.2, v: 0.3 + Math.random() * 0.5, f: Math.random() * 6.28 }));
    cena.add(pts);
    return { pts, pos, sem };
  }
  const gelo = particulas(70, 0xbdf3ff, 0.06);
  const vapor = particulas(40, 0xffffff, 0.42);

  /* ---------- Rótulos ---------- */
  const rotulos = [];
  function rotulo(cap, texto, obj, ancora, lado) {
    const el = document.createElement('div');
    el.className = 'rotulo' + (lado < 0 ? ' rotulo--esq' : '');
    el.innerHTML = '<b></b><i></i><span>' + texto + '</span>';
    rotulosEl.appendChild(el);
    const r = { cap, el, obj, ancora: new THREE.Vector3(...ancora), lado, on: false, x: -1, y: -1, janela: [0.3, 0.7] };
    rotulos.push(r);
    return r;
  }
  const P = copo.userData.partes;
  rotulo(0, 'Tampa rosqueável com bocal', P.tampa, [0.46, 1.6, 0], 1).janela = [0.28, 0.62];
  rotulo(0, 'Parede interna de inox', P.interna, [-0.42, 1.32, 0], -1).janela = [0.3, 0.62];
  rotulo(0, 'Parede dupla', P.corpo, [0.43, 0.8, 0], 1).janela = [0.32, 0.62];
  rotulo(0, 'Borracha antideslizante', P.borracha, [-0.37, 0.03, 0], -1).janela = [0.34, 0.62];
  rotulo(0, 'Gravação a laser', P.faixa, [0, 0.78, 0.45], 1).janela = [0.82, 0.98];
  rotulo(1, 'Nome gravado no corpo', caneta, [0, 0.4, 0.06], 1).janela = [0.5, 0.7];
  rotulo(1, 'Acionamento por rotação', caneta.userData.partes.superior, [0, 1.0, 0.05], -1).janela = [0.74, 0.95];
  rotulo(2, 'Frente: os nomes', chaveiro.userData.partes.coracao, [0.32, 0, 0], 1).janela = [0.3, 0.44];
  rotulo(2, 'Verso: a data', chaveiro.userData.partes.coracao, [-0.36, 0.12, 0], -1).janela = [0.82, 0.98];
  const PG = garrafa.userData.partes;
  rotulo(3, 'Tampa com alça', PG.tampa, [0.38, 0.2, 0], 1).janela = [0.22, 0.5];
  rotulo(3, 'Anel de silicone', PG.anel, [-0.37, 0, 0], -1).janela = [0.32, 0.55];
  rotulo(3, 'Canudo', PG.canudo, [0, 1.2, 0], 1).janela = [0.48, 0.72];
  rotulo(3, 'Parede dupla de inox', PG.corpo, [-0.445, 1.0, 0], -1).janela = [0.6, 0.92];
  const PT = taca.userData.partes;
  rotulo(4, 'Haste removível', PT.haste, [0.06, 0.4, 0], 1).janela = [0.4, 0.56];
  rotulo(4, 'Base antiderrapante', PT.base, [-0.4, 0.04, 0], -1).janela = [0.52, 0.7];
  rotulo(4, 'Agora é um copo', PT.bojo, [0.55, 1.4, 0], 1).janela = [0.76, 0.98];
  const _w = new THREE.Vector3();
  function atualizarRotulos(atual, cs) {
    const mostrar = palco.w > 760;
    for (const r of rotulos) {
      const k = trecho(cs[r.cap], 0.14, 0.86);
      const on = mostrar && r.cap === atual && k >= r.janela[0] && k <= r.janela[1] && S[r.cap].s.visible;
      if (on !== r.on) { r.on = on; r.el.classList.toggle('on', on); }
      if (!on) continue;
      _w.copy(r.ancora);
      r.obj.localToWorld(_w);
      const t = paraTela(palco, _w);
      const x = Math.round(t.x), y = Math.round(t.y);
      if (x !== r.x || y !== r.y) {
        r.x = x; r.y = y;
        r.el.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(' + (r.lado < 0 ? '-100%' : '0') + ',-50%)';
      }
    }
  }

  /* ---------- Rolagem ---------- */
  let topo = 0, altura = 1;
  function medir() { topo = secao.getBoundingClientRect().top + window.scrollY; altura = secao.offsetHeight; }
  medir();
  new ResizeObserver(() => { medir(); enquadrar(); }).observe(secao);
  const alvoP = () => limitar((window.scrollY - topo) / Math.max(1, altura - innerHeight), -0.25, 1.25);
  let p = alvoP();
  let capAtual = -1;
  function enquadrar() {
    if (palco.w < 761) palco.centralizar(0.5, 0.33);
    else if (palco.w < 1021) palco.centralizar(0.7, 0.5);
    else palco.centralizar(0.68, 0.5);
  }
  palco.aoRedimensionar = enquadrar;
  enquadrar();

  nav.forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.irCap);
    const y = topo + (i + 0.5) / 5 * (altura - innerHeight);
    if (window.QBMotion && window.QBMotion.lenis) window.QBMotion.lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }));

  const corHalo = new THREE.Color(CORES[0]), corAlvo = new THREE.Color();
  const alvoL = new THREE.Vector3(), normL = new THREE.Vector3(), origL = new THREE.Vector3();
  const corTaca = [new THREE.Color(0xc8102e), new THREE.Color(0x141418), new THREE.Color(0xf2f2f0), new THREE.Color(0xc8102e)];
  const _c = new THREE.Color();
  let ultimoRender = 0, barraAnt = -1, laserLigado = false;

  palco.tick = (dt, t) => {
    if (!ligado()) return false;
    const alvo = alvoP();
    const d = alvo - p;
    const tau = window.QBMotion && window.QBMotion.lenis ? 60 : 95;
    p = Math.abs(d) < 0.00005 ? alvo : p + d * (1 - Math.exp(-dt / tau));
    const rapido = Math.abs(d) > 0.0003;
    if (!rapido && t - ultimoRender < 33) return false;
    ultimoRender = t;
    const seg = t / 1000;

    const cs = [0, 1, 2, 3, 4].map((i) => p * 5 - i);
    const atual = Math.max(0, Math.min(4, Math.floor(limitar(p, 0, 0.9999) * 5)));
    if (atual !== capAtual) {
      capAtual = atual;
      secao.dataset.cap = String(atual);
      caps.forEach((c, i) => c.classList.toggle('ativo', i === atual));
      nav.forEach((b, i) => b.setAttribute('aria-current', String(i === atual)));
      document.dispatchEvent(new CustomEvent('qb:etapa', { detail: atual }));
    }
    const bp = Math.round(limitar(p) * 1000) / 1000;
    if (bp !== barraAnt) { barraAnt = bp; barra.style.transform = 'scaleX(' + bp + ')'; }

    // Cor da luz de contra e do halo segue o capítulo
    corAlvo.setHex(CORES[atual]);
    corHalo.lerp(corAlvo, 1 - Math.exp(-dt / 220));
    halo.material.color.copy(corHalo);
    L.contraA.color.copy(corHalo);
    L.contraA.intensity = atual === 4 ? 46 : 26;

    let laserAlvo = null;

    S.forEach((sp, i) => {
      const c = cs[i];
      const ent = i === 0 ? saida(trecho(c, -0.75, -0.05)) : saida(trecho(c, -0.14, 0.14));
      const sai = i === 4 ? suave(trecho(c, 0.95, 1.25)) : suave(trecho(c, 0.86, 1.1));
      sp.s.visible = ent > 0.001 && sai < 0.999;
      if (!sp.s.visible) return;
      const k = trecho(c, 0.14, 0.86);
      const balanco = Math.sin(seg * 0.9 + i) * 0.06;

      if (i === 0) { /* COPO: gira, abre em camadas, fecha e recebe o logo */
        sp.s.position.set(lerp(2.6, 0, ent) - sai * 2.6, lerp(-0.6, 0, ent) + sai * 0.4, 0);
        sp.s.rotation.set(0, 0, lerp(-0.25, 0, ent));
        sp.s.scale.setScalar(lerp(0.65, 1, ent) * (1 - sai * 0.35));
        sp.giro.rotation.y = -0.35 + (1 - ent) * 2.4 + suave(trecho(k, 0, 0.25)) * Math.PI * 2 + balanco;
        const abre = suave(trecho(k, 0.25, 0.42)) * (1 - suave(trecho(k, 0.62, 0.74)));
        P.tampa.position.y = abre * 0.62;
        P.tampa.rotation.z = abre * 0.12;
        P.interna.position.y = abre * 0.42;
        copo.userData.partes.aro.position.y = 1.405 + abre * 0.42;
        P.borracha.position.y = -abre * 0.42;
        P.corpo.rotation.y = abre * 0.3;
        const g = trecho(k, 0.76, 0.94);
        const f = gravar('copo', g);
        copo.userData.matGravura.emissiveIntensity = g > 0 && g < 1 ? 1.2 : Math.max(0, copo.userData.matGravura.emissiveIntensity - dt * 0.002);
        if (g > 0 && g < 1 && f) laserAlvo = { m: copo, u: f.u, v: f.v };
      }

      if (i === 1) { /* CANETA: entra na diagonal girando, laser grava o nome, gira para abrir */
        const dirX = Math.sin(0.62), dirY = Math.cos(0.62);
        const vem = (1 - ent) * 4 - sai * 4;
        sp.s.position.set(-vem * dirX, -vem * dirY, 0);
        sp.s.scale.setScalar(1 - sai * 0.3);
        sp.giro.rotation.y = (1 - ent) * Math.PI * 4 + (1 - suave(trecho(k, 0, 0.22))) * Math.PI * 2 + sai * Math.PI * 3;
        sp.giro.rotation.x = balanco * 0.5;
        const g = trecho(k, 0.24, 0.6);
        const f = gravar('caneta', g);
        caneta.userData.matGravura.emissiveIntensity = g > 0 && g < 1 ? 1.4 : Math.max(0, caneta.userData.matGravura.emissiveIntensity - dt * 0.002);
        if (g > 0 && g < 1 && f) laserAlvo = { m: caneta, u: f.u, v: f.v };
        const tw = suave(trecho(k, 0.66, 0.86));
        caneta.userData.partes.superior.rotation.y = tw * Math.PI;
        caneta.userData.partes.refil.position.y = 0.03 - tw * 0.055;
      }

      if (i === 2) { /* CHAVEIRO: cai balançando, grava a frente, vira como moeda, grava o verso */
        const queda = elastico(ent);
        sp.s.position.set(0, 1.15 + (1 - queda) * 3.2 + sai * 3, 0);
        sp.s.rotation.z = Math.sin(seg * 1.6) * 0.05 + (1 - ent) * 0.5 * Math.sin(seg * 6);
        sp.s.scale.setScalar(1 - sai * 0.3);
        const vira = suave(trecho(k, 0.44, 0.62));
        sp.giro.rotation.y = -0.18 + vira * Math.PI + balanco + sai * Math.PI;
        const gf = trecho(k, 0.08, 0.36);
        const ff = gravar('frente', gf);
        const gv = trecho(k, 0.64, 0.86);
        const fv = gravar('verso', gv);
        chaveiro.userData.matGravura.emissiveIntensity = gf > 0 && gf < 1 ? 1.3 : Math.max(0, chaveiro.userData.matGravura.emissiveIntensity - dt * 0.002);
        chaveiro.userData.matVerso.emissiveIntensity = gv > 0 && gv < 1 ? 1.3 : Math.max(0, chaveiro.userData.matVerso.emissiveIntensity - dt * 0.002);
        if (gf > 0 && gf < 1 && ff) laserAlvo = { m: chaveiro, u: ff.u, v: ff.v, lado: 1 };
        if (gv > 0 && gv < 1 && fv) laserAlvo = { m: chaveiro, u: fv.u, v: fv.v, lado: -1 };
      }

      if (i === 3) { /* GARRAFA: abre a tampa, mostra o anel, sobe o canudo, gelado e quente */
        sp.s.position.set(lerp(0, 0, ent) - sai * 2.4, lerp(-2.6, 0, ent) + sai * 0.6, 0);
        sp.s.scale.setScalar(lerp(0.7, 1, ent) * (1 - sai * 0.3));
        sp.giro.rotation.y = -0.5 + (1 - ent) * 3 + balanco + k * 0.6;
        const ab = suave(trecho(k, 0.12, 0.34)) * (1 - suave(trecho(k, 0.92, 1)));
        PG.tampa.rotation.y = -ab * Math.PI * 3;
        PG.tampa.position.y = 2.135 + ab * 0.55;
        PG.tampa.rotation.x = -ab * 0.22;
        garrafa.userData.matAnel.emissiveIntensity = trecho(k, 0.3, 0.42) * (1 - trecho(k, 0.5, 0.6)) * 1.2;
        const can = suave(trecho(k, 0.4, 0.56)) * (1 - suave(trecho(k, 0.9, 1)));
        PG.canudo.position.y = 1.15 + can * 0.85;
        const frio = trecho(k, 0.56, 0.62) * (1 - trecho(k, 0.72, 0.76));
        const quente = trecho(k, 0.76, 0.8) * (1 - trecho(k, 0.94, 1));
        L.contraB.color.setHex(quente > frio ? 0xff8a3d : 0x38e1ff);
        // gelo cai em volta, vapor sobe do bocal
        gelo.pts.material.opacity = frio * 0.9;
        vapor.pts.material.opacity = quente * 0.28;
        if (frio > 0) gelo.sem.forEach((q, j) => { const yy = ((q.y - seg * q.v) % 3 + 3) % 3; gelo.pos.set([q.x + Math.sin(seg + q.f) * 0.05, PISO + yy, q.z + 0.4], j * 3); });
        if (quente > 0) vapor.sem.forEach((q, j) => { const yy = (q.y * 0.4 + seg * q.v * 0.35) % 1.2; vapor.pos.set([q.x * 0.18 + Math.sin(seg * 1.4 + q.f) * 0.12 * yy, PISO + 2.2 * 0.86 + 0.35 + yy, q.z * 0.2], j * 3); });
        gelo.pts.geometry.attributes.position.needsUpdate = frio > 0;
        vapor.pts.geometry.attributes.position.needsUpdate = quente > 0;
        gelo.pts.visible = frio > 0; vapor.pts.visible = quente > 0;
      } else if (i !== 3 && atual !== 3) { gelo.pts.visible = false; vapor.pts.visible = false; }

      if (i === 4) { /* TAÇA: troca de cor, desmonta e vira copo */
        sp.s.position.set(lerp(2.8, 0, ent) + sai * 2.4, 0, 0);
        sp.s.scale.setScalar(lerp(0.7, 1, ent));
        sp.giro.rotation.y = (1 - ent) * -2.6 + balanco + k * 0.5;
        const cc = trecho(k, 0, 0.3) * 3;
        const ci = Math.min(2, Math.floor(cc));
        _c.copy(corTaca[ci]).lerp(corTaca[ci + 1], suave(cc - ci));
        taca.userData.matCor.color.copy(_c);
        const a = suave(trecho(k, 0.34, 0.48));
        const b = suave(trecho(k, 0.48, 0.62));
        const c3 = suave(trecho(k, 0.62, 0.76));
        PT.haste.position.set(a * 0.75 + b * 1.4, 0.51 - a * 0.3, 0);
        PT.haste.scale.setScalar(Math.max(0.0001, 1 - b));
        PT.haste.visible = b < 1;
        const baseSolta = new THREE.Vector3(a * 0.75, -a * 0.3, 0);
        const baseEncaixe = new THREE.Vector3(0, 0.94 - 0.084, 0);
        PT.base.position.lerpVectors(baseSolta, baseEncaixe, b);
        PT.base.position.y -= c3 * 0.856;
        PT.bojo.position.y = -c3 * 0.856;
      }
    });

    /* Laser compartilhado */
    if (laserAlvo) {
      cena.updateMatrixWorld();
      laserAlvo.m.userData.alvo(laserAlvo.u, laserAlvo.v, alvoL, normL, laserAlvo.lado);
      origL.set(alvoL.x * 0.3 + normL.x * 0.9, alvoL.y + 2.6, alvoL.z + normL.z * 1.4 + 0.4);
      laser.apontar(origL, alvoL, normL);
      laser.ligar(true);
    } else laser.ligar(false);
    laser.atualizar(dt);
    if (!!laserAlvo !== laserLigado) { laserLigado = !!laserAlvo; document.dispatchEvent(new CustomEvent('qb:laser', { detail: { on: laserLigado } })); }

    camera.position.set(0, 0.35, palco.w < 761 ? 11.8 : 7.9);
    camera.lookAt(0, 0.15, 0);
    cena.updateMatrixWorld();
    atualizarRotulos(atual, cs);
    return true;
  };

  document.addEventListener('qb:motion', () => { medir(); palco.marcar(); });
  requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('palco3d--pronto')));
  palco.marcar();
  return palco;
}
