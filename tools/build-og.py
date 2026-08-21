# -*- coding: utf-8 -*-
"""메신저 미리보기(og:image)용 카드 이미지를 만든다.

    python3 tools/build-og.py

images/<id>.png (배경이 비어 있는 컷아웃) 을 그대로 og:image 로 쓰면
카카오톡 등에서 투명 부분이 검게 나올 수 있다. 그래서 사이트와 같은 분홍 배경에
목록 페이지의 카드를 그대로 크게 그린 1200x630 이미지를 images/og/ 에 만든다.

카드 모양·색·태그 배색은 css/styles.css 의 .card / .tag 규칙을 옮긴 것이다.
목록 디자인을 바꾸면 여기도 같이 맞춰야 한다.

캐릭터 카드 157장 + 메인(site) + 퀴즈(quiz) 카드를 만든다.
"""
import json
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "images", "og")

W, H = 1200, 630           # OG 표준 비율 (1.91:1)
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
BOLD = 6                   # .ttc 안의 굵기 인덱스 (Bold)
SEMI = 4                   # SemiBold

SIDE_PAD = 60              # 그림 좌우 바깥 여백
THUMB = 500                # 캐릭터가 놓이는 정사각 칸 (세로 가운데)
GUTTER = 60                # 캐릭터와 글자 사이 간격
NAME_TAG_GAP = 52          # 이름과 태그 줄 사이 간격
INK = (58, 43, 63)         # --ink
BG = (255, 245, 249)       # --bg
PINK_SOFT = (255, 215, 230)     # --pink-soft
PURPLE_SOFT = (233, 225, 255)   # --purple-soft

# css/styles.css 의 .tag 규칙 (배경색, 글자색)
TAG_STYLE = {
    "season":  ((188, 242, 240), (0, 114, 113)),    # .tag.season
    "로열":    ((240, 225, 200), (125, 95, 0)),
    "레전드":  ((251, 220, 205), (163, 73, 10)),
    "빌런":    ((229, 223, 249), (93, 86, 186)),
    "여성":    ((252, 209, 227), (172, 37, 113)),
    "남성":    ((199, 223, 254), (9, 99, 153)),
    "남매":    ((220, 237, 213), (36, 117, 20)),
    "default": ((242, 229, 232), (110, 99, 102)),   # .tag 기본값 (등급 '일반')
}


def font(size, face=BOLD):
    return ImageFont.truetype(FONT, size, index=face)


def load_data():
    """data/teeniepings.js 는 window.TEENIEPINGS = [...] 형태라 node 로 읽는다."""
    js = "global.window={};require('./data/teeniepings.js');" \
         "process.stdout.write(JSON.stringify(window.TEENIEPINGS));"
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))


def _radial(img, color, cx, cy, rx, ry, stop):
    """CSS 의 radial-gradient(<rx>px <ry>px at cx cy, color, transparent <stop>) 한 층.
       가운데에서 색이 꽉 찼다가 반지름의 stop 비율에서 완전히 투명해진다."""
    px = bytearray(W * H)
    for y in range(H):
        dy2 = ((y - cy) / ry) ** 2
        row = y * W
        for x in range(W):
            t = (((x - cx) / rx) ** 2 + dy2) ** 0.5
            if t < stop:
                px[row + x] = int(255 * (1 - t / stop))
    mask = Image.new("L", (W, H))
    mask.frombytes(bytes(px))
    img.paste(Image.new("RGB", (W, H), color), (0, 0), mask)


_BG_CACHE = None


def background():
    """css/styles.css 의 body 배경을 그대로 옮긴 것.

        background:
          radial-gradient(1200px 500px at 100% -10%, --purple-soft, transparent 60%),
          radial-gradient(1000px 500px at -10% 0%,  --pink-soft,   transparent 55%),
          --bg;

    CSS 는 먼저 적은 층이 위로 오므로 분홍을 먼저 깔고 보라를 덮는다.
    159장이 모두 같은 배경을 쓰니 한 번만 만들어 두고 복사해 쓴다."""
    global _BG_CACHE
    if _BG_CACHE is None:
        img = Image.new("RGB", (W, H), BG)
        _radial(img, PINK_SOFT, -0.10 * W, 0.0 * H, 1000, 500, 0.55)
        _radial(img, PURPLE_SOFT, 1.00 * W, -0.10 * H, 1200, 500, 0.60)
        _BG_CACHE = img
    return _BG_CACHE.copy()


def tag_row_width(items, size):
    """태그를 한 줄로 늘어놓았을 때의 전체 폭."""
    f = font(size)
    px, gap = round(size * 0.82), round(size * 0.45)
    total = -gap
    for text, _ in items:
        bb = f.getbbox(text)
        total += (bb[2] - bb[0]) + px * 2 + gap
    return total


def fit_tag_size(items, max_width, start=24, minimum=15):
    """태그가 한 줄에 들어갈 때까지 크기를 줄인다 (기수 이름이 긴 경우 대비)."""
    size = start
    while size > minimum and tag_row_width(items, size) > max_width:
        size -= 1
    return size


