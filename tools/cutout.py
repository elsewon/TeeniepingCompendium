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

def feather(mask, feather=FEATHER, erode=1):
    """이진 마스크를 안쪽으로 깎고 흐려서 부드러운 알파를 만든다.

    깎는 폭(erode)과 흐리는 폭(feather)은 **그 그림의 크기에 맞춰야 한다.**
    기본값 1px·0.8px 는 512px 그림에 맞춘 값이다. 900px 원본에서 오려낸 뒤
    512 로 줄이면 실효 침식이 0.57px 로 줄어, JPEG 원본의 압축 링잉이
    흰 테두리로 남는다. 큰 원본을 다룰 때는 scaled() 로 값을 키워 넘긴다.
    """
    for _ in range(max(0, erode)):
        mask = mask.filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(feather))

def scaled(size, target=512):
    """원본 크기에 맞춘 (흐림폭, 침식횟수). 512 기준값을 그 배율만큼 키운다."""
    k = max(1.0, max(size) / target)
    return FEATHER * k, max(1, round(k))

def enclosed_holes(im, tolerance=TOLERANCE, min_area=200):
    """사방이 막혀 flood fill 이 닿지 못한 배경 덩어리를 찾는다.

    background_mask 는 모서리에서만 번진다. 그래서 활 안쪽, 팔과 몸 사이처럼
    캐릭터에 둘러싸인 배경은 지워지지 않고 흰 판때기로 남는다.
    여기서는 '배경색인데 모서리에서 닿지 않은' 덩어리를 따로 모은다.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = px[0, 0][:3]
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
    while dq:                                   # 바깥 배경을 먼저 표시 — 이건 구멍이 아니다
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h: push(nx, ny)
    out = []
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or not is_bg(sx, sy): continue
            comp = []; q = deque([(sx, sy)]); seen[i] = 1
            while q:
                x, y = q.popleft(); comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and is_bg(nx, ny):
                        seen[j] = 1; q.append((nx, ny))
            if len(comp) >= min_area: out.append(comp)
    out.sort(key=len, reverse=True)
    return out

def punch_like(im, ref, tolerance=TOLERANCE, min_area=200, agree=0.6):
    """갇힌 구멍을 뚫되 **지금 쓰고 있는 그림(ref)을 자로 삼는다.**

    색만으로는 뚫어야 할 곳과 두어야 할 곳을 가를 수 없다. 바네핑을 보면
    활 안쪽도, 눈의 흰자도 똑같이 순백이고 둘레 밝기까지 비슷하다.
    그런데 답은 이미 도감 그림에 들어 있다 — 활 안쪽은 투명하고 눈은 불투명하다.
    그래서 후보에서 찾은 구멍을 ref 의 같은 상대 위치에 견주어,
    거기도 비어 있을 때만 뚫는다. ref 가 막고 있으면 손대지 않는다.

    ref 가 그 자리를 이미 잘못 막고 있으면 뚫지 못할 뿐, 더 나빠지지는 않는다.
    """
    im = im.convert("RGBA")
    comps = enclosed_holes(im, tolerance, min_area)
    if not comps:
        return im, []
    cb = im.getchannel("A").getbbox()
    ra = ref.convert("RGBA")
    ra = ra.crop(ra.getchannel("A").getbbox()).getchannel("A")
    rw, rh = ra.size; rp = ra.load()
    cw, ch = cb[2] - cb[0], cb[3] - cb[1]
    # 구멍도 바깥 윤곽과 똑같이 다듬어야 한다. 알파를 딱 0 으로 자르면
    # 구멍 둘레에 남은 압축 링잉이 흰 테두리로 드러난다 — 그래서 구멍 마스크를
    # 만들어 같은 폭으로 넓히고 흐린 뒤 알파에 겹친다.
    hole = Image.new("L", im.size, 255)
    hp = hole.load()
    report = []
    punched = False
    for comp in comps:
        empty = 0
        for x, y in comp:
            rx = min(rw - 1, max(0, int((x - cb[0]) / cw * rw)))
            ry = min(rh - 1, max(0, int((y - cb[1]) / ch * rh)))
            if rp[rx, ry] < 128: empty += 1
        share = empty / len(comp)
        if share >= agree:
            for x, y in comp: hp[x, y] = 0
            punched = True
        report.append((len(comp), round(share, 2), share >= agree))
    if punched:
        f, e = scaled(im.size)
        im.putalpha(ImageChops.darker(im.getchannel("A"), feather(hole, f, e)))
    return im, report

def bleed_edge(im, mask, band=3):
    """가장자리 픽셀의 색을 안쪽 색으로 덮는다 (흰 테두리 지우기).

    JPEG 원본은 경계에 압축 링잉이 있어, 물체 색과 흰 배경이 섞인 픽셀이 한두 겹
    남는다. 알파만 깎으면 그 섞인 색이 반투명하게 비쳐 분홍 카드나 어두운 배경에서
    흰 테두리로 보인다. 그래서 **색을 안에서 바깥으로 번지게** 해 경계 띠를
    안쪽 색으로 갈아 끼운다. 알파는 건드리지 않는다 — 모양은 그대로고 색만 바뀐다.
    """
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    mp = mask.load()
    core = bytearray(w * h)                     # 색을 믿을 수 있는 안쪽
    for y in range(h):
        row = y * w
        for x in range(w):
            if mp[x, y] >= 250: core[row + x] = 1
    for _ in range(band):
        edge = []
        for y in range(h):
            row = y * w
            for x in range(w):
                if core[row + x]: continue
                if mp[x, y] < 20: continue      # 완전한 배경은 볼 것 없다
                acc = []
                for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and core[ny * w + nx]:
                        acc.append(px[nx, ny])
                if acc:
                    r = sum(c[0] for c in acc) // len(acc)
                    g = sum(c[1] for c in acc) // len(acc)
                    b = sum(c[2] for c in acc) // len(acc)
                    edge.append((x, y, r, g, b))
        if not edge: break
        for x, y, r, g, b in edge:
            px[x, y] = (r, g, b, px[x, y][3])
            core[y * w + x] = 1
    return im

def cutout(im, tolerance=TOLERANCE, feather_px=None, erode=None, bleed=0):
    im = im.convert("RGBA")
    if feather_px is None or erode is None:
        f, e = scaled(im.size)
        feather_px = f if feather_px is None else feather_px
        erode = e if erode is None else erode
    binary = background_mask(im, tolerance)
    if bleed:
        im = bleed_edge(im, binary, bleed)
    a = feather(binary, feather_px, erode)
    # 원본이 이미 투명하던 곳은 그대로 둔다(둘 중 더 투명한 쪽을 택한다)
    orig = im.getchannel("A")
    hist = orig.histogram()
    if sum(hist[20:236]) < sum(hist[236:]) * 0.002:
        # 원본 알파부터 0/255 이분법이면(투명 PNG 인데 안티앨리어싱이 없는 경우)
        # 그대로 두면 계단이 남는다. 원본 알파도 같이 다듬는다.
        orig = feather(orig, feather_px, erode)
    im.putalpha(ImageChops.darker(a, orig))
    return im

if __name__ == "__main__":
    import sys
    for p in sys.argv[1:]:
        out = p.rsplit(".", 1)[0] + "-cutout.png"
        cutout(Image.open(p)).save(out, "PNG")
        print(out)
