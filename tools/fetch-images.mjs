#!/usr/bin/env node
/* ===== 티니핑 대표 이미지 일괄 수집 =====
 *
 * data/teeniepings.js 의 각 티니핑에 대해 Fandom 위키(한국어→영어)에서
 * 대표 이미지를 찾아 images/<id>.png 로 저장합니다.
 *
 * 탐색 전략 (앞에서부터 시도, 성공하면 중단):
 *   1) 페이지 대표 이미지 (prop=pageimages) — 한글명 → 영문명
 *   2) 접두어 제거한 이름으로 1) 재시도  (예: "다이아 하츄핑" → "하츄핑")
 *   3) 위키 검색(list=search)으로 실제 문서명을 찾은 뒤 1) 재시도
 *   4) 문서에 포함된 이미지 목록(prop=images)에서 첫 유효 이미지 선택
 *
 * 실행:  node tools/fetch-images.mjs           (이미 있는 파일은 건너뜀)
 *        node tools/fetch-images.mjs --force    (덮어쓰기)
 *
 * ⚠️ 캐릭터 이미지 저작권은 SAMG엔터테인먼트에 있습니다. 개인용/로컬 용도로만 사용하세요.
 *    Node 18+ 필요 (전역 fetch 사용). 외부 패키지 불필요.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "images");
const FORCE = process.argv.includes("--force");

const KO = "https://catchteenieping.fandom.com/ko/api.php";
const EN = "https://catchteenieping.fandom.com/api.php";
const UA = "TeeniepingCompendium/1.0 (personal fan project)";

/* 아이콘·로고·배너 등 대표 이미지로 부적절한 파일 걸러내기 */
const BAD_IMAGE = /(logo|wiki|favicon|icon|badge|banner|placeholder|site-|button)/i;
const OK_EXT = /\.(png|jpe?g|webp|gif)$/i;

function loadData() {
  const src = fs.readFileSync(path.join(ROOT, "data/teeniepings.js"), "utf8");
  const win = {};
  new Function("window", src)(win);
  return win.TEENIEPINGS || [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(endpoint, params) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ format: "json", origin: "*", ...params }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

/* 1) 문서 대표 이미지 */
async function pageImage(title, endpoint) {
  const json = await api(endpoint, {
    action: "query", prop: "pageimages", piprop: "original", titles: title, redirects: "1",
  });
  const pages = json?.query?.pages || {};
  for (const k of Object.keys(pages)) {
    const src = pages[k]?.original?.source;
    if (src) return src;
  }
  return null;
}

/* 3) 검색으로 실제 문서명 찾기
 * ⚠️ 위키 검색은 유사어를 반환한다 (예: "딩동핑" → "빛나핑").
 *    그대로 쓰면 다른 캐릭터 이미지를 받게 되므로, 제목이 정확히
 *    일치할 때만 채택한다. */
const normalize = (s) => s.replace(/\s+/g, "").toLowerCase();
async function searchTitle(query, endpoint) {
  const json = await api(endpoint, {
    action: "query", list: "search", srsearch: query, srlimit: "5",
  });
  const hits = json?.query?.search || [];
  const want = normalize(query);
  const exact = hits.find((h) => normalize(h.title) === want);
  return exact ? exact.title : null;
}

/* 4) 문서에 포함된 이미지 중 첫 유효 이미지의 실제 URL */
async function firstPageImage(title, endpoint) {
  const list = await api(endpoint, {
    action: "query", prop: "images", imlimit: "20", titles: title, redirects: "1",
  });
  const pages = list?.query?.pages || {};
  let files = [];
  for (const k of Object.keys(pages)) files = files.concat(pages[k]?.images || []);
  const candidates = files
    .map((f) => f.title)
    .filter((t) => OK_EXT.test(t) && !BAD_IMAGE.test(t));
  if (!candidates.length) return null;

  const info = await api(endpoint, {
    action: "query", prop: "imageinfo", iiprop: "url", titles: candidates.slice(0, 5).join("|"),
  });
  const ipages = info?.query?.pages || {};
  for (const k of Object.keys(ipages)) {
    const src = ipages[k]?.imageinfo?.[0]?.url;
    if (src) return src;
  }
  return null;
}

/* 하츄핑 계열은 시즌마다 디자인이 다르므로 접두어를 떼고 기본형 이미지를
 * 가져오면 6개 시즌이 전부 같은 그림이 된다. 따라서 이름은 항상 그대로 쓴다. */
async function findImageUrl(t) {
  const ko = t.nameKo;
  const en = t.nameEn;

  const attempts = [];
  attempts.push(() => pageImage(ko, KO));
  if (en) attempts.push(() => pageImage(en, EN));

  // 검색 폴백 (제목이 정확히 일치할 때만)
  attempts.push(async () => {
    const found = await searchTitle(ko, KO);
    return found ? pageImage(found, KO) : null;
  });
  if (en) {
    attempts.push(async () => {
      const found = await searchTitle(en, EN);
      return found ? pageImage(found, EN) : null;
    });
  }
  // 문서 내 이미지 목록 폴백
  attempts.push(() => firstPageImage(ko, KO));
  if (en) attempts.push(() => firstPageImage(en, EN));

  for (const attempt of attempts) {
    try {
      const url = await attempt();
      if (url) return url;
    } catch (_) { /* 다음 전략 */ }
    await sleep(120);
  }
  return null;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1200) throw new Error("too small");
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  const list = loadData();
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
  console.log(`총 ${list.length}마리 처리 시작 (${FORCE ? "덮어쓰기" : "기존 파일 건너뜀"})\n`);

  let ok = 0, skip = 0, miss = 0;
  const missing = [];
  for (const t of list) {
    const dest = path.join(IMG_DIR, t.id + ".png");
    if (!FORCE && fs.existsSync(dest)) { skip++; continue; }

    const found = await findImageUrl(t);
    if (!found) {
      console.log(`❓ ${t.nameKo}`);
      missing.push(t.nameKo); miss++;
      continue;
    }
    try {
      const bytes = await download(found, dest);
      console.log(`✅ ${t.nameKo} → images/${t.id}.png (${Math.round(bytes / 1024)}KB)`);
      ok++;
    } catch (e) {
      console.log(`⚠️  ${t.nameKo} — 다운로드 실패: ${e.message}`);
      missing.push(t.nameKo); miss++;
    }
    await sleep(250);
  }

  console.log(`\n완료: 성공 ${ok} · 건너뜀 ${skip} · 실패/누락 ${miss}`);
  if (missing.length) {
    console.log("누락:", missing.join(", "));
    console.log("→ images/<id>.png 로 직접 넣으면 자동 반영됩니다.");
  }
}

main().catch((e) => { console.error("오류:", e); process.exit(1); });
