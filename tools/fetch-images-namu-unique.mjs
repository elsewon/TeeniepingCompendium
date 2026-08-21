#!/usr/bin/env node
/* ===== 나무위키 2차 수집: '문서 고유 이미지' 방식 =====
 *
 * 마이너 캐릭터는 이미지 alt 가 "무제63 20241004215..." 처럼 무의미해서
 * 이름으로 찾을 수 없다. 대신 구조적 신호를 쓴다:
 *
 *   나무위키 캐릭터 문서에는 (1) 시즌 네비게이션 틀의 공용 이미지들과
 *   (2) 그 캐릭터 본인의 프로필 이미지가 함께 실린다.
 *   공용 이미지는 여러 문서에 반복 등장하지만, 본인 이미지는 그 문서에만 있다.
 *   → 여러 문서를 모아 URL 등장 횟수를 세고, '그 문서에만 있는' 이미지를 고른다.
 *
 * 안전장치: 후보가 정확히 1개일 때만 채택한다. 2개 이상이면 누구 것인지
 *           확신할 수 없으므로 건너뛴다(잘못된 이미지를 넣지 않기 위해).
 *
 * 실행: node tools/fetch-images-namu-unique.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "images");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadData() {
  const win = {};
  new Function("window", fs.readFileSync(path.join(ROOT, "data/teeniepings.js"), "utf8"))(win);
  return win.TEENIEPINGS || [];
}

async function getPage(title) {
  const res = await fetch("https://namu.wiki/w/" + encodeURIComponent(title), {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

/* 문서의 이미지 목록 (중복 제거, 문서 내 등장 순서 유지) */
function pageImages(html) {
  const out = [];
  const seen = new Set();
  const re = /<img[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    // 나무위키는 이미지를 지연 로딩한다: 실제 URL 은 src 가 아니라 data-src 에 있고
    // src 에는 자리표시용 data:image/svg+xml 이 들어간다.
    const s = /data-src='(\/\/i\.namu\.wiki\/i\/[^']+)'/.exec(tag)
           || /[^-]src='(\/\/i\.namu\.wiki\/i\/[^']+)'/.exec(tag);
    if (!s) continue;
    const a = /alt='([^']*)'/.exec(tag);
    const alt = a ? a[1] : "";
    if (/로고|logo|국기|flag/i.test(alt)) continue;
    const url = "https:" + s[1];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, alt });
  }
  return out;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://namu.wiki/" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1200) throw new Error("too small");
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  const list = loadData();

  // --only <파일>: 파일에 적힌 한글 이름들만 대상으로 한다 (이미 이미지가 있어도 덮어씀).
  // 다른 출처의 이미지를 나무위키 것으로 교체할 때 사용.
  const onlyIdx = process.argv.indexOf("--only");
  let need;
  if (onlyIdx !== -1 && process.argv[onlyIdx + 1]) {
    const names = new Set(
      fs.readFileSync(process.argv[onlyIdx + 1], "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
    );
    need = list.filter((t) => names.has(t.nameKo));
    console.log(`지정된 ${need.length}마리 대상 (기존 이미지 덮어씀)\n`);
  } else {
    need = list.filter((t) => !fs.existsSync(path.join(IMG_DIR, t.id + ".png")));
    console.log(`이미지 없는 티니핑 ${need.length}마리\n`);
  }
  if (!need.length) return;

  // 1단계: 각 문서의 이미지 목록 수집
  console.log("── 1단계: 문서 수집 ──");
  const perPage = new Map();   // nameKo → [{url, alt}]
  for (const t of need) {
    try {
      const html = await getPage(t.nameKo);
      perPage.set(t.nameKo, pageImages(html));
      process.stdout.write(".");
    } catch (e) {
      console.log(`\n⚠️  ${t.nameKo}: ${e.message}`);
    }
    await sleep(600);
  }
  console.log(`\n수집 완료: ${perPage.size}개 문서`);

  // 2단계: URL 등장 횟수 (공용 네비게이션 이미지 걸러내기용)
  const freq = new Map();
  for (const imgs of perPage.values()) {
    for (const { url } of imgs) freq.set(url, (freq.get(url) || 0) + 1);
  }

  // 3단계: 문서 고유 이미지가 정확히 1개인 경우만 채택
  console.log("\n── 2단계: 고유 이미지 판정 ──");
  const picked = new Map();    // nameKo → url
  const ambiguous = [];
  const none = [];
  for (const t of need) {
    const imgs = perPage.get(t.nameKo);
    if (!imgs) { none.push(t.nameKo); continue; }
    const uniq = imgs.filter((i) => freq.get(i.url) === 1);
    if (uniq.length === 1) picked.set(t.nameKo, uniq[0].url);
    else if (uniq.length === 0) none.push(t.nameKo);
    else ambiguous.push(`${t.nameKo}(${uniq.length})`);
  }
  console.log(`채택 ${picked.size} · 후보 여럿이라 보류 ${ambiguous.length} · 후보 없음 ${none.length}`);
  if (ambiguous.length) console.log("보류:", ambiguous.join(", "));

  // 4단계: 내려받기
  console.log("\n── 3단계: 내려받기 ──");
  let ok = 0;
  for (const t of need) {
    const url = picked.get(t.nameKo);
    if (!url) continue;
    try {
      const bytes = await download(url, path.join(IMG_DIR, t.id + ".png"));
      console.log(`✅ ${t.nameKo} → images/${t.id}.png (${Math.round(bytes / 1024)}KB)`);
      ok++;
    } catch (e) {
      console.log(`⚠️  ${t.nameKo} — 다운로드 실패: ${e.message}`);
    }
    await sleep(200);
  }
  console.log(`\n완료: 성공 ${ok} / 대상 ${need.length}`);
}

main().catch((e) => { console.error("오류:", e); process.exit(1); });