def draw_tags(img, x, y, items, size):
    """알약 모양 칩 — .tag { padding: 3px 9px; border-radius: 999px }"""
    d = ImageDraw.Draw(img)
    f = font(size)
    px, py = round(size * 0.82), round(size * 0.42)
    gap = round(size * 0.45)
    cx, height = x, 0
    for text, key in items:
        bg, fg = TAG_STYLE.get(key, TAG_STYLE["default"])
        bb = f.getbbox(text)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        w, h = tw + px * 2, th + py * 2
        d.rounded_rectangle([cx, y, cx + w, y + h], radius=h // 2, fill=bg)
        d.text((cx + px - bb[0], y + py - bb[1]), text, font=f, fill=fg)
        cx += w + gap
        height = h
    return height


def paste_thumb(img, png_path, box):
    """컷아웃 PNG 를 내용에 맞게 잘라 정사각 썸네일 칸에 넣는다.
       .card .thumb img { object-fit: contain } 과 같은 동작."""
    if not os.path.exists(png_path):
        return
    ch = Image.open(png_path).convert("RGBA")
    bbox = ch.getchannel("A").getbbox()      # 투명 여백 제거
    if bbox:
        ch = ch.crop(bbox)
    l, t, r, b = box
    bw, bh = r - l, b - t
    scale = min(bw / ch.width, bh / ch.height)
    ch = ch.resize((max(1, round(ch.width * scale)), max(1, round(ch.height * scale))),
                   Image.LANCZOS)
    img.paste(ch, (l + (bw - ch.width) // 2, t + (bh - ch.height) // 2), ch)


def build_card(png_path, name, tags, out_path):
    """개별 티니핑 og 이미지 — 분홍 배경 위에 왼쪽 캐릭터, 오른쪽 이름과 태그.

    세로 카드(썸네일 위 / 이름 아래)로도 만들어 봤지만, 1.91:1 인 og 규격에서는
    가운데 좁은 칸만 쓰게 되어 메신저에서 이름과 태그가 작게 보였다.
    흰 카드 틀도 빼서 캐릭터와 글자에 쓸 자리를 최대한 넓혔다."""
    img = background().convert("RGBA")

    # 왼쪽: 정사각 캐릭터 칸
    top = (H - THUMB) // 2
    paste_thumb(img, png_path, (SIDE_PAD, top, SIDE_PAD + THUMB, top + THUMB))

    # 오른쪽: 이름 + 태그 (아래 정렬 — 태그 밑선을 캐릭터 칸 밑선에 맞춘다)
    x = SIDE_PAD + THUMB + GUTTER
    avail = W - SIDE_PAD - x

    # 157마리 중 143마리가 3글자라, 상한을 넉넉히 두면 대다수가 크게 나온다.
    # 긴 이름(프린세스 하츄핑 등)은 폭에 걸려 자동으로 줄어든다.
    name_size = 148
    while name_size > 48 and font(name_size).getbbox(name)[2] > avail:
        name_size -= 2
    f_name = font(name_size)
    nb = f_name.getbbox(name)
    name_h = nb[3] - nb[1]

    tag_size = fit_tag_size(tags, avail, start=40, minimum=22)
    chip_h = round(tag_size * 0.42) * 2 + (font(tag_size).getbbox("가")[3]
                                           - font(tag_size).getbbox("가")[1])

    block_h = name_h + NAME_TAG_GAP + chip_h
    y = top + THUMB - block_h
    ImageDraw.Draw(img).text((x, y - nb[1]), name, font=f_name, fill=INK)
    draw_tags(img, x, y + name_h + NAME_TAG_GAP, tags, tag_size)

    img.convert("RGB").save(out_path, "JPEG", quality=88, optimize=True, progressive=True)


# ── 목록 페이지용 표지 ──────────────────────────────────
# 로열 티니핑이 모여 선 단체 사진 구도. 가운데가 가장 크고 낮게, 바깥으로 갈수록
# 작고 높게 두어 아치를 만든다. 뒷줄을 먼저 그려야 앞줄이 위로 겹친다.
#
# 개별 카드처럼 세로 카드 안에 넣어 봤지만, 메신저 카드에서 내용이 가로폭의
# 40% 밖에 차지하지 못해 캐릭터가 너무 작았다. 그래서 화면을 꽉 채우는 가로 구도로 둔다.
# (tools/preview-share.py 로 메신저에 보이는 모양을 미리 확인할 수 있다)
#
# 세 층으로 나눠 세운다. 층이 올라갈수록 작고 높게 두어 멀리 있는 것처럼 보이게 하고,
# 같은 층 안에서도 키를 조금씩 어긋나게 해 줄 세운 느낌을 없앤다.
# 뒤 → 앞 순서로 그려야 앞줄이 위로 겹친다.
# (id, 가로 중심 x, 발끝 y, 키)
# 층 안에서 발끝 높이와 키를 일부러 어긋나게 둔다. 좌우 대칭으로 맞추면
# 진열해 놓은 것처럼 보이는데, 티니핑은 떠 있는 설정이라 들쭉날쭉한 편이 자연스럽다.
COVER_TIERS = [
    # 맨 뒷줄 — 가장 작고 높이
    [("shashaping", 150, 212, 158), ("banjjakping", 372, 226, 172),
     ("chorongping", 598, 208, 164), ("areumping", 828, 222, 176),
     ("joaping", 1054, 210, 152)],
    # 가운뎃줄 — 뒷줄 사이사이로
    [("sappunping", 262, 318, 196), ("mideoping", 488, 332, 212),
     ("nanaping", 714, 314, 204), ("banggeulping", 938, 328, 216)],
    # 앞줄 — 가장 크고 낮게, 가운데가 주인공
    [("haeping", 140, 488, 236), ("chachaping", 366, 502, 258),
     ("heartsping", 600, 496, 280), ("baroping", 834, 508, 246),
     ("lalaping", 1060, 490, 250)],
]

COVER_TITLE = "티니핑 도감"
# 제목은 아래에 둔다. 앞줄 캐릭터의 아랫부분을 조금 덮지만 흰 테두리 덕에 묻히지 않는다.
# (제목이 위에 있던 시절의 좌표에서 무리 전체를 95px 올려 위쪽 빈 곳을 메웠다)
COVER_TITLE_Y = 500

TITLE_PINK = (196, 45, 106)      # 제목 글자
STAR_YELLOW = (255, 232, 120)


def paste_sprite(img, pid, cx, baseline, height):
    """캐릭터를 키(height)에 맞춰 세운다. 투명 여백은 잘라내고 발끝을 baseline 에 맞춘다."""
    path = os.path.join(ROOT, "images", pid + ".png")
    if not os.path.exists(path):
        return
    sp = Image.open(path).convert("RGBA")
    bbox = sp.getchannel("A").getbbox()
    if bbox:
        sp = sp.crop(bbox)
    scale = height / sp.height
    sp = sp.resize((max(1, round(sp.width * scale)), height), Image.LANCZOS)
    img.alpha_composite(sp, (round(cx - sp.width / 2), round(baseline - height)))


def draw_sparkle(d, cx, cy, r, fill):
    """네 갈래 반짝임"""
    k = r * 0.20
    d.polygon([(cx, cy-r), (cx+k, cy-k), (cx+r, cy), (cx+k, cy+k),
               (cx, cy+r), (cx-k, cy+k), (cx-r, cy), (cx-k, cy-k)], fill=fill)


def draw_cover_title(img, title, y):
    """가는 흰 테두리를 두른 제목 + 좌우 반짝임 장식"""
    d = ImageDraw.Draw(img)
    f = font(104)
    b = f.getbbox(title)
    tw = b[2] - b[0]
    x = (W - tw) / 2 - b[0]

    # 글자 아래 분홍빛 그림자 (테두리까지 포함해 흐리게 깔아 둔다)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + 7 - b[1]), title, font=f, fill=(214, 90, 140, 105),
                            stroke_width=6, stroke_fill=(214, 90, 140, 105))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9)))

    d.text((x, y - b[1]), title, font=f, fill=TITLE_PINK,
           stroke_width=5, stroke_fill=(255, 255, 255))

    left, right = (W - tw) / 2, (W + tw) / 2
    for side in (-1, 1):
        edge = left if side < 0 else right
        draw_sparkle(d, edge + side * 58, y + 30, 18, STAR_YELLOW)
        draw_sparkle(d, edge + side * 104, y - 8, 13, (255, 255, 255))


