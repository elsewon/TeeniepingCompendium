#!/usr/bin/env python3
"""카드에서 캐릭터가 비슷한 크기로 보이도록 균형을 맞춘다.

normalize-images.py 는 '경계 상자'를 캔버스의 90% 로 맞춘다. 그런데 경계
상자가 같아도 그림에 따라 실제 차지하는 면적은 다르다.
  - 다이아 하츄핑: 몸이 꽉 찬 구도 → 면적 56%  → 커 보인다
  - 스타 하츄핑  : 머리카락이 넓게 퍼짐 → 면적 48% → 작아 보인다

그래서 여기서는 **보이는 픽셀 면적**이 캔버스의 일정 비율이 되도록
캔버스 크기를 정한다. 그림 자체는 건드리지 않고 여백만 조절하므로
화질 손상이 없다.

다만 면적만 따지면 성긴 그림은 캔버스가 너무 작아져 경계 상자가 잘린다.
그래서 '경계 상자가 캔버스의 92% 를 넘지 않는다'는 조건을 함께 두고,
둘 중 더 큰 캔버스를 고른다.

사용법:
  python3 tools/balance-size.py            # 미리보기
  python3 tools/balance-size.py --apply
"""
import sys, os, glob, shutil, datetime, statistics
from PIL import Image
import importlib.util

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMG_DIR = os.path.join(ROOT, "images")
TARGET_AREA = 0.40     # 보이는 픽셀이 캔버스에서 차지할 비율
MAX_BBOX = 0.99        # 경계 상자가 캔버스에서 차지할 상한
# MAX_BBOX 를 0.92 로 두면 라라핑처럼 머리카락이 넓게 퍼진 그림에 여백이 강제로 붙어
# 오히려 더 작아진다(면적 36%→31%). 이런 그림은 테두리를 꽉 채워도 칠해진 면적이
# 적어서, 여백을 주면 작아 보이기만 한다. 0.99 로 두면 성긴 그림은 지금 크기를
# 유지하고 꽉 찬 그림만 목표치까지 내려와 전체 편차가 좁아진다.

_spec = importlib.util.spec_from_file_location(
    "norm", os.path.join(ROOT, "tools/normalize-images.py"))
norm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(norm)

def balance(path, apply):
    im = Image.open(path).convert("RGBA")
    box, bg = norm.content_bbox(im)
    if not box:
        return None
    c = im.crop(box)
    cw, ch = c.size
    # '보이는 픽셀' 세기.
    # 투명 배경이면 알파로 세면 되지만, 흰 배경(불투명) 이미지는 알파가 전부
    # 255 라 캔버스 전체가 내용으로 잡힌다. 그 경우 배경색과 다른 픽셀만 센다.
    if bg is None:
        visible = sum(1 for v in c.getchannel("A").tobytes() if v >= 20)
    else:
        br, bgc, bb = bg
        visible = sum(
            1 for (r, g, b, a) in c.convert("RGBA").getdata()
            if a >= 20 and (abs(r-br) > 12 or abs(g-bgc) > 12 or abs(b-bb) > 12)
        )
    side_area = (visible / TARGET_AREA) ** 0.5      # 면적 기준
    side_bbox = max(cw, ch) / MAX_BBOX              # 잘림 방지 기준
    side = int(max(side_area, side_bbox))
    canvas = Image.new("RGBA", (side, side), (bg + (255,)) if bg else (0, 0, 0, 0))
    # 주의: canvas.paste(im, pos, im) 처럼 자기 자신을 마스크로 넘기면 알파가 제곱되어
    # 안티앨리어싱된 가장자리가 뭉개진다(알파 200→157, 128→64). 반복 적용하면 윤곽이
    # 계단처럼 깨진다. 투명 배경에는 마스크 없이 복사하고, 배경색이 있으면 합성한다.
    if bg:
        canvas.alpha_composite(c, ((side - cw) // 2, (side - ch) // 2))
    else:
        canvas.paste(c, ((side - cw) // 2, (side - ch) // 2))
    before = visible / (im.size[0] * im.size[1])
    after = visible / (side * side)
    if apply:
        canvas.save(path, "PNG")
    return before, after, side_area >= side_bbox

def main():
    apply = "--apply" in sys.argv
    if apply:
        bk = f"/tmp/images-backup-balance-{datetime.datetime.now():%H%M%S}"
        shutil.copytree(IMG_DIR, bk)
        print(f"백업: {bk}\n")
    befores, afters, limited = [], [], 0
    for f in sorted(glob.glob(os.path.join(IMG_DIR, "*.png"))):
        r = balance(f, apply)
        if not r:
            continue
        b, a, by_area = r
        befores.append(b); afters.append(a)
        if not by_area:
            limited += 1
    print(f"{'적용' if apply else '미리보기'} {len(befores)}장")
    print(f"  이전 면적: 평균 {statistics.mean(befores)*100:.0f}%"
          f" · 최소 {min(befores)*100:.0f}% · 최대 {max(befores)*100:.0f}%")
    print(f"  이후 면적: 평균 {statistics.mean(afters)*100:.0f}%"
          f" · 최소 {min(afters)*100:.0f}% · 최대 {max(afters)*100:.0f}%")
    print(f"  잘림 방지 조건이 적용된 장수: {limited}")

if __name__ == "__main__":
    main()
