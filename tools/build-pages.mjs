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
  if (!rels.length) return "";
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

/* 소품을 마법 설명에 녹인다.
 *
 * 153마리 가운데 **73마리는 마법 글이 이미 소품을 말하고 있다** (차차핑: "…물뿌리개를
 * 불러내 마법의 물을 뿌리기도 한다"). 거기에 소품을 또 적으면 같은 말을 두 번 한다.
 * 그래서 **글에 없는 마리에만** 손을 댄다.
 *
 * 딴 문장으로 붙이지 않고 **첫 문장 안에 넣는다.** 「마법 도구는 돋보기다. 호기심의
 * 마법으로 궁금한 것을 부풀린다」보다 「돋보기로 호기심의 마법을 써서 궁금한 것을
 * 부풀린다」가 한 문장으로 읽혀 자연스럽다.
 *
 * 첫 문장 모양이 셋이라 각각 다르게 넣는다.
 *   ① 「…마법으로 ~한다」   → 「소품으로 …마법을 써서 ~한다」
 *                            (키키핑: 막대사탕으로 장난기의 마법을 써서 주변을…)
 *   ② 「…마법을 쓴다/쓰는」   → 앞에 「소품으로」만 붙인다
 *                            (하츄핑: 손거울로 사랑의 마법을 쓰는 1기의 대표…)
 *   ③ 그 밖                  → 넣을 자리가 없다. 딴 문장으로 앞에 세운다
 *                            (그림핑: 마법 도구는 물감 붓이다. 마법 붓으로 그린…)
 * ③ 으로 억지로 밀어 넣으면 말이 어그러지므로 되는 것만 넣는다.
 *
 * 소품의 낱말이 글에 이미 있으면 손대지 않는데(같은 말을 두 번 하지 않으려고),
 * **뜻이 다른데 글자만 같은 경우**가 셋 있다. 아래 APART 에 적어 두고 ③ 으로 보낸다 —
 * 소품이 글에 없으니 밝혀 주어야 하고, 문장 안에 끼워 넣으면 같은 낱말이 한 문장에
 * 두 번 들어가 눈에 걸린다.
 *
 * ①의 자리는 '마법' 바로 뒤가 '으로' 일 때만 잡는다. 그림핑의 「마법 붓으로」처럼
 * 사이에 말이 끼면 걸리지 않아야 한다.
 *
 * 그리고 '마법' 이 문장 앞머리에 있을 때만 잡는다. 차밍핑은 「자기만의 기준으로
 * 매력지수를 매기고 바리깡 마법으로 머리 모양을 바꿔 버린다」인데, 뒤쪽 '마법으로'
 * 를 잡아 맨 앞에 소품을 붙이면 「핸드백으로 자기만의 기준으로…」가 되어
 * '으로' 가 겹치고 말이 엉킨다. 앞이 스무 자를 넘거나 거기 이미 '(으)로' 가 있으면
 * 손대지 않고 ③ 으로 보낸다.
 *
 * 조사는 받침을 따른다 — 없거나 ㄹ 이면 '로', 아니면 '으로' (손거울로·카메라로·
 * 막대사탕으로). '이에요/예요' 도 마찬가지다 (마법책이에요·카메라예요).
 * 괄호로 닫히는 소품이 있을 수 있어 끝 글자가 아니라 **마지막 한글 낱자**를 본다. */
/* 거꾸로, **글이 소품을 다른 말로 이미 부르고 있는** 마리들. 글자가 안 맞아 못 알아보지만
   같은 물건이므로 아무것도 보태지 않는다 (조아핑에 「마법 도구는 브러쉬다」를 붙이면
   바로 뒤 「마법 붓으로」와 같은 말이 된다). 띄어쓰기만 다르거나(깃털부채/깃털 부채),
   한 글자라 낱말로 안 잡히거나(큰북→북), 아예 딴 말인 경우(스패츌러→주걱)가 섞여 있다. */
const SAID = new Set([
  "조아핑",    // 브러쉬        → 글은 「마법 붓으로」
  "그림핑",    // 물감 붓        → 글은 「마법 붓으로」
  "까르핑",    // 깃털부채       → 글은 「마법 깃털 부채로」 (띄어쓰기)
  "발레핑",    // 스노우볼       → 글은 「마법 스노볼로」
  "샌드핑",    // 스패츌러       → 글은 「마법 주걱으로」
  "요거핑",    // 나무스푼·요거트양 → 글은 「마법 숟가락과 … 요거트 양들로」
  "다롱핑",    // 큰북          → 글은 「북을 두드려」
  "루루핑",    // 통기타         → 글은 「기타와 노래로」
  "차캐핑",    // 차캐핑의 얼굴도장 → 글은 「도장을 찍어」
  "말랑핑",    // 줄 달린 탱탱볼   → 글은 「젤리볼을 던져」
]);

const APART = new Set([
  "솔찌핑",    // 소품은 「구름 솜사탕」인데 글의 '구름' 은 하늘의 구름이다
  "캔디핑",    // 소품은 「사탕 바구니」인데 글의 '사탕' 은 '사탕발림' 이다
  "푸딩핑",    // 소품은 「푸딩 모양의 텀블러」인데 글의 '푸딩' 은 '푸딩 댄스' 다
]);