def build_cover(out_path, title=COVER_TITLE):
    """표지 og 이미지 — 로열 티니핑이 모여 있는 가로 구도. 제목만 바꿔 재사용한다
       (목록 페이지 = "티니핑 도감", 이름 맞추기 = "이름 맞추기")."""
    img = background().convert("RGBA")
    for tier in COVER_TIERS:
        for pid, cx, base, h in tier:
            paste_sprite(img, pid, cx, base, h)
    draw_cover_title(img, title, COVER_TITLE_Y)
    img.convert("RGB").save(out_path, "JPEG", quality=88, optimize=True, progressive=True)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    data = load_data()

    for t in data:
        tags = [(t["season"], "season"), (t["grade"], t["grade"])]
        if t.get("gender"):
            tags.append((t["gender"], t["gender"]))
        build_card(os.path.join(ROOT, "images", t["id"] + ".png"),
                   t["nameKo"], tags, os.path.join(OUT_DIR, t["id"] + ".jpg"))

    # 목록·퀴즈 페이지는 같은 표지를 쓰고 제목만 다르게 한다
    build_cover(os.path.join(OUT_DIR, "site.jpg"))
    build_cover(os.path.join(OUT_DIR, "quiz.jpg"), "이름 맞추기")

    print("카드 %d장 생성 → images/og/" % (len(data) + 2))


if __name__ == "__main__":
    main()
