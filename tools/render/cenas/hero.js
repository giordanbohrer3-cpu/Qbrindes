/* Hero em vídeo: o presente se abre sozinho em ~5,5 s.
   0–0,35 antecipação · 0,35–0,85 laço desata · 0,55–1,05 fita cai · 1,0–1,8 tampa sobe com luz e ouro
   1,8–3,0 produtos saem · 3,0–3,55 copo vem à frente · 3,55–4,45 laser grava "Seu nome" · 4,45–5,5 assenta.
   Tudo é função do tempo (exceto as faíscas do laser, que usam o Math.random com semente do harness). */
import * as THREE from 'three';
import { criarCaixa, criarCopo, criarCaneta, criarChaveiro, criarCaneca } from '/js/3d/modelos.js';
import { criarLaser } from '/js/3d/gravacao.js';
import { luzes, sombra, brilhoChao } from '/js/3d/base.js';
import { limitar, trecho, lerp, suave, mola, bezier, criarFundo, ambiente, brilho, criarPoOuro } from './comum.js';

const DUR = 5.5;
export const CUES = { antecipa: 0.0, laco: 0.35, fita: 0.55, tampa: 1.0, ouro: 1.05, produtos: 1.8, frente: 3.0, laser: 3.55, laserFim: 4.45, fim: DUR };

