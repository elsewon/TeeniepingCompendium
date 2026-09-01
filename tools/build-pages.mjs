/* ===== 개별 티니핑 페이지 생성 =====
 *
 *   node tools/build-pages.mjs
 *
 * 티니핑 한 마리당 완성된 정적 페이지를 p/<id>.html 로 만든다.
 *
 * 예전에는 detail.html 하나가 data/teeniepings.js(199KB, 157마리 전체)를 받아
 * 그중 한 마리를 JS 로 그렸다. 한 마리를 보려고 157마리 데이터를 받는 셈이었고,
 * 자바스크립트를 실행하지 않는 메신저 미리보기 크롤러에게는 빈 페이지로 보였다.
 * 지금은 내용을 빌드 때 미리 그려 두므로 페이지가 5KB 남짓으로 자체 완결한다.
 *
 * 머리말·꼬리말은 index.html 에서 그대로 떼어다 쓴다 (같은 내용을 세 번 적지 않으려고).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "p");
const BASE = "https://elsewon.github.io/TeeniepingCompendium";
const UP = "../";                 // p/<id>.html 에서 루트로 올라가는 길이

/* ── 데이터 ───────────────────────────────────────────── */
globalThis.window = {};
await import(path.join(ROOT, "data/teeniepings.js"));
const DATA = globalThis.window.TEENIEPINGS || [];
const BY_ID = Object.fromEntries(DATA.map((t) => [t.id, t]));

/* ── util.js 재사용 ───────────────────────────────────────
   이미지 태그와 플레이스홀더 SVG 는 목록·퀴즈와 똑같이 보여야 하므로
   같은 함수를 그대로 불러 쓴다 (여기서 다시 구현하면 언젠가 어긋난다). */
const sandbox = {
  window: { TEENIEPINGS: DATA },
  document: { addEventListener() {} },
  location: { pathname: "/", search: "", href: "/" },
  navigator: {},
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/util.js"), "utf8"), sandbox);
const { imageMarkup, speakBtnHTML, speakBlockBtnHTML } = sandbox;

/* ── index.html 의 머리말·꼬리말 ──────────────────────────── */
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/** 루트 기준 상대 경로를 p/ 기준으로 바꾼다 (외부 링크·앵커는 그대로) */
function reroot(html) {
  return html.replace(/(href|src)="([^"]*)"/g, (m, attr, url) =>
    /^(https?:|mailto:|#|data:|\/)/.test(url) ? m : `${attr}="${UP}${url}"`);
}
function section(tag) {
  const m = indexHtml.match(new RegExp(`  <${tag}[\\s\\S]*?</${tag}>`));
  if (!m) throw new Error(`index.html 에서 <${tag}> 를 찾지 못했습니다`);
  return reroot(m[0]);
}
const HEADER = section("header");
/* 개별 페이지 꼬리말에서는 통계줄을 뺀다. 이 페이지의 숫자(조회·좋아요)는
   카드 아래 띠에 붙어 있어, 꼬리말에 또 적으면 같은 말을 두 번 하는 꼴이다. */
const FOOTER = section("footer").replace(/\s*<p class="stats"[\s\S]*?<\/p>/, "");

/* ── 관계 목록 ───────────────────────────── */
/* 예전에는 SVG 관계 그래프를 그렸다. 관계는 많아야 5개(0개가 118마리)라
 * 그래프로 얻는 것이 적고 자리만 크게 차지해, 마법·에피소드와 같은 칸에
 * 목록으로 넣는다. data-ping 은 page.js 가 ?from= 을 이어 붙일 표시.
 *
 * 썸네일은 imageMarkup 을 쓰지 않고 <img> 를 직접 적는다. imageMarkup 은 그림이
 * 없을 때를 대비해 플레이스홀더 SVG(1.5KB)를 통째로 data-fallback 에 싣는데,
 * 56px 그림 다섯 개면 7KB 가 넘어 페이지가 배로 뚱뚱해진다. 그림을 못 불러와도
 * 이름과 관계 라벨은 그대로 남으므로 여기서는 대체 그림을 두지 않는다. */
function relationsHTML(center) {
  const rels = center.relations || [];
  if (!rels.length) {
    return `<p><span class="pending">아직 등록된 관계가 없어요 🌱</span></p>`;
  }
  const items = rels.map((rel) => {
    const target = BY_ID[rel.id];
    const name = target ? target.nameKo : rel.id;
    const v = target && target.imgv ? `?v=${target.imgv}` : "";   // 그림 고쳤을 때 캐시 무효화
    const face = target
      ? `<span class="rel-face">` +
        `<img src="${UP}images/thumb/${encodeURIComponent(target.id)}.webp${v}"` +
        ` alt="" loading="lazy"></span>`
      : `<span class="rel-face"></span>`;
    const inner = `${face}<span class="rel-name">${esc(name)}</span>` +
      (rel.label ? `<span class="rel-label">${esc(rel.label)}</span>` : "");
    // 개별 페이지끼리는 같은 폴더 안이라 파일 이름만 적으면 된다
    return `<li>${target
      ? `<a class="rel-item" data-ping href="${encodeURIComponent(rel.id)}.html">${inner}</a>`
      : `<span class="rel-item is-off">${inner}</span>`}</li>`;
  }).join("");
  return `<ul class="rel-list">${items}</ul>`;
}

/* ── 페이지 ──────────────────────────────────────────── */
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/* 미리보기 설명문 — 마법 설명을 앞쪽 문장만 남겨 요약한다.
   메신저는 설명을 두 줄쯤 보여 주므로 100자 안팎에서 문장 단위로 끊는다.
   (마법 설명이 없는 캐릭터는 기수·등급 태그로 대신한다) */
function description(t) {
  const raw = (t.magic || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!raw) return [t.season, t.grade, t.gender, t.emotion].filter(Boolean).join(" · ");

  const LIMIT = 100;
  const sentences = raw.match(/[^.!?]+[.!?]*\s*/g) || [raw];
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).trim().length > LIMIT) break;
    out += s;
  }
  out = out.trim();
  if (!out) out = sentences[0].trim();                       // 첫 문장부터 이미 길 때
  return out.length > LIMIT + 20 ? out.slice(0, LIMIT).trim() + "…" : out;
}