function withItem(item, magic, name) {
  const it = String(item || "").replace(/\n/g, " ").trim();
  const text = String(magic || "").trim();
  if (!it || it === "없음") return text;

  if (SAID.has(name)) return text;          // 글이 이미 다른 말로 부르고 있다
  const apart = APART.has(name);

  // 소품의 낱말이 이미 글에 있으면 그대로 둔다
  const words = it.replace(/\(.*?\)/g, " ").split(/[,·과와및\s]+/).filter((w) => w.length >= 2);
  if (!apart && words.some((w) => text.includes(w))) return text;

  const syl = [...it].reverse().find((ch) => {
    const c = ch.charCodeAt(0) - 0xac00;
    return c >= 0 && c <= 11171;
  });
  const jong = syl ? (syl.charCodeAt(0) - 0xac00) % 28 : -1;
  const ro = (jong === 0 || jong === 8) ? "로" : "으로";       // 8 = 받침 ㄹ
  const ida = jong === 0 ? "예요" : "이에요";

  /* 앞머리가 짧고 거기에 '(으)로' 가 없을 때만 문장 안에 넣는다 */
  const head = (re) => {
    const m = re.exec(text);
    return m && m[1].length <= 20 && !/[으]?로\s/.test(m[1]) ? m : null;
  };

  const one = apart ? null : head(/^([^.!?]*?마법)으로\s/);      // ①
  if (one) return text.replace(one[0], `${it}${ro} ${one[1]}을 써서 `);

  /* '쓴다'·'써요' 도 받는다. 한글은 '쓰' 에 ㄴ 을 얹어도 '쓴' 이라는 딴 낱자가 되고
     '써' 도 마찬가지라, '쓰' 로만 찾으면 둘 다 걸리지 않는다. */
  if (!apart && head(/^([^.!?]*?)마법을 [쓰쓴써]/)) return `${it}${ro} ${text}`;   // ②
  const line = `마법 도구는 ${it}${ida}.`;                      // ③
  return text ? `${line} ${text}` : line;
}

function page(t) {
  const title = `티니핑 도감 - ${t.nameKo}`;
  const desc = description(t);
  const url = `${BASE}/p/${encodeURIComponent(t.id)}.html`;
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";

  /* 내용이 없는 칸은 블록째 내보내지 않는다. 「아직 정보가 준비되지 않았어요 🌱」가
     118장에 떠 있었는데, 대부분은 앞으로도 채워질 것이 아니라 원작에 없는 것이다
     (관계가 그렇다 — 39마리만 짝이 있다). 없는 것을 없다고 알리느니 자리를 비운다.
     마법 칸은 소품이 함께 들어가므로 둘을 합친 뒤에 비었는지 본다 —
     샤를핑은 마법 서술문이 없지만 소품(장난감 칼)은 있어 그 한 줄이 남는다. */
  const magicText = withItem(t.item, t.magic, t.nameKo);
  /* 회차는 제목 옆 배지가 아니라 줄거리 첫머리에 놓는다 — 소품을 마법 설명 안에
     넣은 것과 같은 결이다. 배지로 떠 있으면 눈이 한 번 더 옮겨 가야 하고, 읽어 주기
     버튼이 문단만 읽어 회차를 빠뜨린다. 값이 이미 「1기 15화 「돌아와, 하츄핑」」처럼
     온전한 이름이라 덧붙이는 말 없이 마침표만 찍어 세운다.
     여러 회차에 걸쳐 나오는 마리는 회차마다 문단을 나눈다 — 읽어 주기도 따로 붙어
     궁금한 화만 골라 들을 수 있다.

     회차 이름 뒤에서 줄을 넘긴다. <br> 뒤에 진짜 줄바꿈을 하나 더 두는 것은 읽어
     주기 때문이다 — 그 버튼은 감싼 문단의 textContent 를 읽는데(js/util.js), <br> 은
     글자를 남기지 않아 「…하츄핑」.로미가」처럼 두 줄이 붙어 읽힌다. */
  const storyHTML = (t.episodes || [])
    .map((e) => `<p>${e.episode ? `${esc(e.episode)}.<br>\n            ` : ""}${esc(e.plot)}</p>`)
    .join("\n          ");
  const relations = relationsHTML(t);
  const block = (title, body) => (body
    ? `<div class="info-block">\n          <h3>${title}</h3>\n          ${body}\n        </div>`
    : "");

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
        ${block(`💬 소개${speakBlockBtnHTML("소개 읽어 주기")}`, t.intro
          ? `<p>${esc(t.intro).replace(/\n/g, "<br>\n            ")}</p>` : "")}
        ${block(`🪄 마법${speakBlockBtnHTML("마법 설명 읽어 주기")}`, magicText
          ? `<p>${esc(magicText)}</p>` : "")}
        ${block(`📖 에피소드${speakBlockBtnHTML("에피소드 줄거리 읽어 주기")}`, storyHTML)}
        ${block("🔗 관계", relations)}
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