export async function criar({ renderer, W, H, formato, q }) {
  const movel = formato === 'm';
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  ambiente(renderer, scene, 0.75);
  const L = luzes(scene);
  L.chave.intensity = 2.3;
  L.hemi.intensity = 0.32;
  L.preench.intensity = 0.45;

  // Fundo: o centro do degradê acompanha onde o presente fica no quadro
  const CX = movel ? 0.5 : 0.72, CY = movel ? 0.47 : 0.5;
  const fundo = criarFundo({ cx: CX, cy: CY, raio: movel ? 0.78 : 0.7, aspecto: W / H });
  scene.add(fundo);
  renderer.getDrawingBufferSize(fundo.material.uniforms.uRes.value);

  const mundo = new THREE.Group();
  scene.add(mundo);
  const caixa = criarCaixa();
  mundo.add(caixa);
  const P = caixa.userData.partes, A = caixa.userData.A;
  const matFita = caixa.userData.materiais.fita;
  const chao = sombra(1.55, 0.62); chao.position.y = 0.003;
  const calorChao = brilhoChao(2.8, 0xffb54a, 0); calorChao.position.y = 0.006;
  mundo.add(chao, calorChao);
  const clarao = brilho(0xffc977, 3.2, 0); clarao.position.y = A + 0.35;
  const claraoNucleo = brilho(0xfff1d0, 1.1, 0); claraoNucleo.position.y = A + 0.12;
  mundo.add(clarao, claraoNucleo);

  /* Produtos */
  const copo = criarCopo({ cor: 0x1b1b21 });
  const caneta = criarCaneta({ cor: 0x1f15b8 });
  const chaveiro = criarChaveiro();
  const caneca = criarCaneca({ cor: 0xf6f4ef });
  caneca.userData.gravura.texto(['QBrindes', 'presentes com o seu nome'], 'classica', 1, { cor: '#1408B8', tamanho: 0.38 });
  chaveiro.userData.gravura.texto(['Ana', '& Leo'], 'manuscrita', 1, { tamanho: 0.4, subir: 0.12, escala2: 0.62, margem: 0.26 });
  copo.userData.gravura.texto(['Seu nome'], 'manuscrita', 0, { tamanho: 0.46 });

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Posições finais (PC: arco largo à direita do texto; celular: arco mais alto e estreito)
  const FINAL = movel ? {
    copo: V(0, 2.42, 1.15), caneta: V(-1.2, 3.05, -0.7), chaveiro: V(1.12, 3.25, -0.75), caneca: V(1.22, 1.72, -0.45)
  } : {
    copo: V(0, 2.36, 1.15), caneta: V(-1.42, 2.55, -0.65), chaveiro: V(1.22, 3.0, -0.7), caneca: V(1.36, 1.5, -0.4)
  };
  const itens = [
    { nome: 'copo', m: copo, esc: 0.86, centroY: 0.86, t0: 1.8 },
    { nome: 'caneta', m: caneta, esc: 1.3, centroY: 0.66, t0: 1.95, incl: 0.62 },
    { nome: 'chaveiro', m: chaveiro, esc: 1.75, centroY: -0.1, t0: 2.1 },
    { nome: 'caneca', m: caneca, esc: 0.95, centroY: 0.48, t0: 2.25 }
  ].map((it, i) => {
    const suporte = new THREE.Group();
    const giro = new THREE.Group();
    it.m.scale.setScalar(it.esc);
    it.m.position.y = -it.centroY * it.esc; // centro do produto no eixo do suporte
    giro.add(it.m);
    suporte.add(giro);
    suporte.visible = false;
    mundo.add(suporte);
    const fim = FINAL[it.nome];
    return Object.assign(it, {
      suporte, giro, fim,
      ini: V((i - 1.5) * 0.12, 0.35, (i % 2 ? -0.1 : 0.1)),
      meio: V(fim.x * 0.25, Math.max(fim.y, 2.2) + 0.7, fim.z * 0.2),
      fase: i * 1.7
    });
  });

  /* Pó de ouro que sai com a luz */
  const po = criarPoOuro({ n: 60, semente: 23, origem: V(0, A + 0.05, 0), espalho: 0.9, nasce: 1.05, janela: 0.45, subida: [1.5, 3.1], lateral: movel ? 0.9 : 1.15 });
  mundo.add(po.grupo);

  /* Laser */
  const laser = criarLaser({ faiscas: 90 });
  mundo.add(laser.grupo);
  const alvoL = V(0, 0, 0), normL = V(0, 0, 1), origL = V(0, 0, 0);
  let brasa = 0;

  const camera = new THREE.PerspectiveCamera(movel ? 30 : 25, W / H, 0.1, 80);
  // Desloca o centro óptico para o presente ficar à direita do texto no PC
  if (!movel) camera.setViewOffset(W, H, (0.5 - CX) * W, 0, W, H);
  const camPos = V(0, 0, 0), camAlvo = V(0, 0, 0), _p = V(0, 0, 0);
  const DIST = movel ? 1.0 : 1.0;

  function quadro(t, dt) {
    /* Câmera: leve subida no começo, aproximação no foco do copo e um quase nada de órbita */
    const sobe = suave(trecho(t, 0.9, 3.0));
    const foco = mola(t, 2.95, 1.4);
    const orbita = lerp(-0.06, 0.05, suave(trecho(t, 0, DUR)));
    const d0 = movel ? 9.4 : 9.9, d1 = movel ? 11.4 : 11.9, d2 = movel ? 11.0 : 11.3;
    const dist = lerp(lerp(d0, d1, sobe), d2, foco) * DIST;
    camAlvo.set(0, lerp(lerp(0.72, 1.62, sobe), movel ? 1.82 : 1.66, foco), lerp(0, 0.3, foco));
    camPos.set(Math.sin(orbita) * dist, lerp(lerp(2.2, 2.9, sobe), 2.75, foco), Math.cos(orbita) * dist);
    camera.position.copy(camPos);
    camera.lookAt(camAlvo);

    /* Caixa: antecipação discreta e giro muito lento */
    const ant = Math.sin(trecho(t, 0, 0.35) * Math.PI);
    caixa.rotation.y = -0.52 + suave(trecho(t, 0, DUR)) * 0.2;
    caixa.position.y = ant * 0.025;
    caixa.scale.set(1, 1 - ant * 0.012, 1);

    /* Laço desata: alças se abrem e somem para cima */
    const l = suave(trecho(t, 0.35, 0.85));
    P.laco.position.y = caixa.userData.topo + 0.008 + l * 0.32;
    P.laco.rotation.y = l * 0.9;
    P.esq.rotation.set(-0.22 - l * 0.4, -0.38 - l * 0.45, 0.12 + l * 0.85);
    P.dir.rotation.set(-0.22 - l * 0.4, 0.38 + l * 0.45, -0.12 - l * 0.85);
    P.esq.position.x = -l * 0.16; P.dir.position.x = l * 0.16;
    P.laco.scale.setScalar(Math.max(0.0001, 1 - l * 0.55));
    P.laco.visible = l < 1;
    P.pontaA.rotation.y = 0.5 + l * 0.5; P.pontaB.rotation.y = -0.5 - l * 0.5;

    /* Fita: os quatro braços tombam para fora, como pétalas, e somem */
    const f = suave(trecho(t, 0.55, 1.08));
    P.bracos.forEach((b) => { b.braco.rotation.x = f * 1.25; b.braco.position.y = -f * 0.05; });
    const opFita = 1 - suave(trecho(t, 0.62, 1.05));
    matFita.opacity = opFita;
    P.bracos.forEach((b) => { b.pivo.visible = f < 0.999; });
    // Laço some junto com a fita (mesmo material)

    /* Tampa sobe e sai do quadro, girando pouco */
    const tp = suave(trecho(t, 1.0, 1.85));
    const tampaY0 = caixa.userData.topo - caixa.userData.AT / 2;
    P.tampa.position.set(tp * 0.55, tampaY0 + tp * 3.6, -tp * 0.6);
    P.tampa.rotation.set(-tp * 0.45, tp * 0.35, -tp * 0.3);
    P.tampa.visible = tp < 1;

    /* Luz de dentro */
    const luz = suave(trecho(t, 0.98, 1.45));
    const calmo = 1 - 0.45 * mola(t, 3.0, 1.2);
    const pulso = 1 + 0.04 * Math.sin(t * 2.2);
    const estouro = Math.exp(-Math.pow((t - 1.25) / 0.22, 2)); // clarão breve na abertura, depois só a luz quente
    P.boca.material.opacity = trecho(t, 0.98, 1.06);
    P.raios.material.opacity = luz * 0.62 * calmo * pulso;
    P.raios.visible = luz > 0;
    P.raios.rotation.y = Math.atan2(camera.position.x, camera.position.z) - caixa.rotation.y;
    P.luzInterna.intensity = luz * 13 * calmo;
    clarao.material.opacity = luz * (0.3 + 0.25 * estouro) * calmo * pulso;
    claraoNucleo.material.opacity = luz * (0.28 + 0.4 * estouro) * calmo;
    calorChao.material.opacity = luz * 0.32 * calmo;
    fundo.material.uniforms.uCalor.value = luz * calmo;
    L.contraB.intensity = 18 + luz * 10;

    /* Ouro */
    po.atualizar(t);

    /* Produtos: sobem da caixa num arco e se espalham; o copo vem à frente e para de frente */
    for (const it of itens) {
      const k = mola(t, it.t0, 1.05);
      it.suporte.visible = t >= it.t0;
      if (!it.suporte.visible) continue;
      bezier(it.ini, it.meio, it.fim, k, _p);
      const flut = Math.sin(t * 1.1 + it.fase) * 0.035 * k;
      it.suporte.position.set(_p.x, _p.y + flut, _p.z);
      it.suporte.scale.setScalar(lerp(0.55, 1, k));
      if (it.nome === 'copo') {
        const fr = mola(t, 3.0, 0.6);
        it.suporte.position.lerp(_p.copy(it.fim).setY(it.fim.y + flut * 0.4), fr);
        it.suporte.position.z = lerp(lerp(it.ini.z, 0.15, k), it.fim.z, fr);
        // gira enquanto sobe e assenta exatamente de frente para a câmera
        const assenta = mola(t, 1.8, 1.8);
        it.giro.rotation.y = -Math.PI * 2.5 * (1 - assenta) + Math.atan2(camera.position.x, camera.position.z) * assenta;
      } else {
        // Giram pouco em volta da posição de frente: a marca e a gravação ficam legíveis
        const deFrente = Math.atan2(camera.position.x - it.suporte.position.x, camera.position.z - it.suporte.position.z);
        const vira = (1 - k) * Math.PI * 1.6;
        if (it.nome === 'caneta') { it.giro.rotation.y = deFrente + vira + Math.sin(t * 0.7 + it.fase) * 0.5; it.giro.rotation.z = it.incl * k; }
        if (it.nome === 'chaveiro') { it.giro.rotation.y = deFrente - 0.25 + vira + Math.sin(t * 0.8) * 0.35; it.giro.rotation.z = Math.sin(t * 1.3 + 1) * 0.05; }
        if (it.nome === 'caneca') it.giro.rotation.y = deFrente + 0.12 - vira + Math.sin(t * 0.6 + 2) * 0.16;
      }
    }

    /* Gravação a laser */
    const e = trecho(t, CUES.laser, CUES.laserFim);
    const fr = copo.userData.gravura.texto(['Seu nome'], 'manuscrita', e, { tamanho: 0.56, margem: 0.13 });
    const gravando = e > 0 && e < 1;
    brasa = gravando ? 1.6 : Math.max(0, brasa - dt * 1.4);
    copo.userData.matGravura.emissiveIntensity = brasa;
    laser.ligar(gravando);
    if (gravando && fr) {
      scene.updateMatrixWorld();
      copo.userData.alvo(fr.u, fr.v, alvoL, normL);
      mundo.worldToLocal(alvoL);
      origL.set(alvoL.x * 0.35 + 0.25, alvoL.y + 3.2, alvoL.z + 1.1);
      laser.apontar(origL, alvoL, normL);
    }
    laser.atualizar(dt * 1000);
    return null;
  }

  /* Chão de vitrine: o mundo espelhado por baixo, coberto por um véu com a cor do fundo que se fecha com a distância */
  const veu = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: Object.assign({}, fundo.material.uniforms, { uForca: { value: 0.2 } }),
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: fundo.material.fragmentShader
      .replace('void main(){', 'varying vec3 vP; uniform float uForca; void main(){')
      .replace('gl_FragColor = vec4(cor, 1.0);', 'float r = length(vP.xz * vec2(1.0, 1.35)); float a = 1.0 - uForca * exp(-r * r / 3.2); gl_FragColor = vec4(cor, a);')
  }));
  veu.rotation.x = -Math.PI / 2;
  veu.position.y = -0.001;
  const cenaVeu = new THREE.Scene();
  cenaVeu.add(veu);
  const cenaFundo = new THREE.Scene();
  scene.remove(fundo);
  cenaFundo.add(fundo);
  const RECORTE = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  function render() {
    renderer.autoClear = false;
    renderer.clear(true, true, true);
    renderer.render(cenaFundo, camera);
    if (q.espelho === '0') { renderer.render(scene, camera); return; }
    // reflexo: mundo espelhado em y, sem sombra de contato
    mundo.scale.y = -1; chao.visible = false; calorChao.visible = false;
    renderer.clippingPlanes = RECORTE;
    renderer.render(scene, camera);
    renderer.clippingPlanes = [];
    mundo.scale.y = 1; chao.visible = true; calorChao.visible = true;
    renderer.clearDepth();
    renderer.render(cenaVeu, camera);
    renderer.render(scene, camera);
  }

  return { scene, camera, dur: DUR, cues: CUES, quadro, render, meta: () => ({ centro: { x: CX, y: CY } }) };
}
