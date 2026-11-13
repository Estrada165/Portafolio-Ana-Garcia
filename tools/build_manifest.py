#!/usr/bin/env python3
"""Genera data/local-content.json a partir de las carpetas de imagenes/.
Uso (desde la raíz del proyecto):  python3 tools/build_manifest.py
Requiere Pillow:  pip install pillow
Los textos de destacados y logos se editan en LOGOS / FEATURED más abajo."""
import json, os, re
from PIL import Image

IMG = 'imagenes'
def natural(s): return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', s)]

def item(path, title='', category='', description=''):
    with Image.open(path) as im: w, h = im.size
    r = {'image_url': path.replace(os.sep, '/'), 'title': title, 'category': category, 'width': w, 'height': h}
    if description: r['description'] = description
    return r

def folder(sub, category):
    d = os.path.join(IMG, sub)
    files = sorted((f for f in os.listdir(d) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))), key=natural)
    return [item(os.path.join(d, f), '', category) for f in files]

FEATURED = [  # (archivo, título, descripción, etiquetas)
    ('destacados/destacado1.jpg', 'Rebranding Corporativo', 'Renovación completa de identidad visual', ['Branding', 'Identidad']),
    ('destacados/destacado2.jpg', 'Campaña Digital', 'Diseño para redes sociales y web', ['Digital', 'Social Media']),
    ('destacados/destacado3.jpg', 'Ilustración Original', 'Arte digital personalizado', ['Ilustración', 'Arte Digital']),
]
LOGOS = [  # (archivo, nombre, descripción, [(variación, archivo)])
    ('logos/logo1.png', 'Energi', 'Identidad Corporativa', [('Verde', 'logos/logo1.png')]),
    ('logos/logo2.png', 'North Energy Corp', 'Logo Corporativo',
        [('Azul', 'logos/logo2.png'), ('Negro', 'Variaciones_logos/logo2_negro.png'), ('Blanco', 'Variaciones_logos/logo2_blanco.png')]),
    ('logos/logo3.png', 'Grin Network', 'Tecnología Verde', [('Verde', 'logos/logo3.png')]),
]

def sig(path):
    with Image.open(path) as im: return list(im.convert('L').resize((24, 24)).tobytes())
def dedupe(items, against):
    """Quita de `items` las piezas que ya aparecen (visualmente iguales) en `against`."""
    ref = [sig(i['image_url']) for i in against]
    keep = []
    for it in items:
        s = sig(it['image_url'])
        if any(sum(abs(a - b) for a, b in zip(s, r)) / len(s) < 6 for r in ref): print('  duplicada omitida:', it['image_url'])
        else: keep.append(it)
    return keep

out = {'mockups': folder('mockups', 'Presentación de Marca'),
       'designs': folder('diseños', 'Diseño Gráfico'),
       'illustrations': folder('ilustraciones', 'Arte Digital'),
       'featured': [], 'logos': []}
for f, t, d, tags in FEATURED:
    it = item(os.path.join(IMG, f), t, '', d); it['tags'] = tags; out['featured'].append(it)
for f, name, desc, vars_ in LOGOS:
    it = item(os.path.join(IMG, f), name, '', desc)
    it['variations'] = [{'label': l, 'image_url': IMG + '/' + p} for l, p in vars_]
    out['logos'].append(it)
out['designs'] = dedupe(out['designs'], out['featured'])
out['illustrations'] = dedupe(out['illustrations'], out['featured'])
os.makedirs('data', exist_ok=True)
json.dump(out, open('data/local-content.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()})
