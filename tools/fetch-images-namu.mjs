#!/usr/bin/env node
/* ===== 나무위키에서 티니핑 대표 이미지 수집 =====
 *
 * 나무위키 문서에는 시즌 전체 티니핑을 담은 네비게이션 틀이 들어 있고,
 * 각 <img> 의 alt 에 캐릭터 이름이 적혀 있다.
 *   예) alt='(티니핑5)스타하츄핑', alt='5기 노멀 깡총핑', alt='딩동핑 핼맷', alt='해핑'
 * 따라서 문서 몇 개만 받아도 수십 마리 이미지를 한 번에 수집할 수 있다.
 *
 * 매칭 규칙: alt 안에서 '…핑' 으로 끝나는 토큰을 모두 뽑아
 *            (일반명사 '티니핑' 류 제외) 가장 긴 것을 캐릭터명으로 본다.
 *            공백을 제거한 이름이 정확히 일치할 때만 채택 → 오매칭 방지.
 *
 * 실행:  node tools/fetch-images-namu.mjs           (없는 것만)
 *        node tools/fetch-images-namu.mjs --force    (덮어쓰기)
 *
 * ⚠️ 캐릭터 이미지 저작권은 SAMG엔터테인먼트에 있습니다. 개인용/로컬 용도로만 사용하세요.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "images");
const FORCE = process.argv.includes("--force");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 캐릭터명이 아닌 '…핑' 토큰 */
const GENERIC = new Set(["티니핑", "로열티니핑", "레전드티니핑", "감정티니핑", "보석티니핑", "열쇠티니핑", "디저트티니핑", "별티니핑"]);
const norm = (s) => s.replace(/\s+/g, "");

function loadData() {
  const win = {};
  new Function("window", fs.readFileSync(path.join(ROOT, "data/teeniepings.js"), "utf8"))(win);
  return win.TEENIEPINGS || [];
}

async function getPage(title) {
  const url = "https://namu.wiki/w/" + encodeURIComponent(title);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}

/* 영문 alt 매칭용: 영문자만 남겨 소문자화 (예: "FLORA-HEARTSPING" → "floraheartsping") */
const normEn = (s) => s.replace(/[^A-Za-z]/g, "").toLowerCase();

/* 문서 HTML → { 키: 이미지URL }.  키는 한글명(공백제거) 또는 영문명(소문자) */
function harvest(html) {
  const found = new Map();
  // 나무위키는 이미지를 지연 로딩한다: 실제 URL 은 data-src (src 는 자리표시용 data: URI)
  const re = /<img[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const s = /data-src='(\/\/i\.namu\.wiki\/i\/[^']+)'/.exec(tag)
           || /[^-]src='(\/\/i\.namu\.wiki\/i\/[^']+)'/.exec(tag);
    const a = /alt='([^']*)'/.exec(tag);
    if (!s || !a) continue;
    const alt = a[1];
    if (/로고|logo|국기|flag/i.test(alt)) continue;
    const url = "https:" + s[1];

    // 1) 한글 '…핑' 토큰
    const tokens = [...new Set((alt.match(/[가-힣A-Za-z0-9]+핑/g) || [])
      .map(norm).filter((t) => !GENERIC.has(t)))];
    // 여러 캐릭터가 함께 담긴 이미지(예: "노리핑 노라핑")는 누구 것인지 알 수 없어 건너뛴다
    if (tokens.length === 1) {
      if (!found.has(tokens[0])) found.set(tokens[0], url);
      continue;
    }
    if (tokens.length > 1) continue;

    // 2) 한글 이름이 없으면 영문 alt 로 매칭 (예: "FLORA-HEARTSPING", "Frogping Render 1")
    const en = normEn(alt);
    if (en.endsWith("ping") || en.includes("ping")) {
      // 'render', 'image' 등 꼬리말 제거 후 '…ping' 으로 끝나는 부분만 취함
      const mm = en.match(/^[a-z]*ping/);
      if (mm && mm[0].length > 4 && !found.has(mm[0])) found.set(mm[0], url);
    }
  }
  return found;
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
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const need = list.filter((t) => FORCE || !fs.existsSync(path.join(IMG_DIR, t.id + ".png")));
  console.log(`전체 ${list.length}마리 · 이미지 필요 ${need.length}마리\n`);
  if (!need.length) return;

  const pool = new Map();      // 정규화된 이름 → 이미지 URL
  const visited = new Set();

  async function visit(title, why) {
    if (visited.has(title)) return;
    visited.add(title);
    try {
      const html = await getPage(title);
      const got = harvest(html);
      let added = 0;
      for (const [k, v] of got) if (!pool.has(k)) { pool.set(k, v); added++; }
      console.log(`📄 ${title} (${why}) — 이미지 ${got.size}개 발견, 신규 ${added}개`);
    } catch (e) {
      console.log(`⚠️  ${title} 문서 실패: ${e.message}`);
    }
    await sleep(700);
  }

  // 1단계: 시즌별 대표 문서 — 한 문서에 시즌 전체 틀이 들어 있다
  const SEEDS = ["하츄핑", "방글핑", "나나핑", "새콤핑", "초롱핑", "사뿐핑", "티니핑"];
  console.log("── 1단계: 시즌 대표 문서에서 일괄 수집 ──");
  for (const s of SEEDS) await visit(s, "시드");

  // 2단계: 아직 못 찾은 캐릭터는 개별 문서 방문
  // 한글명 → 없으면 영문명으로 조회
  const lookup = (t) => pool.get(norm(t.nameKo)) || (t.nameEn ? pool.get(normEn(t.nameEn)) : null);
  const stillMissing = () => need.filter((t) => !lookup(t));
  const remaining = stillMissing();
  if (remaining.length) {
    console.log(`\n── 2단계: 미발견 ${remaining.length}마리 개별 문서 확인 ──`);
    for (const t of remaining) {
      if (lookup(t)) continue;   // 이전 방문에서 채워졌을 수 있음
      await visit(t.nameKo, t.nameKo);
    }
  }

  // 3단계: 다운로드
  console.log("\n── 3단계: 내려받기 ──");
  let ok = 0, miss = 0;
  const missing = [];
  for (const t of need) {
    const url = lookup(t);
    if (!url) { missing.push(t.nameKo); miss++; continue; }
    try {
      const bytes = await download(url, path.join(IMG_DIR, t.id + ".png"));
      console.log(`✅ ${t.nameKo} → images/${t.id}.png (${Math.round(bytes / 1024)}KB)`);
      ok++;
    } catch (e) {
      console.log(`⚠️  ${t.nameKo} — 다운로드 실패: ${e.message}`);
      missing.push(t.nameKo); miss++;
    }
    await sleep(200);
  }

  console.log(`\n완료: 성공 ${ok} · 실패/누락 ${miss}`);
  if (missing.length) console.log("누락:", missing.join(", "));
}

main().catch((e) => { console.error("오류:", e); process.exit(1); });