function page(t) {
  const title = `티니핑 도감 - ${t.nameKo}`;
  const desc = description(t);
  const url = `${BASE}/p/${encodeURIComponent(t.id)}.html`;
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  const pending = '<span class="pending">아직 정보가 준비되지 않았어요 🌱</span>';

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="티니핑 도감">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE}/images/og/${encodeURIComponent(t.id)}.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(t.nameKo)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="${UP}images/favicon.svg">
  <link rel="apple-touch-icon" href="${UP}images/heartsping.png">
  <link rel="stylesheet" href="${UP}css/styles.css">
</head>
<body>
${HEADER}

  <main class="wrap detail">
    <a class="back-link" href="${UP}index.html"><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>목록으로</a>
    <div class="detail-top">
      <!-- 목록 카드와 같은 짜임 — 그림 아래에 이름·태그 -->
      <div class="detail-card">
        <div class="detail-image">${imageMarkup(t, 320, UP)}</div>
        <div class="detail-head">
          <!-- 이름 옆 읽어 주기 버튼 (js/util.js) -->
          <h1><span>${esc(t.nameKo)}</span>${speakBtnHTML(t.nameKo)}</h1>
          <div class="detail-tags">
            <span class="tag season">${esc(t.season)}</span>
            <span class="tag ${gradeClass}">${esc(t.grade)}</span>
            ${t.gender ? `<span class="tag gender-${esc(t.gender)}">${esc(t.gender)}</span>` : ""}
            ${t.emotion ? `<span class="tag">${esc(t.emotion)}</span>` : ""}
          </div>
        </div>
        <!-- 카드 맨 아래 띠 둘. 인기 차트가 조회·좋아요를 나란히 세우듯 여기서도 같은
             차례로 쌓는다. 조회는 읽기만 하는 값이라 버튼이 아니고, 좋아요만 누른다.
             둘 다 숫자를 받아 온 뒤에 나타난다 (js/stats.js · js/page.js). -->
        <div class="view-bar" hidden>
          <span class="bar-icon" aria-hidden="true">🔎</span>
          <span class="bar-label">조회</span>
          <b data-view>0</b>
        </div>
        <button class="like-btn" type="button" data-like hidden aria-pressed="false">
          <span class="bar-icon like-heart" aria-hidden="true">❤️</span>
          <span class="bar-label">좋아요</span>
          <b class="like-count">0</b>
        </button>
      </div>
      <div class="detail-info">
        <div class="info-block">
          <h3>🪄 마법</h3>
          <!-- 글 끝의 읽어 주기 버튼은 문단 안에 넣는다 — 누르면 감싼 문단의 글을 읽는다 -->
          <p>${t.magic ? esc(t.magic) + speakBlockBtnHTML("마법 설명 읽어 주기") : pending}</p>
        </div>
        <div class="info-block">
          <h3>📖 에피소드 ${t.episode ? `<span class="ep-badge">${esc(t.episode)}</span>` : ""}</h3>
          <p>${t.story ? esc(t.story) + speakBlockBtnHTML("에피소드 줄거리 읽어 주기") : pending}</p>
        </div>
        <div class="info-block">
          <h3>🔗 관계</h3>
          ${relationsHTML(t)}
        </div>
      </div>
    </div>
  </main>

