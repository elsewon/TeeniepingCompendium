#!/usr/bin/env python3
"""목록 카드용 썸네일 생성 + 원본 크기 상한 적용.

목록 페이지는 157장을 한꺼번에 불러온다. 상세용 고해상도를 그대로 쓰면
수십 MB 를 전송하게 되므로, 카드에는 작은 썸네일을 따로 쓴다.

  images/<id>.png         상세·퀴즈용 (최대 512px, PNG)
  images/thumb/<id>.webp  목록 카드용 (최대 400px, WebP)

표시 크기는 상세 320px · 카드 250px 정도라, 각각 512px / 400px 면 레티나에서도 충분하다.
썸네일은 157장을 한 번에 불러오므로 용량이 중요해 WebP 로 저장한다
(PNG 대비 1/5 수준이며 모든 최신 브라우저가 지원한다).

사용법: python3 tools/make-thumbs.py
"""
import os, glob
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMG = os.path.join(ROOT, "images")
THUMB = os.path.join(IMG, "thumb")
FULL_MAX, THUMB_MAX = 512, 400

os.makedirs(THUMB, exist_ok=True)
shrunk = 0
for f in sorted(glob.glob(os.path.join(IMG, "*.png"))):
    im = Image.open(f).convert("RGBA")
    if max(im.size) > FULL_MAX:                 # 원본이 과하게 크면 줄인다
        im.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
        im.save(f, "PNG")
        shrunk += 1
    t = im.copy()
    t.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
    name = os.path.splitext(os.path.basename(f))[0] + ".webp"
    t.save(os.path.join(THUMB, name), "WEBP", quality=86, method=6)

def size_of(p, ext="*.png"):
    return sum(os.path.getsize(x) for x in glob.glob(os.path.join(p, ext))) / 1024 / 1024

print(f"원본 축소 {shrunk}장 (상한 {FULL_MAX}px)")
print(f"  images/       {size_of(IMG):5.1f} MB")
print(f"  images/thumb/ {size_of(THUMB, '*.webp'):5.1f} MB")
