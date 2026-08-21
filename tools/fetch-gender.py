#!/usr/bin/env python3
"""나무위키 문서 정보상자에서 성별을 수집해 tools/gender.json 으로 저장한다.

정보상자에 "성별 | 여성" 같은 행이 있어 태그를 지우고 첫 항목을 읽으면 된다.

주의:
  - 형제·자매(아롱핑&다롱핑 등)와 하츄핑 계열은 문서를 공유하므로
    같은 값이 나온다. 실제로 성별이 같으면 문제없지만 값은 확인이 필요하다.
  - 값이 '불명', '없음' 처럼 애매하면 그대로 남겨 두고 사이트에서는 표시하지 않는다.

사용법: python3 tools/fetch-gender.py
"""
import json, os, re, time, urllib.request, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")

def names():
    src = open(os.path.join(ROOT, "data/teeniepings.js"), encoding="utf-8").read()
    data = json.loads(src[src.index("["):src.rindex("]") + 1])
    return [t["nameKo"] for t in data]

def gender_of(name):
    url = "https://namu.wiki/w/" + urllib.parse.quote(name)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
    text = re.sub(r"\|+", "|", re.sub(r"<[^>]+>", "|", html))
    # "성별|여성" 이 기본이지만, 쌍둥이 문서는
    # "성별|커핑/머핑:|남성/여성" 처럼 이름 안내가 한 칸 끼어든다.
    m = re.search(r"성별\|([^|]{1,14})(?:\|([^|]{1,14}))?", text)
    if not m:
        return None
    first = m.group(1).strip()
    if first.endswith(":") or "/" in first:      # 이름 안내 칸이면 다음 칸이 값
        return (m.group(2) or "").strip() or None
    return first

def main():
    out = {}
    for i, n in enumerate(names(), 1):
        try:
            g = gender_of(n)
        except Exception as e:
            g = None
            print(f"⚠️  {n}: {e}")
        if g:
            out[n] = g
        print(f"[{i:3}] {n:14} {g or '못 찾음'}")
        time.sleep(0.35)
    path = os.path.join(ROOT, "tools/gender.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    from collections import Counter
    print("\n분포:", dict(Counter(out.values())))
    print(f"수집 {len(out)}건 → {path}")

if __name__ == "__main__":
    main()