${FOOTER}

  <script src="${UP}data/ping-ids.js"></script>
  <script src="${UP}js/util.js"></script>
  <script src="${UP}js/stats.js"></script>
  <script src="${UP}js/page.js"></script>
</body>
</html>
`;
}

/* ── 쓰기 ──────────────────────────────────────────────
 *
 * 폴더를 통째로 지우고 다시 쓰지 않는다. 이 저장소는 iCloud Drive 안에 있어,
 * 지우고 같은 이름으로 다시 만드는 사이 동기화가 끼면 아이클라우드가 양쪽을
 * 서로 다른 파일로 보고 "고고핑 2.html" 같은 충돌 사본을 남긴다.
 *
 * 그래서 같은 이름에 덮어쓰고, 명단에서 빠진 것만 따로 지운다.
 * 내용이 그대로인 파일은 아예 건드리지 않는다 — 손댄 시각만 바뀌어도
 * 아이클라우드가 157개를 통째로 다시 올린다. */
fs.mkdirSync(OUT_DIR, { recursive: true });

const keep = new Set(DATA.map((t) => `${t.id}.html`));
let written = 0;
for (const t of DATA) {
  const file = path.join(OUT_DIR, `${t.id}.html`);
  const html = page(t);
  let old = null;
  try { old = fs.readFileSync(file, "utf8"); } catch { /* 처음 만드는 파일 */ }
  if (old === html) continue;
  fs.writeFileSync(file, html, "utf8");
  written++;
}

/* 명단에서 빠진 것 정리 — 이름이 바뀌어 남은 옛 페이지, 아이클라우드 충돌 사본 등 */
const stale = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".html") && !keep.has(f));
for (const f of stale) fs.rmSync(path.join(OUT_DIR, f));

/* 랜덤핑용 id 목록 — 개별 페이지는 데이터 전체를 싣지 않으므로 이것만 받는다 */
const idsPath = path.join(ROOT, "data/ping-ids.js");
const ids =
  "/* 자동 생성 (node tools/build-pages.mjs) — 랜덤핑에 쓰는 id 목록 */\n" +
  `window.PING_IDS = ${JSON.stringify(DATA.map((t) => t.id))};\n`;
let oldIds = null;
try { oldIds = fs.readFileSync(idsPath, "utf8"); } catch { /* 처음 만드는 파일 */ }
if (oldIds !== ids) fs.writeFileSync(idsPath, ids, "utf8");

console.log(
  `개별 페이지 ${DATA.length}개 → p/<id>.html ` +
  `(새로 쓴 것 ${written}개, 그대로 둔 것 ${DATA.length - written}개)`);
if (stale.length) console.log(`명단에 없어 지운 것 ${stale.length}개: ${stale.join(", ")}`);
