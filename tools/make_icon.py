# Gera build/icon.ico: silhueta do Homem de Preto sobre fundo vermelho escuro.
import os
from PIL import Image, ImageDraw, ImageFilter

S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 255))
bg = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(bg)
for r in range(S // 2, 0, -2):  # brilho vermelho no centro
    k = 1 - r / (S / 2)
    d.ellipse([S / 2 - r, S / 2 - r * 1.1, S / 2 + r, S / 2 + r * 0.9], fill=(int(20 + 90 * k), int(4 + 8 * k), int(6 + 8 * k), 255))
img.alpha_composite(bg)

fig = Image.new('RGBA', (S, S), (0, 0, 0, 0))
f = ImageDraw.Draw(fig)
c = S / 2
# capa (corpo afunilando até os ombros) e capuz
f.polygon([(c - 150, S), (c - 112, 300), (c - 70, 230), (c + 70, 230), (c + 112, 300), (c + 150, S)], fill=(8, 6, 6, 255))
f.ellipse([c - 82, 92, c + 82, 286], fill=(8, 6, 6, 255))
f.polygon([(c - 30, 100), (c + 40, 52), (c + 30, 120)], fill=(8, 6, 6, 255))
# vazio do capuz
f.ellipse([c - 46, 150, c + 46, 262], fill=(0, 0, 0, 255))
# borda clara sutil para destacar a silhueta
edge = fig.filter(ImageFilter.GaussianBlur(6))
glow = Image.new('RGBA', (S, S), (150, 40, 36, 0))
glow.putalpha(edge.split()[3].point(lambda a: int(a * 0.45)))
img.alpha_composite(glow)
img.alpha_composite(fig)

out = os.path.join(os.path.dirname(__file__), '..', 'build')
os.makedirs(out, exist_ok=True)
img.save(os.path.join(out, 'icon.png'))
img.save(os.path.join(out, 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('ok')
