#!/usr/bin/env python3
"""이미지 정규화 — 카드마다 캐릭터 크기가 들쭉날쭉한 문제를 잡는다.

원인 두 가지:
  1) 가로세로 비율이 제각각이라 정사각 카드에서 위아래(또는 좌우)가 남는다.
  2) 원본 그림마다 캐릭터 주변 여백이 달라, 같은 카드 안에서도
     어떤 캐릭터는 60%만, 어떤 캐릭터는 100%를 차지한다.

처리:
  배경을 찾아 잘라내고(trim), 캐릭터가 일정 비율을 차지하도록
  정사각 캔버스 가운데에 다시 배치한다.

배경 판정은 '흰색'이 아니라 **모서리에서 시작한 flood fill** 로 한다.
뽀송핑(흰 양)처럼 캐릭터 자체가 흰색인 경우 흰색을 배경으로 보면
몸통이 잘려 나가기 때문이다.

사용법:
  python3 tools/normalize-images.py            # 미리보기(변경 없음)
  python3 tools/normalize-images.py --apply    # 실제 적용
"""
import sys, os, glob, shutil, datetime
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMG_DIR = os.path.join(ROOT, "images")
TARGET_OCCUPY = 0.90        # 캐릭터가 정사각 변의 90% 를 차지하도록
TOLERANCE = 18              # 배경 flood fill 허용 색차

def content_bbox(im):
    """배경(모서리에서 연결된 영역)을 제외한 캐릭터 경계 상자."""
    w, h = im.size
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] < 250:          # 투명 배경 이미지
        # im.getbbox() 를 쓰면 안 된다. RGBA 에서는 알파가 0 이어도
        # RGB 값이 남아 있으면 '내용'으로 보기 때문에, 눈에 보이지 않는
        # 투명 여백까지 포함해 경계 상자가 실제보다 커진다.
        # 실제로 보이는 영역은 알파 채널만으로 판단해야 한다.
        return alpha.getbbox(), None

    # 불투명 이미지 → 모서리에서 flood fill 로 배경을 지운다
    rgb = im.convert("RGB")
    mask = rgb.copy()
    bg = mask.getpixel((0, 0))
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        try:
            ImageDraw.floodfill(mask, corner, (255, 0, 255), thresh=TOLERANCE)
        except Exception:
            pass
    # 마젠타로 칠해진 곳이 배경
    px = mask.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y] != (255, 0, 255):
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx < 0:
        return None, bg
    return (minx, miny, maxx + 1, maxy + 1), bg

def normalize(path, apply):
    im = Image.open(path).convert("RGBA")
    box, bg = content_bbox(im)
    if not box:
        return None
    cropped = im.crop(box)
    cw, ch = cropped.size
    side = int(max(cw, ch) / TARGET_OCCUPY)
    canvas = Image.new("RGBA", (side, side), (bg + (255,)) if bg else (0, 0, 0, 0))
    # 주의: canvas.paste(im, pos, im) 처럼 자기 자신을 마스크로 넘기면 알파가 제곱되어
    # 안티앨리어싱된 가장자리가 뭉개진다(알파 200→157, 128→64). 반복 적용하면 윤곽이
    # 계단처럼 깨진다. 투명 배경에는 마스크 없이 복사하고, 배경색이 있으면 합성한다.
    if bg:
        canvas.alpha_composite(cropped, ((side - cw) // 2, (side - ch) // 2))
    else:
        canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2))
    before = max(cw, ch) / max(im.size)
    if apply:
        canvas.save(path, "PNG")
    return before

def main():
    apply = "--apply" in sys.argv
    files = sorted(glob.glob(os.path.join(IMG_DIR, "*.png")))
    if apply:
        bk = f"/tmp/images-backup-normalize-{datetime.datetime.now():%H%M%S}"
        shutil.copytree(IMG_DIR, bk)
        print(f"백업: {bk}\n")
    befores = []
    for f in files:
        b = normalize(f, apply)
        if b is None:
            print(f"⚠️  건너뜀: {os.path.basename(f)}")
            continue
        befores.append(b)
    if befores:
        print(f"{'적용' if apply else '미리보기'} {len(befores)}장")
        print(f"  이전 캐릭터 점유율: 평균 {sum(befores)/len(befores)*100:.0f}%"
              f" · 최소 {min(befores)*100:.0f}% · 최대 {max(befores)*100:.0f}%")
        print(f"  이후: 전부 {TARGET_OCCUPY*100:.0f}% 로 통일")

if __name__ == "__main__":
    main()
