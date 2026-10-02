/* Peças comuns das cenas do render: tempo, molas, fundo em espaço de tela, ambiente e pó de ouro. */
import * as THREE from 'three';

export const limitar = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const trecho = (t, a, b) => limitar((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
// Smootherstep: começa e termina com velocidade e aceleração zero
export const suave = (k) => { k = limitar(k); return k * k * k * (k * (k * 6 - 15) + 10); };
// Mola criticamente amortecida (sem ultrapassar o alvo), normalizada para chegar a 1 em "dur"
const W_MOLA = 7;
const FIM_MOLA = 1 - (1 + W_MOLA) * Math.exp(-W_MOLA);
export function mola(t, t0, dur) {
  const x = limitar((t - t0) / dur) * W_MOLA;
  return limitar((1 - (1 + x) * Math.exp(-x)) / FIM_MOLA);
}
export function bezier(a, b, c, k, alvo) {
  const u = 1 - k;
  return alvo.set(
    u * u * a.x + 2 * u * k * b.x + k * k * c.x,
    u * u * a.y + 2 * u * k * b.y + k * k * c.y,
    u * u * a.z + 2 * u * k * b.z + k * k * c.z
  );
}

/* Gerador com semente própria (cada sistema de partículas é independente da ordem de criação) */
export function aleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Fundo desenhado em espaço de tela (independe da câmera): degradê radial da marca até a cor da borda,
   com um calor dourado que acende quando a caixa abre. Sai em sRGB direto, com pontilhado contra faixas. */
export function criarFundo({ borda = 0x0b0733, centro = 0x1d1391, quente = 0xffb54a, cx = 0.5, cy = 0.5, raio = 0.62, aspecto = 1 } = {}) {
  const c = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: {
      uBorda: { value: c(borda) }, uCentro: { value: c(centro) }, uQuente: { value: c(quente) },
      uC: { value: new THREE.Vector2(cx, cy) }, uR: { value: raio }, uAsp: { value: aspecto },
      uCalor: { value: 0 }, uCalorC: { value: new THREE.Vector2(cx, cy) }, uRes: { value: new THREE.Vector2(1, 1) }
    },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform vec3 uBorda, uCentro, uQuente; uniform vec2 uC, uCalorC, uRes; uniform float uR, uAsp, uCalor;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 d = (uv - uC) * vec2(uAsp, 1.0);
        float k = smoothstep(0.0, 1.0, clamp(length(d) / uR, 0.0, 1.0));
        vec3 cor = mix(uCentro, uBorda, k);
        vec2 dq = (uv - uCalorC) * vec2(uAsp, 1.0);
        cor += uQuente * uCalor * 0.16 * exp(-dot(dq, dq) * 9.0);
        cor += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(cor, 1.0);
      }`
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.renderOrder = -100;
  return m;
}

export function ambiente(renderer, cena, intensidade = 0.8) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const sala = new THREE.RoomEnvironment();
  cena.environment = pmrem.fromScene(sala, 0.04).texture;
  cena.environmentIntensity = intensidade;
  pmrem.dispose();
}

let _brilho = null;
export function texBrilho() {
  if (_brilho) return _brilho;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,.6)');
  gr.addColorStop(0.5, 'rgba(255,255,255,.16)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _brilho = new THREE.CanvasTexture(c);
  _brilho.colorSpace = THREE.SRGBColorSpace;
  return _brilho;
}
export function brilho(cor, tamanho, opacidade = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: cor, transparent: true, opacity: opacidade, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.set(tamanho, tamanho, 1);
  return s;
}

/* Pó e folhas de ouro: movimento analítico (função pura do tempo), com arrasto e gravidade leves.
   Cada partícula nasce em "nasce" a partir de "origem" e flutua devagar; folhas giram e pegam a luz. */
export function criarPoOuro({ n = 54, semente = 11, origem = new THREE.Vector3(), espalho = 0.7, nasce = 1.05, janela = 0.35, subida = [2.0, 3.6], lateral = 1.3, g = 0.42, arrasto = 1.5 } = {}) {
  const r = aleatorio(semente);
  const grupo = new THREE.Group();
  const folhaGeo = new THREE.PlaneGeometry(0.032, 0.022);
  const matFolha = new THREE.MeshStandardMaterial({ color: 0xf0c060, metalness: 1, roughness: 0.28, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  const folhas = new THREE.InstancedMesh(folhaGeo, matFolha, n);
  folhas.frustumCulled = false;
  const cores = [0xffb21e, 0xf3d9a4, 0xfff4dc];
  const glows = [];
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const f = lateral * (0.25 + r() * 0.75);
    P.push({
      t0: nasce + r() * janela,
      p0: new THREE.Vector3(origem.x + (r() - 0.5) * espalho, origem.y, origem.z + (r() - 0.5) * espalho),
      v0: new THREE.Vector3(Math.cos(a) * f, lerp(subida[0], subida[1], r()), Math.sin(a) * f * 0.8),
      rot0: new THREE.Euler(r() * 6.3, r() * 6.3, r() * 6.3),
      rotV: new THREE.Vector3((r() - 0.5) * 5, (r() - 0.5) * 5, (r() - 0.5) * 5),
      osc: r() * 6.3, esc: 0.55 + r() * 0.9
    });
    if (i % 3 !== 2) {
      const s = brilho(cores[i % 3], 0.1 + r() * 0.12, 0);
      grupo.add(s);
      glows.push({ s, i, op: 0.35 + r() * 0.4 });
    }
  }
  grupo.add(folhas);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), pos = [];
  for (let i = 0; i < n; i++) pos.push(new THREE.Vector3());
  return {
    grupo,
    atualizar(t) {
      for (let i = 0; i < n; i++) {
        const p = P[i], tau = t - p.t0, o = pos[i];
        if (tau <= 0) { _s.setScalar(0.0001); o.set(0, -99, 0); }
        else {
          const k = arrasto, e = 1 - Math.exp(-k * tau);
          o.x = p.p0.x + p.v0.x * e / k + Math.sin(tau * 1.3 + p.osc) * 0.06 * Math.min(1, tau);
          o.z = p.p0.z + p.v0.z * e / k;
          o.y = p.p0.y + (p.v0.y + g / k) * e / k - (g / k) * tau;
          const nasc = Math.min(1, tau / 0.18);
          _s.setScalar(p.esc * nasc);
        }
        _e.set(p.rot0.x + p.rotV.x * Math.max(0, tau), p.rot0.y + p.rotV.y * Math.max(0, tau), p.rot0.z + p.rotV.z * Math.max(0, tau));
        _m.compose(o, _q.setFromEuler(_e), _s);
        folhas.setMatrixAt(i, _m);
      }
      folhas.instanceMatrix.needsUpdate = true;
      for (const gw of glows) {
        const p = P[gw.i], tau = t - p.t0;
        gw.s.position.copy(pos[gw.i]);
        // cintila devagar, como poeira pegando a luz
        gw.s.material.opacity = tau <= 0 ? 0 : gw.op * Math.min(1, tau / 0.25) * (0.55 + 0.45 * Math.sin(tau * 3.1 + p.osc));
      }
    }
  };
}
