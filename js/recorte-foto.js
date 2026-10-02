/* Estúdio: tira o fundo da foto do cliente para gravar só a pessoa (demonstração).
   Segmentação de pessoas do MediaPipe (modelo selfie_segmenter, 250 KB, em assets/modelos),
   rodando no próprio aparelho: a foto não sai do navegador. A biblioteca (~3 MB comprimida)
   só é baixada quando alguém escolhe uma foto. Sem pessoa na foto, usa um recorte oval suave. */
const VERSAO = '1.0.1';
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSAO;
const MODELO = new URL('../assets/modelos/selfie_segmenter.tflite', import.meta.url).href;

/* O MediaPipe manda telemetria de uso para o Google (odml.pa.googleapis.com) pelo fetch global.
   Bloqueamos só esse endereço: nada sai do aparelho, e o registrador para de tentar após a recusa. */
let guardaInstalada = false;
function bloquearTelemetria() {
  if (guardaInstalada) return;
  guardaInstalada = true;
  const original = window.fetch;
  window.fetch = function (recurso, opcoes) {
    const url = typeof recurso === 'string' ? recurso : recurso && recurso.url;
    try { if (url && new URL(url, location.href).hostname === 'odml.pa.googleapis.com') return Promise.resolve(new Response(null, { status: 204 })); } catch (e) { /* URL estranha: segue */ }
    return original.apply(this, arguments);
  };
}

let carregando = null;
function segmentador() {
  bloquearTelemetria();
  if (!carregando) {
    carregando = (async () => {
      const vision = await import(CDN + '/vision_bundle.mjs');
      const arquivos = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
      const criar = (delegate) => vision.ImageSegmenter.createFromOptions(arquivos, {
        baseOptions: { modelAssetPath: MODELO, delegate },
        runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false
      });
      try { return await criar('GPU'); } catch (e) { return criar('CPU'); }
    })();
    carregando.catch(() => { carregando = null; }); // falhou: tenta de novo na próxima foto
  }
  return carregando;
}

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Devolve { imagem: canvas com fundo transparente e recortado justo, pessoa: true/false } */
export async function recortarFundo(fonte, { max = 1024 } = {}) {
  const w0 = fonte.naturalWidth || fonte.width, h0 = fonte.naturalHeight || fonte.height;
  const s = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
  const base = document.createElement('canvas');
  base.width = w; base.height = h;
  const g = base.getContext('2d', { willReadFrequently: true });
  g.drawImage(fonte, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h);

  let alfa = null, pessoa = false;
  try {
    const seg = await segmentador();
    const r = seg.segment(base);
    const m = r.confidenceMasks && r.confidenceMasks[0];
    if (m) {
      const conf = m.getAsFloat32Array(), mw = m.width, mh = m.height;
      alfa = new Float32Array(w * h);
      let soma = 0;
      for (let y = 0; y < h; y++) {
        const my = Math.min(mh - 1, Math.floor(y * mh / h));
        for (let x = 0; x < w; x++) {
          const v = suave(0.35, 0.7, conf[my * mw + Math.min(mw - 1, Math.floor(x * mw / w))]);
          alfa[y * w + x] = v; soma += v;
        }
      }
      pessoa = soma / (w * h) > 0.03; // menos de 3% da foto: não achou pessoa
    }
    if (r.close) r.close(); else if (m && m.close) m.close();
  } catch (e) { /* sem segmentação (rede, aparelho): segue com o oval */ }

  if (!pessoa) { // recorte oval suave no centro: tira as bordas e deixa o assunto
    alfa = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x / w - 0.5) / 0.42, dy = (y / h - 0.5) / 0.46;
      alfa[y * w + x] = 1 - suave(0.82, 1, Math.sqrt(dx * dx + dy * dy));
    }
  }

  // aplica o alfa e acha a caixa do que sobrou
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0, j = 3; i < alfa.length; i++, j += 4) {
    const a = Math.round(px.data[j] * alfa[i]);
    px.data[j] = a;
    if (a > 24) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  g.putImageData(px, 0, 0);
  if (x1 <= x0 || y1 <= y0) return { imagem: base, pessoa: false };
  const mx = Math.round((x1 - x0) * 0.04), my = Math.round((y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - mx); y0 = Math.max(0, y0 - my); x1 = Math.min(w - 1, x1 + mx); y1 = Math.min(h - 1, y1 + my);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(base, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { imagem: out, pessoa };
}
