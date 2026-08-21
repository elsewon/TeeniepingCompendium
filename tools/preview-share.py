# -*- coding: utf-8 -*-
"""메신저에 공유했을 때의 카드 모양을 미리 그려 본다.

    python3 tools/preview-share.py [출력파일]

각 페이지의 og 태그(제목·설명·이미지)를 실제로 읽어와, 카카오톡·슬랙류의
링크 카드 배치로 그린다. 배포 전에 확인하려고 만든 도구다 —
실제 렌더링은 앱마다 조금씩 다르므로 근사치로 보면 된다.
"""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
BOLD, REG = 6, 0
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "share-preview.png")

BUBBLE = 620                      # 카드 폭 (실제 앱의 약 2배 크기로 그려 잘 보이게)
IMG_H = round(BUBBLE / 1.91)      # og 표준 비율로 잘리는 높이
PAGES = [("목록 페이지", "index.html"), ("이름 맞추기", "quiz.html"),
         ("개별 페이지", "p/heartsping.html")]


def font(sz, face=BOLD):
    return ImageFont.truetype(FONT, sz, index=face)


def og(html, prop):
    m = re.search(rf'<meta property="og:{prop}" content="([^"]*)"', html)
    return m.group(1) if m else ""


def wrap(draw, text, f, width, max_lines):
    """글자 단위 줄바꿈 (한글은 단어 경계가 애매해 글자 기준이 안전하다)"""
    lines, cur = [], ""
    for ch in text:
        if draw.textlength(cur + ch, font=f) > width:
            lines.append(cur); cur = ch
            if len(lines) == max_lines:
                break
        else:
            cur += ch
    if len(lines) < max_lines and cur:
        lines.append(cur)
    if len(lines) == max_lines and draw.textlength(lines[-1], font=f) > width - 20:
        lines[-1] = lines[-1][:-1] + "…"
    return lines


def card(label, path):
    html = open(os.path.join(ROOT, path), encoding="utf-8").read()
    title, desc = og(html, "title"), og(html, "description")
    img_url = og(html, "image")
    local = os.path.join(ROOT, "images", "og", os.path.basename(img_url))

    head = 34
    body_pad = 16
    f_t, f_d, f_u = font(21, BOLD), font(18, REG), font(15, REG)
    tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    t_lines = wrap(tmp, title, f_t, BUBBLE - body_pad*2, 2)
    d_lines = wrap(tmp, desc, f_d, BUBBLE - body_pad*2, 2)
    body_h = body_pad + len(t_lines)*28 + 6 + len(d_lines)*25 + 8 + 20 + body_pad
    H = head + IMG_H + body_h

    c = Image.new("RGB", (BUBBLE, H), (255, 255, 255))
    d = ImageDraw.Draw(c)
    d.rectangle([0, 0, BUBBLE, head], fill=(247, 245, 248))
    d.text((body_pad, 8), label, font=font(17, BOLD), fill=(120, 110, 125))

    # og:image 를 카드 폭에 맞춰 넣는다 (앱은 가운데를 기준으로 잘라 보여 준다)
    if os.path.exists(local):
        im = Image.open(local).convert("RGB")
        s = BUBBLE / im.width
        im = im.resize((BUBBLE, round(im.height * s)), Image.LANCZOS)
        off = max(0, (im.height - IMG_H) // 2)
        c.paste(im.crop((0, off, BUBBLE, off + IMG_H)), (0, head))
    else:
        d.rectangle([0, head, BUBBLE, head+IMG_H], fill=(235, 232, 238))
        d.text((body_pad, head+20), "이미지 없음", font=f_d, fill=(150, 140, 155))

    y = head + IMG_H + body_pad
    for ln in t_lines:
        d.text((body_pad, y), ln, font=f_t, fill=(28, 26, 30)); y += 28
    y += 6
    for ln in d_lines:
        d.text((body_pad, y), ln, font=f_d, fill=(122, 118, 128)); y += 25
    y += 8
    host = re.sub(r"^https?://([^/]+).*", r"\1", img_url) or "elsewon.github.io"
    d.text((body_pad, y), host, font=f_u, fill=(160, 155, 165))
    d.rectangle([0, 0, BUBBLE-1, H-1], outline=(225, 220, 228))
    return c


def main():
    cards = [card(label, path) for label, path in PAGES]
    gap, margin = 28, 36
    W = margin*2 + sum(c.width for c in cards) + gap*(len(cards)-1)
    H = margin*2 + max(c.height for c in cards) + 44
    sheet = Image.new("RGB", (W, H), (232, 228, 235))
    d = ImageDraw.Draw(sheet)
    d.text((margin, 18), "메신저 공유 미리보기 (실제 앱마다 조금씩 다름)",
           font=font(22, BOLD), fill=(90, 82, 96))
    x = margin
    for c in cards:
        sheet.paste(c, (x, margin + 44)); x += c.width + gap
    sheet.save(OUT)
    print(f"미리보기 저장 → {OUT}")


if __name__ == "__main__":
    main()
