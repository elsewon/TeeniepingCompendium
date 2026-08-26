#!/usr/bin/env python3
"""고른 후보 그림을 도감에 반영한다.

    python3 tools/apply-candidate.py <id> <원본파일> [--dry] [--no-punch]

거치는 차례는 넷이고, **크기 조절은 맨 마지막 한 번뿐이다.**
  1) 오려내기        cutout — 원본 해상도 그대로. JPEG 원본은 경계에 압축 링잉이
                     남아 흰 테두리로 비치므로 bleed 로 안쪽 색을 번지게 해 덮는다
  2) 구멍 뚫기        punch_like — 활 안쪽처럼 갇힌 배경을 지금 그림을 자로 삼아 뚫는다.
                     --no-punch 로 끌 수 있다. 지금 그림 쪽이 틀린 경우가 있다 —
                     모야핑 돋보기 렌즈는 유리라 채워져 있어야 하는데 지금 그림에서
                     비어 있어, 그대로 두면 후보에서도 뚫려 버린다
  3) 여백 균형        balance-size — 카드에서 다른 마리와 같은 크기로 보이게
  4) 512 로 축소      여기서 딱 한 번. 1~3 을 원본 해상도에서 끝내야 윤곽이 매끈하다
     (512 로 먼저 줄여 놓고 오려내면 가장자리가 거칠어진다)

썸네일(400px webp)과 og 카드도 함께 다시 만든다.
"""
import importlib.util
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from cutout import cutout, punch_like

FULL_MAX, THUMB_MAX = 512, 400        # tools/make-thumbs.py 와 같은 값


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, path))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def charpx(path):
    im = Image.open(path).convert("RGBA")
    b = im.getchannel("A").getbbox()
    return max(b[2] - b[0], b[3] - b[1]) if b else 0


def apply(pid, src, dry=False, punch=True):
    dst = os.path.join(ROOT, "images", pid + ".png")
    if not os.path.exists(dst):
        sys.exit(f"도감에 없는 id: {pid}")
    before = charpx(dst)
    ref = Image.open(dst).convert("RGBA")

    im = cutout(Image.open(src), bleed=3)              # ① 오려내기 (+가장자리 색 번짐)
    if punch:
        im, report = punch_like(im, ref)               # ② 구멍 뚫기
        for n, share, done in report:
            print(f"   구멍 {n:5d}px · 지금 그림에서 빈 비율 {share*100:3.0f}% → "
                  f"{'뚫음' if done else '그대로 둠'}")
    else:
        print("   구멍 뚫기 건너뜀 (--no-punch)")

    out = dst if not dry else "/tmp/apply-preview.png"
    im.save(out, "PNG")
    _load("bal", "tools/balance-size.py").balance(out, True)   # ③ 여백 균형
    im = Image.open(out).convert("RGBA")
    if max(im.size) > FULL_MAX:                        # ④ 축소 — 여기 한 번뿐
        im.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
        im.save(out, "PNG")
    print(f"   캐릭터 {before}px → {charpx(out)}px · 캔버스 {im.size}")
    if dry:
        print(f"   미리보기: {out} (반영하지 않음)")
        return

    t = im.copy()
    t.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
    t.save(os.path.join(ROOT, "images", "thumb", pid + ".webp"), "WEBP", quality=86, method=6)

    og = _load("og", "tools/build-og.py")
    e = next(x for x in og.load_data() if x["id"] == pid)
    tags = [(e["season"], "season"), (e["grade"], e["grade"])]
    if e.get("gender"):
        tags.append((e["gender"], e["gender"]))
    og.build_card(dst, e["nameKo"], tags, os.path.join(ROOT, "images", "og", pid + ".jpg"))
    print(f"   images/{pid}.png · thumb/{pid}.webp · og/{pid}.jpg 갱신")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit(__doc__)
    apply(args[0], args[1], dry="--dry" in sys.argv, punch="--no-punch" not in sys.argv)
