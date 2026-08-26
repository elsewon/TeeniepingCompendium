#!/usr/bin/env python3
"""극장판 바다 티니핑(방울핑·찰랑핑·소라핑) 이미지의 배경 제거.

이 셋만 나무위키 대표 이미지에 연하늘색 하트 글로우와 반짝이 배경이 들어 있어
나머지 154장(흰 배경)과 어울리지 않는다.

까다로운 점 — 색만으로는 구분이 안 된다.
    배경 글로우 : S≈0.00~0.08  V≈1.00
    머리 하이라이트: S≈0.00~0.12  V≈0.92~1.00     ← 사실상 같다
  그래서 '연한 파랑이면 배경' 식의 색 규칙을 쓰면 머리 뭉치가 뭉텅 뜯긴다.

해법 — **색이 아니라 경사로 판단한다.**
  배경 글로우는 부드러운 그러데이션이라 이웃 픽셀과 색차가 거의 없다.
  반면 캐릭터 윤곽에서는 색이 확 바뀐다.
  그래서 모서리에서 번져 나가되 **이웃과의 색차가 GRADIENT 를 넘으면 멈춘다.**
  글로우 안에서는 계속 번지고, 캐릭터 경계에서는 넘어가지 못한다.

또 한 가지 함정 — 흰 몸통.
  소라핑은 배와 팔이 거의 흰색이라 '채도가 낮으면 배경' 규칙에 그대로 걸린다.
  게다가 배 둘레는 부드러운 그림자라 경사 규칙에도 걸리지 않아, 한 번 새어 들면
  배가 통째로 지워졌다.
  가르는 단서는 **색온도**다. 배경은 하늘색 글로우가 옅어진 것이라 차갑고(B ≥ R),
  몸통 흰색은 분홍이 섞여 따뜻하다(소라핑 배는 R 이 B 보다 3~19 높다).
  그래서 거의 흰 픽셀은 차가울 때만 배경으로 본다.

사용법: python3 tools/strip-heart-bg.py [--apply]
"""
import sys, os, colorsys
from collections import deque
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import feather

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TARGETS = ["bangulping", "chalrangping", "soraping"]
GRADIENT = 3          # 이웃과 이만큼 넘게 차이 나면 경계로 보고 멈춘다
SPARKLE = 0.004       # 이 비율보다 작은 푸른 덩어리는 반짝이로 보고 지운다

def looks_pale(px, x, y):
    r, g, b, a = px[x, y]
    if a < 20: return True
    H, S, V = colorsys.rgb_to_hsv(r/255, g/255, b/255)
    if V < 0.90 or S > 0.30: return False
    if 0.42 <= H <= 0.70: return True     # 연하늘색 글로우
    return S <= 0.06 and b >= r           # 거의 흰색이면 차가울 때만 배경

def glow_mask(im):
    """배경이면 0, 캐릭터면 255 인 이진 마스크."""
    w, h = im.size; px = im.load()
    mask = Image.new("L", (w, h), 255); mp = mask.load()
    seen = bytearray(w * h); dq = deque()
    def push(x, y):
        i = y * w + x
        if not seen[i] and looks_pale(px, x, y):
            seen[i] = 1; dq.append((x, y))
    for x in range(w): push(x, 0); push(x, h - 1)
    for y in range(h): push(0, y); push(w - 1, y)
    while dq:
        x, y = dq.popleft(); mp[x, y] = 0
        c = px[x, y]
        for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
            nx, ny = x + dx, y + dy
            if not (0 <= nx < w and 0 <= ny < h): continue
            n = px[nx, ny]
            if max(abs(c[0]-n[0]), abs(c[1]-n[1]), abs(c[2]-n[2])) > GRADIENT:
                continue                       # 급격한 경계 → 캐릭터다, 멈춘다
            push(nx, ny)
    return mask

def drop_sparkles(mask, im):
    """배경 반짝이 제거.

    반짝이는 연파랑에 흰 중심이라 색 규칙으로는 잘 안 걸린다.
    대신 **캐릭터에서 떨어져 있다**는 점을 쓴다. 캐릭터는 하나의 큰 덩어리이고
    반짝이는 그와 이어지지 않은 작은 조각이므로, 가장 큰 덩어리의 5% 에
    못 미치는 조각은 지운다. (남겨 두면 캔버스만 커져 캐릭터가 작아 보인다)
    """
    w, h = mask.size; mp = mask.load()
    seen = bytearray(w * h); comps = []
    for sx in range(w):
        for sy in range(h):
            if seen[sy*w+sx] or mp[sx, sy] == 0: continue
            comp = []; q = deque([(sx, sy)]); seen[sy*w+sx] = 1
            while q:
                x, y = q.popleft(); comp.append((x, y))
                for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and mp[nx, ny]:
                        seen[ny*w+nx] = 1; q.append((nx, ny))
            comps.append(comp)
    if not comps: return mask
    biggest = max(len(c) for c in comps)
    for c in comps:
        if len(c) < biggest * 0.05:
            for x, y in c: mp[x, y] = 0
    return mask

def strip(path, out):
    im = Image.open(path).convert("RGBA")
    mask = drop_sparkles(glow_mask(im), im)
    im.putalpha(feather(mask))
    im.save(out, "PNG")
    hist = im.getchannel("A").histogram()
    return sum(hist[20:]) / (im.size[0] * im.size[1])

def main():
    apply = "--apply" in sys.argv
    for k in TARGETS:
        src = os.path.join(ROOT, "images", k + ".png")
        dst = src if apply else f"/tmp/bgfix/{k}.png"
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        print(f"{k:14} 남은 내용 {strip(src, dst)*100:.0f}%  → {dst}")
    print("적용됨" if apply else "미리보기 (적용하려면 --apply)")

if __name__ == "__main__":
    main()
