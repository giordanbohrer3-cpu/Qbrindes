#!/usr/bin/env python3
"""Recorta as fotos dos produtos da QBrindes com IA e gera assets/produtos/*.webp.

Uso típico (na raiz do site):
    OMP_NUM_THREADS=2 python3 tools/recortar.py --orig-dir /caminho/originais --cache-dir /tmp/qb-mascaras
    python3 tools/recortar.py --so 148325-0 147653-0      # refaz só essas chaves
    python3 tools/recortar.py --so-mascaras               # só roda a IA e guarda as máscaras

Classificação por imagem vem de js/catalogo.js ("imgs" e "recorte"):
    recorte=true  -> IA (rembg/BiRefNet) + pós-processo, fundo transparente, produto
                     centralizado ocupando 84% do canvas 4:5;
    recorte=false -> foto inteira cortada em cover 4:5 (centro), sem mexer no enquadramento.

URLs originais ficam em tools/originais.json ({chave: url}). Se o original não estiver em
--orig-dir, o script baixa. Saída: assets/produtos/{chave}-400.webp e -800.webp.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request

os.environ.setdefault("OMP_NUM_THREADS", "2")

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(RAIZ, "js", "catalogo.js")
ORIGINAIS_JSON = os.path.join(RAIZ, "tools", "originais.json")
SAIDA = os.path.join(RAIZ, "assets", "produtos")

MODELOS = ["birefnet-general-lite", "birefnet-general", "isnet-general-use"]
JUIZ = "isnet-general-use"  # 2a opinião, só para confirmar furos candidatos
OCUPA = 0.84          # fração do canvas ocupada pelo produto (lado limitante)
TAMANHOS = (400, 800)  # largura; altura = 1,25 x largura (4:5)


# --------------------------------------------------------------------------- dados
def ler_catalogo():
    txt = open(CATALOGO, encoding="utf-8").read()
    ini = txt.index("{")
    fim = txt.rindex("}")
    cat = json.loads(txt[ini:fim + 1])
    itens = []
    for p in cat["produtos"]:
        for k, chave in enumerate(p["imgs"]):
            itens.append((chave, bool(p["recorte"][k])))
    return itens


def ler_originais(products_json=None):
    """{chave: url}. Se vier products.json (export do catálogo antigo), (re)gera o arquivo."""
    if products_json:
        ps = json.load(open(products_json, encoding="utf-8"))
        m = {}
        for p in ps:
            for k, im in enumerate(p.get("images") or []):
                m[f"{p['id']}-{k}"] = im["url"]
        json.dump(m, open(ORIGINAIS_JSON, "w", encoding="utf-8"), indent=1, ensure_ascii=False, sort_keys=True)
        return m
    return json.load(open(ORIGINAIS_JSON, encoding="utf-8"))


def caminho_original(chave, urls, orig_dir):
    url = urls[chave]
    nome = url.rsplit("/", 1)[-1]
    fn = os.path.join(orig_dir, nome)
    if not os.path.exists(fn):
        os.makedirs(orig_dir, exist_ok=True)
        print(f"  baixando {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 qbrindes-recortar"})
        with urllib.request.urlopen(req, timeout=60) as r:
            dados = r.read()
        tmp = fn + ".part"
        open(tmp, "wb").write(dados)
        os.replace(tmp, fn)
    return fn


# --------------------------------------------------------------------------- IA
_SESSAO = {}


def sessao(modelo):
    if modelo not in _SESSAO:
        import onnxruntime as ort
        from rembg import new_session
        so = ort.SessionOptions()
        so.intra_op_num_threads = 2
        so.inter_op_num_threads = 1
        # sem arena: o BiRefNet a 1024 px estoura a memória na 2a inferência com a arena ligada
        so.enable_cpu_mem_arena = False
        so.enable_mem_pattern = False
        _SESSAO[modelo] = new_session(modelo, sess_opts=so)
    return _SESSAO[modelo]


def mascara_ia(chave, img, modelo, cache_dir):
    """Alfa da IA (uint8, tamanho do original), com cache em disco."""
    fn = os.path.join(cache_dir, f"{chave}.{modelo}.png") if cache_dir else None
    if fn and os.path.exists(fn):
        m = Image.open(fn).convert("L")
        if m.size == img.size:
            return np.asarray(m)
    t = time.time()
    m = sessao(modelo).predict(img.convert("RGB"))[0].convert("L")
    print(f"  IA {modelo}: {time.time() - t:.1f}s", flush=True)
    if fn:
        os.makedirs(cache_dir, exist_ok=True)
        m.save(fn)
    return np.asarray(m)



# --------------------------------------------------------------------------- ajustes por imagem
# Caixas em frações da imagem original: (x0, y0, x1, y1).
#   transparente: peças de acrílico/vidro -> alfa parcial pela luminância (mín. 0,15)
#   apagar:       áreas a zerar (ex.: rótulos de interface que vieram na foto)
#   furo / nao_furo: pontos (x, y) dentro de uma região branca interna que é / não é furo
AJUSTES = {
    "148325-0": {"transparente": [(0.50, 0.50, 1.00, 0.95)]},
    "144818-0": {"furo": [(0.601, 0.106)]},  # vão entre o clipe e o corpo da caneta branca
}


# --------------------------------------------------------------------------- pós-processo
def _lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def _caixa(box, h, w):
    x0, y0, x1, y1 = box
    return int(round(y0 * h)), int(round(y1 * h)), int(round(x0 * w)), int(round(x1 * w))


def _vizinho_interior(rgb, interior):
    """Cor puxada do interior: média gaussiana dos pixels interiores, com recurso ao mais próximo."""
    m = interior.astype(np.float32)
    peso = ndimage.gaussian_filter(m, 1.2, truncate=3.0)
    soma = np.stack([ndimage.gaussian_filter(rgb[..., c] * m, 1.2, truncate=3.0) for c in range(3)], -1)
    media = soma / np.maximum(peso, 1e-6)[..., None]
    if interior.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~interior, return_indices=True)
        prox = rgb[iy, ix]
    else:
        prox = rgb
    return np.where((peso > 0.04)[..., None], media, prox), peso


def fundo_da_foto(rgb):
    b = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    return float(np.median(b.min(1)))


def limpar_ilhas(alfa, aj, info):
    """Remove ilhas pequenas soltas (poeira, rótulos de interface) e as áreas marcadas em 'apagar'."""
    h, w = alfa.shape
    for box in aj.get("apagar", []):
        y0, y1, x0, x1 = _caixa(box, h, w)
        alfa[y0:y1, x0:x1] = 0
    forte = alfa > 0.5
    lab, n = ndimage.label(forte, structure=np.ones((3, 3)))
    if n > 1:
        areas = ndimage.sum(forte, lab, index=np.arange(1, n + 1))
        manter = np.zeros(n + 1, bool)
        manter[1:] = areas >= max(0.0004 * forte.size, 0.003 * areas.max())
        if (~manter[1:]).any():
            info["ilhas"] = int((~manter[1:]).sum())
        keep = ndimage.binary_dilation(manter[lab], iterations=4)
        alfa = np.where(keep, alfa, 0.0)
    return alfa


def sem_sombra_de_chao(rgb, alfa, aj, info):
    """Zera os pixels claros e pouco saturados ABAIXO da linha da base do produto
    (sombra de contato e reflexo do chão). A base é, por coluna, o pixel mais baixo do produto."""
    h, w = alfa.shape
    mx, mn = rgb.max(2), rgb.min(2)
    claro_neutro = (mn > 110) & ((mx - mn) < 28)
    firme = alfa > 0.5
    if aj.get("chao_forte"):
        # a IA pegou sombra/reflexo com alfa alto: o que for claro/neutro e liso não conta como base
        liso = ndimage.uniform_filter(_lum(rgb), 5)
        var = ndimage.uniform_filter(_lum(rgb) ** 2, 5) - liso ** 2
        firme &= ~(claro_neutro & (var < aj.get("chao_var", 30.0)) & (alfa < 0.995))
    if "chao_y" in aj:  # linha de base dada à mão (fração da altura)
        firme[int(aj["chao_y"] * h):] = False
    tem = firme.any(0)
    if not tem.any():
        return alfa
    base = np.where(tem, h - 1 - np.argmax(firme[::-1], axis=0), h)
    linhas = np.where(firme.any(1))[0]
    meio = (linhas[0] + linhas[-1]) // 2
    yy = np.arange(h)[:, None]
    abaixo = np.where(tem[None, :], yy > base[None, :], yy > meio)
    zerar = abaixo & claro_neutro & (alfa > 0)
    info["sombra_px"] = int((zerar & (alfa > 0.1)).sum())
    return np.where(zerar, 0.0, alfa)


def candidatos_a_furo(rgb, alfa, fundo=255.0):
    """Regiões brancas internas com cara de fundo vazado. Devolve [(rótulo, fatia, máscara, métricas)]."""
    h, w = alfa.shape
    mx, mn = rgb.max(2), rgb.min(2)
    branco = (mn > 240) & ((mx - mn) < 10)
    lab, n = ndimage.label(branco)  # 4-vizinhança: não vaza por diagonais
    if n == 0:
        return lab, []
    borda = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    lum = _lum(rgb)
    area_min = max(60, int(0.00012 * h * w))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        if sl is None or i in borda:
            continue
        y0, y1 = max(sl[0].start - 6, 0), min(sl[0].stop + 6, h)
        x0, x1 = max(sl[1].start - 6, 0), min(sl[1].stop + 6, w)
        c = lab[y0:y1, x0:x1] == i
        area = int(c.sum())
        if area < area_min:
            continue
        a = alfa[y0:y1, x0:x1]
        if a[c].mean() < 0.15:
            continue  # a IA já abriu
        miolo = ndimage.binary_erosion(c, iterations=1)
        if miolo.sum() < 10:
            continue
        m = {
            "area": area,
            "rin": float(ndimage.distance_transform_edt(c).max()),
            "std": float(lum[y0:y1, x0:x1][miolo].std()),
            "mn": float(mn[y0:y1, x0:x1][miolo].mean()),
            "puro": float((mn[y0:y1, x0:x1][miolo] >= fundo - 2).mean()),
            "tinta": float((mx - mn)[y0:y1, x0:x1][miolo].mean()),
        }
        anel = ndimage.binary_dilation(c, iterations=5) & ~ndimage.binary_dilation(c, iterations=1)
        m["fechado"] = float((a[anel] > 0.5).mean())
        m["anel_claro"] = float((lum[y0:y1, x0:x1][anel] > 215).mean())
        m["ok"] = (m["rin"] >= 3 and m["std"] <= 3.0 and m["mn"] >= fundo - 4 and m["puro"] >= 0.5
                   and m["tinta"] <= 4 and m["fechado"] >= 0.95 and m["anel_claro"] <= 0.45)
        out.append((i, (slice(y0, y1), slice(x0, x1)), c, m))
    return lab, out


def preencher_furos(rgb, alfa, aj, info, fundo=255.0, juiz=None):
    """Furos internos (alças, argolas, asas) que são fundo branco puro viram transparentes.
    Só entram regiões brancas FECHADAS pelo produto, lisas, neutras e da cor exata do fundo --
    faces brancas do produto (xícara, placa, taça) ficam. Reflexo estourado de metal tem a mesma
    cara de fundo; por isso cada candidato passa por um segundo modelo (`juiz`, isnet), que precisa
    concordar com folga que ali é fundo (alfa médio < 0,2).
    Ajustes: 'nao_furo' (pontos que NÃO são furo) e 'furo' (pontos que são furo)."""
    h, w = alfa.shape
    lab, cands = candidatos_a_furo(rgb, alfa, fundo)
    def rotulo(x, y, r=6):  # região branca mais presente perto do ponto
        cy, cx = int(y * h), int(x * w)
        jan = lab[max(cy - r, 0):cy + r + 1, max(cx - r, 0):cx + r + 1]
        v = jan[jan > 0]
        return int(np.bincount(v).argmax()) if v.size else 0
    veto = {rotulo(x, y) for x, y in aj.get("nao_furo", [])} - {0}
    forca = {rotulo(x, y) for x, y in aj.get("furo", [])} - {0}
    furos = np.zeros(alfa.shape, bool)
    usados, julgados = [], []
    a_juiz = None
    for i, sl, c, m in cands:
        aceita = m["ok"] and i not in veto
        if aceita and i not in forca and juiz is not None:
            if a_juiz is None:
                a_juiz = juiz().astype(np.float32) / 255.0
            v = float(a_juiz[sl][c].mean())
            julgados.append(round(v, 2))
            aceita = v < 0.2
        if aceita or i in forca:
            furos[sl] |= c
            usados.append(i)
    for i in forca - set(usados):
        furos |= lab == i
        usados.append(i)
    info["furos"] = len(usados)
    if julgados:
        info["juiz"] = julgados
    if not usados:
        return alfa
    alfa = np.where(furos, 0.0, alfa)
    # borda do furo: alfa pela mistura com o fundo (C = a*F + (1-a)*branco)
    lum = _lum(rgb)
    perto = ndimage.binary_dilation(furos, iterations=3) & ~furos
    nucleo = (alfa > 0.5) & ~ndimage.binary_dilation(furos, iterations=4)
    F, _ = _vizinho_interior(rgb.astype(np.float32), nucleo)
    LF = _lum(F)
    a_est = np.clip((fundo - lum) / np.maximum(fundo - LF, 1.0), 0, 1)
    ok = perto & ((fundo - LF) > 40)
    return np.where(ok, np.minimum(alfa, a_est), alfa)


def forcar_opaco(alfa, caixas):
    """Onde a IA vazou o produto (metal claro tomado por fundo): fecha a silhueta dentro da caixa."""
    h, w = alfa.shape
    for box in caixas:
        y0, y1, x0, x1 = _caixa(box, h, w)
        a = alfa[y0:y1, x0:x1]
        sil = ndimage.binary_fill_holes(a > 0.5)
        alfa[y0:y1, x0:x1] = np.where(sil, 1.0, a)
    return alfa


def defringe(rgb, alfa, info):
    """Defringe de 1 px: a cor da borda (alfa parcial + 1 px para dentro) é puxada do interior
    sempre que a borda estiver mais clara que o interior (contaminação pelo fundo branco)."""
    core = alfa >= 0.98
    interior = ndimage.binary_erosion(core, iterations=1)
    banda = (alfa > 0) & ~interior
    puxada, peso = _vizinho_interior(rgb, interior)
    # pontos finos (sem interior por perto): desmistura contra o fundo branco
    a = np.clip(alfa, 1e-3, 1)[..., None]
    desm = np.clip((rgb - (1 - a) * 255.0) / a, 0, 255)
    alvo = np.where((peso > 0.02)[..., None], puxada, np.where((alfa >= 0.6)[..., None], desm, puxada))
    clareou = _lum(rgb) > _lum(alvo) + 2
    trocar = banda & clareou
    info["defringe_px"] = int(trocar.sum())
    out = np.where(trocar[..., None], alvo, rgb)
    # pixels totalmente transparentes recebem a cor vizinha (evita halo ao redimensionar)
    _, (iy, ix) = ndimage.distance_transform_edt(alfa <= 0, return_indices=True)
    return np.where((alfa <= 0)[..., None], out[iy, ix], out)


def transparente(rgb, alfa, caixas, fundo=255.0, minimo=0.15, opaco=110.0):
    """Peça transparente: alfa pela luminância (escuro = opaco), mínimo 0,15; cor desmisturada do branco."""
    h, w = alfa.shape
    rgb = rgb.copy()
    alfa = alfa.copy()
    for box in caixas:
        y0, y1, x0, x1 = _caixa(box, h, w)
        a = alfa[y0:y1, x0:x1]
        sil = ndimage.binary_fill_holes(ndimage.binary_closing(a > 0.3, iterations=6))
        sil = ndimage.binary_erosion(sil, iterations=1)
        C = rgb[y0:y1, x0:x1]
        L = _lum(C)
        al = np.clip((fundo - L) / (fundo - opaco), minimo, 1.0)
        novo = np.where(sil, al, np.minimum(a, al))
        novo = np.where(sil, ndimage.gaussian_filter(novo, 0.7), novo)
        an = np.clip(novo, 1e-3, 1)[..., None]
        F = np.clip((C - (1 - an) * fundo) / an, 0, 255)
        # a desmistura em alfa baixo satura a cor (azul forte nas quinas do acrílico): tempera
        g = _lum(F)[..., None]
        F = np.where((novo < 0.9)[..., None], g + (F - g) * 0.55, F)
        mexe = (sil | (a > 0))[..., None]
        rgb[y0:y1, x0:x1] = np.where(mexe, F, C)
        alfa[y0:y1, x0:x1] = novo
    return rgb, alfa


def recortar(chave, rgb_u8, alfa_ia, juiz=None):
    aj = AJUSTES.get(chave, {})
    info = {}
    rgb = rgb_u8.astype(np.float32)
    fundo = fundo_da_foto(rgb_u8)
    alfa = alfa_ia.astype(np.float32) / 255.0                       # 1. alfa da IA
    alfa = limpar_ilhas(alfa, aj, info)
    if aj.get("opaco"):
        alfa = forcar_opaco(alfa, aj["opaco"])
    alfa = sem_sombra_de_chao(rgb_u8.astype(np.int16), alfa, aj, info)  # 2. sombra/reflexo do chão
    if not aj.get("sem_furos"):
        alfa = preencher_furos(rgb_u8.astype(np.int16), alfa, aj, info, fundo, juiz)  # 3. furos brancos
    rgb = defringe(rgb, alfa, info)                                   # 4. defringe 1 px
    if aj.get("transparente"):                                        # 5. peça transparente
        rgb, alfa = transparente(rgb_u8.astype(np.float32), alfa, aj["transparente"], fundo)
        rgb = defringe(rgb, alfa, {})
    return rgb, alfa, info


# --------------------------------------------------------------------------- composição e saída
def compor(rgb, alfa, W, ocupa=OCUPA):
    """Recorte justo, centralizado no canvas 4:5 ocupando `ocupa` do lado limitante."""
    H = int(round(W * 1.25))
    ys, xs = np.where(alfa > 0.02)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = alfa[y0:y1, x0:x1].astype(np.float32)
    p = rgb[y0:y1, x0:x1].astype(np.float32) * a[..., None]
    ph, pw = a.shape
    s = min(W * ocupa / pw, H * ocupa / ph)
    nw, nh = max(1, int(round(pw * s))), max(1, int(round(ph * s)))
    rs = lambda m: np.asarray(Image.fromarray(m, "F").resize((nw, nh), Image.LANCZOS))
    ar = np.clip(rs(a), 0, 1)
    pr = np.stack([rs(np.ascontiguousarray(p[..., c])) for c in range(3)], -1)
    cor = np.clip(pr / np.maximum(ar, 1e-4)[..., None], 0, 255)
    ar = np.where(ar < 1.5 / 255, 0, ar)
    out = np.zeros((H, W, 4), np.float32)
    ox, oy = (W - nw) // 2, (H - nh) // 2
    out[oy:oy + nh, ox:ox + nw, :3] = cor
    out[oy:oy + nh, ox:ox + nw, 3] = ar * 255
    return Image.fromarray(np.round(out).astype(np.uint8), "RGBA")


def salvar_recorte(chave, rgb, alfa, saida=SAIDA):
    for W in TAMANHOS:
        im = compor(rgb, alfa, W)
        im.save(os.path.join(saida, f"{chave}-{W}.webp"), "WEBP", quality=86, method=6, alpha_quality=100)


def salvar_foto(chave, img, saida=SAIDA):
    """Foto inteira em cover 4:5 centralizado (mesmo enquadramento de antes), WebP q85."""
    img = img.convert("RGB")
    iw, ih = img.size
    for W in TAMANHOS:
        H = int(W * 1.25)
        s = max(W / iw, H / ih)
        r = img.resize((int(iw * s + .5), int(ih * s + .5)), Image.LANCZOS)
        l, t = (r.size[0] - W) // 2, (r.size[1] - H) // 2
        r.crop((l, t, l + W, t + H)).save(os.path.join(saida, f"{chave}-{W}.webp"), "WEBP", quality=85, method=6)


# --------------------------------------------------------------------------- folhas de contato
FUNDOS = {"claro": (0xF4, 0xF1, 0xEA), "escuro": (0x15, 0x11, 0x3F)}


def folha(chaves, fundo, destino, tile=160, cols=12, tamanho=400, rotulo=True):
    from PIL import ImageDraw
    th = int(tile * 1.25)
    rows = (len(chaves) + cols - 1) // cols
    lab_h = 16 if rotulo else 0
    sh = Image.new("RGB", (cols * tile, rows * (th + lab_h)), fundo)
    d = ImageDraw.Draw(sh)
    txt = (40, 36, 60) if sum(fundo) > 380 else (230, 228, 240)
    for n, k in enumerate(chaves):
        fn = os.path.join(SAIDA, f"{k}-{tamanho}.webp")
        im = Image.open(fn).convert("RGBA").resize((tile, th), Image.LANCZOS)
        x, y = (n % cols) * tile, (n // cols) * (th + lab_h)
        sh.paste(im, (x, y), im)
        if rotulo:
            d.text((x + 4, y + th + 2), k, fill=txt)
    sh.save(destino)
    return destino


PROBLEMAS = ["148336-0", "148857-0", "148829-0", "146625-0", "148273-0", "148312-0",
             "147649-0", "148325-0", "147653-0"]


def folha_pares(chaves, destino, tile=400):
    """Folha grande: cada chave sobre o fundo claro e o escuro, lado a lado."""
    from PIL import ImageDraw
    th = int(tile * 1.25)
    cols = 2  # pares por linha
    rows = (len(chaves) + cols - 1) // cols
    gap, lab_h = 12, 22
    W = cols * (2 * tile + gap) + (cols - 1) * gap
    sh = Image.new("RGB", (W, rows * (th + lab_h + gap)), (128, 128, 128))
    d = ImageDraw.Draw(sh)
    for n, k in enumerate(chaves):
        im = Image.open(os.path.join(SAIDA, f"{k}-800.webp")).convert("RGBA").resize((tile, th), Image.LANCZOS)
        x0 = (n % cols) * (2 * tile + 2 * gap)
        y0 = (n // cols) * (th + lab_h + gap)
        for j, cor in enumerate(FUNDOS.values()):
            t = Image.new("RGB", (tile, th), cor)
            t.paste(im, (0, 0), im)
            sh.paste(t, (x0 + j * tile, y0))
        d.text((x0 + 4, y0 + th + 4), k, fill=(0, 0, 0))
    sh.save(destino)
    return destino


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--orig-dir", default=os.environ.get("QB_ORIGINAIS", "/tmp/qbrindes-originais"),
                    help="pasta com as fotos originais (baixa as que faltarem)")
    ap.add_argument("--cache-dir", default=os.environ.get("QB_MASCARAS", "/tmp/qbrindes-mascaras"),
                    help="cache das máscaras da IA")
    ap.add_argument("--modelo", default=MODELOS[0], choices=MODELOS)
    ap.add_argument("--products-json", help="export do catálogo antigo para (re)gerar tools/originais.json")
    ap.add_argument("--so", nargs="*", help="só estas chaves")
    ap.add_argument("--so-mascaras", action="store_true", help="só roda a IA (preenche o cache)")
    ap.add_argument("--folhas", help="pasta onde gravar as folhas de contato")
    a = ap.parse_args()

    urls = ler_originais(a.products_json)
    itens = ler_catalogo()
    if a.so:
        itens = [(k, r) for k, r in itens if k in a.so]
    os.makedirs(SAIDA, exist_ok=True)
    relatorio = {}
    for n, (chave, recorte) in enumerate(itens, 1):
        t = time.time()
        img = Image.open(caminho_original(chave, urls, a.orig_dir))
        if not recorte:
            if not a.so_mascaras:
                salvar_foto(chave, img)
            print(f"[{n}/{len(itens)}] {chave} foto", flush=True)
            continue
        rgb = img.convert("RGB")
        m = mascara_ia(chave, rgb, a.modelo, a.cache_dir)
        if a.so_mascaras:
            print(f"[{n}/{len(itens)}] {chave} máscara ok", flush=True)
            continue
        juiz = lambda: mascara_ia(chave, rgb, JUIZ, a.cache_dir)
        cor, alfa, info = recortar(chave, np.asarray(rgb), m, juiz)
        salvar_recorte(chave, cor, alfa)
        relatorio[chave] = info
        print(f"[{n}/{len(itens)}] {chave} recorte {info} {time.time() - t:.1f}s", flush=True)
    if a.folhas and not a.so_mascaras:
        os.makedirs(a.folhas, exist_ok=True)
        todas = [k for k, _ in ler_catalogo()]
        for nome, cor in FUNDOS.items():
            print(folha(todas, cor, os.path.join(a.folhas, f"folha-{nome}.png")))
        print(folha_pares(PROBLEMAS, os.path.join(a.folhas, "folha-problematicas.png")))
        json.dump(relatorio, open(os.path.join(a.folhas, "relatorio.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
