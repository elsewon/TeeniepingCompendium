#!/usr/bin/env python3
"""낱말 풀이 그림 — tools/glossary.js 의 img 를 받아 images/glossary/<id>.webp 로 자른다.

개별 페이지 '📝 낱말 풀이' 칸의 작은 그림이다(표시 56px, 레티나를 생각해 112px로 만든다).
원본은 나무위키 대표 그림이라 모양이 제각각이다 — 장면을 캡처한 16:9 그림, 흰 바탕의 전신,
변신 장면 캡처. 그래서 사람이 있으면 얼굴을 찾아 그 둘레를 자른다(tools/face-box.swift,
Apple Vision). 얼굴을 못 찾으면 눈길이 가는 곳(attention)을, 그것도 없으면 가운데를 자른다.
그래도 어긋나면 glossary.js 의 crop 에 [왼쪽, 위, 한 변] 비율을 적는다.

받은 원본은 /tmp/glossary-src 에 쌓아 두고 다시 받지 않는다(--force 로 다시 받는다).
결과가 그대로인 파일은 쓰지 않는다 — iCloud 가 손댄 파일을 통째로 다시 올리기 때문이다.

사용법: python3 tools/make-glossary-images.py [--force]
"""
import io
import json
import os
import subprocess
import sys
import time
import urllib.request

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "images", "glossary")
CACHE = "/tmp/glossary-src"
SIZE = 112
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")


def load_glossary():
    """glossary.js 는 window.GLOSSARY = [...] 꼴이라 node 로 풀어 JSON 으로 받는다."""
    js = ("const w={};new Function('window',require('fs').readFileSync(process.argv[1],'utf8'))(w);"
          "process.stdout.write(JSON.stringify(w.GLOSSARY))")
    raw = subprocess.check_output(["node", "-e", js, os.path.join(ROOT, "tools", "glossary.js")])
    return json.loads(raw)


def download(entry, force):
    path = os.path.join(CACHE, entry["id"])
    if not force and os.path.exists(path):
        return path
    req = urllib.request.Request(entry["img"], headers={"User-Agent": UA, "Referer": "https://namu.wiki/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    time.sleep(0.4)
    return path


def detect(paths):
    """Apple Vision 으로 얼굴·눈길 영역을 찾는다. 맥이 아니면 빈 결과로 넘어간다(가운데를 자른다)."""
    pngs = []
    for p in paths:                                   # Vision 이 webp 를 못 읽는 판이 있어 png 로 넘긴다
        q = p + ".png"
        Image.open(p).save(q)
        pngs.append(q)
    try:
        out = subprocess.check_output(["swift", os.path.join(ROOT, "tools", "face-box.swift"), *pngs])
    except (OSError, subprocess.CalledProcessError) as e:
        print(f"  얼굴 찾기를 건너뜀 ({e})")
        return {}
    found = {}
    for line in out.decode().splitlines():
        r = json.loads(line)
        found[r["file"][:-4]] = r
    return found


def square(im, entry, det):
    """자를 정사각형 (왼쪽, 위, 한 변) — 픽셀"""
    W, H = im.size
    if entry.get("crop"):
        x, y, s = entry["crop"]
        return x * W, y * H, s * W
    faces = (det or {}).get("faces") or []
    if faces:
        # 가장 큰 얼굴. 감지기 상자는 눈썹~턱이라 머리카락까지 넣으려고 넉넉히 키우고 조금 위로 올린다
        fx, fy, fw, fh, _ = max(faces, key=lambda f: f[2] * f[3] * f[4])
        side = max(fw * W, fh * H) * 2.4
        cx, cy = (fx + fw / 2) * W, (fy + fh * 0.4) * H
        return cx - side / 2, cy - side / 2, side
    att = (det or {}).get("attention") or []
    if att:
        ax, ay, aw, ah = max(att, key=lambda a: a[2] * a[3])
        ax, ay, aw, ah = ax * W, ay * H, aw * W, ah * H
        side = min(aw, ah)
        top = ay if ah > aw else ay + (ah - side) / 2  # 세로로 길면(전신) 위쪽, 아니면 가운데
        return ax + (aw - side) / 2, top, side
    side = min(W, H)
    return (W - side) / 2, (H - side) / 2, side


def clamp(x, y, s, W, H):
    s = min(s, W, H)
    x = min(max(x, 0), W - s)
    y = min(max(y, 0), H - s)
    return x, y, s


def main():
    force = "--force" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    entries = [e for e in load_glossary() if e.get("img")]
    paths = {}
    for e in entries:
        try:
            paths[e["id"]] = download(e, force)
        except Exception as err:                       # 하나 못 받아도 나머지는 만든다
            print(f"  받기 실패 {e['id']}: {err}")
    found = detect(list(paths.values()))

    written = 0
    keep = set()
    for e in entries:
        if e["id"] not in paths:
            continue
        im = Image.open(paths[e["id"]]).convert("RGBA")
        x, y, s = clamp(*square(im, e, found.get(paths[e["id"]])), *im.size)
        out = im.crop((round(x), round(y), round(x + s), round(y + s))).resize((SIZE, SIZE), Image.LANCZOS)
        buf = io.BytesIO()
        out.save(buf, "WEBP", quality=86, method=6)
        file = os.path.join(OUT, e["id"] + ".webp")
        keep.add(e["id"] + ".webp")
        old = open(file, "rb").read() if os.path.exists(file) else None
        if old != buf.getvalue():
            with open(file, "wb") as f:
                f.write(buf.getvalue())
            written += 1

    stale = [f for f in os.listdir(OUT) if f.endswith(".webp") and f not in keep]
    for f in stale:
        os.remove(os.path.join(OUT, f))
    print(f"낱말 풀이 그림 {len(keep)}장 → images/glossary/ (새로 쓴 것 {written}장)"
          + (f", 목록에 없어 지운 것 {len(stale)}장" if stale else ""))


if __name__ == "__main__":
    main()
