/* QBrindes — folhas de ouro que saem do presente (canvas 2D, sem dependências).
   Cada folha gira no plano e vira em 3D: a altura desenhada é |cos φ| e o tom segue o ângulo
   (o lado escuro reflete o azul da sala; perto da boca da caixa a folha pega a luz e cintila).
   Dois planos: o de trás passa atrás do cartão (e do título, no celular); o da frente, na frente.
   Uma rajada só, ~3,5 s; depois os canvases são liberados (width = 0). */
(function () {
  'use strict';

  // Só metais da marca (nada de neon): [cor base, peso]
  const METAIS = [['#FFB21E', 26], ['#E9C77B', 30], ['#F3D9A4', 20], ['#B9822A', 14], ['#FFF4DC', 10]];
  const SALA = [26, 16, 64]; // #1A1040: o lado de sombra reflete o azul do ambiente
  const BRILHO = 'rgb(255,248,232)';
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, k) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')';
  // Rampa de 12 tons por metal, montada uma vez: 0–5 sombra → base, 6–9 base → claro, 10–11 brilho
  const RAMPAS = METAIS.map(([h]) => {
    const base = hex(h), sombra = base.map((v, i) => v + (SALA[i] - v) * 0.62), claro = base.map((v) => v + (255 - v) * 0.55);
    const r = [];
    for (let i = 0; i < 6; i++) r.push(mix(sombra, base, i / 5));
    for (let i = 1; i <= 4; i++) r.push(mix(base, claro, i / 4));
    r.push(BRILHO, BRILHO);
    return r;
  });
  const PESO = METAIS.reduce((s, m) => s + m[1], 0);

  let semente = 1;
  const acaso = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  const entre = (a, b) => a + (b - a) * acaso();
  function metal() { let r = acaso() * PESO; for (let i = 0; i < METAIS.length; i++) { if ((r -= METAIS[i][1]) <= 0) return i; } return 0; }
  const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const planos = {};
  let pecas = [], po = [], raf = 0, antes = 0, t = 0, dpr = 1, cfg = null, aoFim = null;

  function canvas(nome, pai, z) {
    let c = planos[nome];
    if (!c) {
      c = planos[nome] = document.createElement('canvas');
      c.className = 'confete confete--' + nome;
      c.setAttribute('aria-hidden', 'true');
    }
    if (c.parentNode !== pai) pai.appendChild(c);
    c.style.zIndex = z;
    return c;
  }

  /* o: { pai, area: {x, y, w, h} (px no pai), boca: {x, y}, larguraBoca, altura (px de referência), escala,
          quantidade, poeira, zAtras, zFrente, esmaecerX (px: folhas somem à esquerda disso),
          esmaecerFrenteY (px: folhas da frente somem acima disso), semente } */
  // Cria, posiciona e dimensiona os canvases antes da rajada (escondidos), fora do quadro em que ela começa
  function preparar(o) {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    for (const [nome, z] of [['atras', o.zAtras], ['frente', o.zFrente]]) {
      const c = canvas(nome, o.pai, z);
      c.style.left = o.area.x + 'px'; c.style.top = o.area.y + 'px';
      c.style.width = o.area.w + 'px'; c.style.height = o.area.h + 'px';
      const w = Math.round(o.area.w * dpr), h = Math.round(o.area.h * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      c.getContext('2d').clearRect(0, 0, w, h); // inicia o contexto aqui, não no primeiro quadro da rajada
    }
  }

  function estourar(o) {
    parar();
    cfg = o;
    semente = o.semente || 11;
    preparar(o);
    for (const c of Object.values(planos)) c.hidden = false;
    const H = o.altura, F = o.larguraBoca, E = o.escala || 1; // E: tamanho das folhas na escala da cena
    const bx = o.boca.x - o.area.x, by = o.boca.y - o.area.y; // origem no espaço do canvas
    for (let i = 0; i < o.quantidade; i++) {
      const r = acaso();
      const forma = r < 0.5 ? 'fita' : r < 0.85 ? 'lasca' : 'lantejoula';
      const zr = acaso();
      const z = zr < 0.25 ? 0.65 : zr < 0.85 ? 1 : 1.3;
      const lateral = acaso() < 0.12;
      const ang = -Math.PI / 2 + (lateral ? (acaso() < 0.5 ? -1 : 1) * 0.96 : (acaso() + acaso() - 1) * 0.52);
      const v = H * entre(0.85, 1.25) * (lateral ? 0.6 : 1) * (forma === 'lasca' ? 0.9 : 1) * (0.85 + 0.15 * z);
      const p = {
        forma, z, plano: z > 1 ? 'frente' : 'atras', metal: metal(),
        x: bx + entre(-0.42, 0.42) * F, y: by - 2, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
        giro: entre(0, Math.PI * 2), vGiro: entre(-4, 4),
        vira: entre(0, Math.PI * 2), vVira: (forma === 'lasca' ? entre(4, 9) : entre(7, 15)) * (acaso() < 0.5 ? -1 : 1),
        fase: entre(0, Math.PI * 2), w: entre(2.5, 5) * Math.PI, // ω do balanço
        a: entre(4, 14) * z * E, espera: entre(0, 0.14), vida: 0, max: entre(2.6, 3.4)
      };
      if (forma === 'fita') { p.lw = entre(2.6, 3.6) * z * E; p.lh = entre(8, 13) * z * E; }
      else if (forma === 'lantejoula') { p.lw = entre(1.8, 2.6) * z * E; }
      else { // lasca: polígono irregular de 5 vértices, montado uma vez
        const raio = entre(3, 6) * z * E, path = new Path2D();
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + entre(-0.35, 0.35), rr = raio * entre(0.6, 1.1);
          if (k) path.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else path.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        path.closePath(); p.path = path;
      }
      pecas.push(p);
    }
    for (let i = 0; i < (o.poeira || 0); i++) {
      const ang = -Math.PI / 2 + (acaso() + acaso() - 1) * 0.6, v = H * entre(0.5, 0.95);
      po.push({ x: bx + entre(-0.3, 0.3) * F, y: by - 2, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: entre(0.8, 1.5), fase: entre(0, 6.3), espera: entre(0, 0.2), vida: 0, max: entre(1.8, 2.8) });
    }
    t = 0; antes = performance.now();
    raf = requestAnimationFrame(passo);
    return new Promise((ok) => { aoFim = ok; });
  }

  function passo(agora) {
    const dt = Math.min(1 / 30, (agora - antes) / 1000);
    antes = agora; t += dt;
    const H = cfg.altura, F = cfg.larguraBoca, g = 0.82 * H;
    const bx = cfg.boca.x - cfg.area.x, by = cfg.boca.y - cfg.area.y;
    const ex = cfg.esmaecerX == null ? -1e9 : cfg.esmaecerX - cfg.area.x;
    const ey = cfg.esmaecerFrenteY == null ? -1e9 : cfg.esmaecerFrenteY - cfg.area.y;
    const ctx = { atras: planos.atras.getContext('2d'), frente: planos.frente.getContext('2d') };
    for (const c of Object.values(ctx)) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, c.canvas.width, c.canvas.height); }
    let vivas = 0;
    for (const p of pecas) {
      if (p.espera > 0) { p.espera -= dt; vivas++; continue; }
      p.vida += dt;
      if (p.vida > p.max || p.y > cfg.area.h + 30) continue;
      vivas++;
      const face = Math.abs(Math.cos(p.vira));
      // Arrasto linear: de frente a folha freia mais (cai devagar, rodopiando); de perfil, despenca
      p.vx += (-1.7 * p.vx) * dt;
      p.vy += (g - 2.3 * (0.7 + 0.6 * face) * p.vy) * dt;
      p.x += (p.vx + Math.cos(p.fase + p.w * p.vida) * p.a * p.w * 0.35) * dt;
      p.y += p.vy * dt;
      p.giro += p.vGiro * dt; p.vira += p.vVira * dt;
      // Tom: |cos φ| percorre a rampa; perto da boca, a luz da caixa sobe até 2 tons e faz cintilar
      const perto = Math.max(0, 1 - Math.hypot(p.x - bx, p.y - by) / (1.2 * F)) * (p.vida < 0.9 ? 1 : 0);
      let tom = Math.min(9, Math.round(face * 9 + perto * 2));
      if (perto > 0.2 && face > 0.96) tom = 10;
      let alfa = (p.z < 1 ? 0.7 : 1) * Math.min(1, (p.max - p.vida) / 0.45) * suave(ex, ex + 80, p.x);
      if (p.plano === 'frente') alfa *= suave(ey - 40, ey + 40, p.y);
      if (alfa <= 0.01) continue;
      const c = ctx[p.plano];
      c.globalAlpha = alfa;
      c.fillStyle = RAMPAS[p.metal][tom];
      const cg = Math.cos(p.giro), sg = Math.sin(p.giro), sy = Math.max(0.06, face);
      c.setTransform(cg * dpr, sg * dpr, -sg * sy * dpr, cg * sy * dpr, p.x * dpr, p.y * dpr);
      if (p.forma === 'fita') c.fillRect(-p.lw / 2, -p.lh / 2, p.lw, p.lh);
      else if (p.forma === 'lasca') c.fill(p.path);
      else { c.beginPath(); c.arc(0, 0, p.lw, 0, Math.PI * 2); c.fill(); }
    }
    // Pó: grãos que somam luz e piscam, continuando o pó de ouro do vídeo
    const ca = ctx.atras;
    ca.globalCompositeOperation = 'lighter';
    ca.fillStyle = 'rgb(255,214,140)';
    for (const q of po) {
      if (q.espera > 0) { q.espera -= dt; vivas++; continue; }
      q.vida += dt;
      if (q.vida > q.max) continue;
      vivas++;
      q.vx += -2 * q.vx * dt; q.vy += (g * 0.5 - 2 * q.vy) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      const alfa = (0.4 + 0.6 * Math.sin(q.fase + 9 * q.vida)) * Math.min(1, (q.max - q.vida) / 0.45) * suave(ex, ex + 80, q.x);
      if (alfa <= 0.01) continue;
      ca.globalAlpha = alfa;
      ca.setTransform(dpr, 0, 0, dpr, q.x * dpr, q.y * dpr);
      ca.beginPath(); ca.arc(0, 0, q.r, 0, Math.PI * 2); ca.fill();
    }
    if (vivas) raf = requestAnimationFrame(passo);
    else terminar();
  }

  function terminar() {
    raf = 0; pecas = []; po = [];
    for (const c of Object.values(planos)) { c.width = c.height = 0; c.hidden = true; } // devolve a memória
    if (aoFim) { const f = aoFim; aoFim = null; f(); }
  }

  // parar: interrompe uma rajada em curso; liberar: também devolve canvases preparados e não usados
  function parar() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    terminar();
  }
  function liberar() {
    if (raf) cancelAnimationFrame(raf);
    terminar();
  }

  window.QBConfete = { preparar, estourar, parar, liberar, ativo: () => !!raf };
})();
