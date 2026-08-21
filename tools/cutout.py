#!/usr/bin/env python3
"""불투명 배경(흰 배경 등) 이미지를 투명 배경으로 오려낸다.

핵심은 **가장자리를 부드럽게 남기는 것**이다.
모서리에서 flood fill 로 배경을 찾아 그대로 알파 0 으로 만들면
알파가 0 아니면 255 인 이분법이 되어, 분홍 카드 배경 위에 얹었을 때
윤곽이 계단처럼 보인다. 원본의 안티앨리어싱이 통째로 사라지기 때문이다.

그래서 이진 마스크를 만든 뒤
  1) 1px 침식 — 경사가 바깥(흰 여백)이 아니라 캐릭터 안쪽에서 시작하게 한다.
     이렇게 해야 흰 테두리(할로)가 남지 않는다.
  2) 가우시안 블러 — 1~2px 폭의 알파 경사를 만든다.
순서로 다듬어 알파에 넣는다.

사용법:
  from cutout import cutout
  im = cutout(Image.open(path))          # RGBA 반환
"""
from collections import deque
from PIL import Image, ImageChops, ImageFilter

# 배경으로 볼 색차. 낮게 잡아야 한다.
# 흰 배경 위의 흰 캐릭터(고마핑의 흰 모자, 뽀송핑의 양털)는 배경과 색이 거의 같아서,
# 허용치를 18~26 으로 두면 flood fill 이 캐릭터 안쪽까지 파고들어 머리가 뭉텅 지워진다.
# 12 까지는 흰 털이 온전히 남고 배경도 깨끗이 지워진다.
TOLERANCE = 12
FEATHER = 0.8           # 알파 경사 폭(px)

def background_mask(im, tolerance=TOLERANCE):
    """모서리에서 연결된 배경이면 0, 캐릭터면 255 인 이진 마스크."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = px[0, 0][:3]
    mask = Image.new("L", (w, h), 255)
    mp = mask.load()
    def is_bg(x, y):
        r, g, b, a = px[x, y]
        return a > 20 and all(abs(c - d) <= tolerance for c, d in zip((r, g, b), bg))
    seen = bytearray(w * h)
    dq = deque()
    def push(x, y):
        i = y * w + x
        if not seen[i] and is_bg(x, y):
            seen[i] = 1; dq.append((x, y))
    for x in range(w): push(x, 0); push(x, h - 1)
    for y in range(h): push(0, y); push(w - 1, y)
    while dq:
        x, y = dq.popleft()
        mp[x, y] = 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h: push(nx, ny)
    return mask

def feather(mask, feather=FEATHER):
    """이진 마스크를 안쪽으로 1px 깎고 흐려서 부드러운 알파를 만든다."""
    return mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(feather))

def cutout(im, tolerance=TOLERANCE, feather_px=FEATHER):
    im = im.convert("RGBA")
    a = feather(background_mask(im, tolerance), feather_px)
    # 원본이 이미 투명하던 곳은 그대로 둔다(둘 중 더 투명한 쪽을 택한다)
    orig = im.getchannel("A")
    hist = orig.histogram()
    if sum(hist[20:236]) < sum(hist[236:]) * 0.002:
        # 원본 알파부터 0/255 이분법이면(투명 PNG 인데 안티앨리어싱이 없는 경우)
        # 그대로 두면 계단이 남는다. 원본 알파도 같이 다듬는다.
        orig = feather(orig, feather_px)
    im.putalpha(ImageChops.darker(a, orig))
    return im

if __name__ == "__main__":
    import sys
    for p in sys.argv[1:]:
        out = p.rsplit(".", 1)[0] + "-cutout.png"
        cutout(Image.open(p)).save(out, "PNG")
        print(out)
