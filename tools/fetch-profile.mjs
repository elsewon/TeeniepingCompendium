#!/usr/bin/env node
/* ===== 세 출처에서 프로필 취합 (한 줄 소개 · 소품 · 마법) =====
 *
 * 이름은 도감의 것을 그대로 두고, 나머지 넷을 세 곳에서 모아 tools/profile.json 으로 낸다.
 * 값을 하나로 합치지 않고 **출처별로 나란히 적는다** — 어긋나는 자리를 사람이 보고
 * 고르라는 뜻이다 (그림을 네 출처로 견주어 골랐던 것과 같은 방식).
 *
 * ■ 출처 셋
 *   namu  나무위키 각 캐릭터 문서                       157마리를 고르게 덮는 유일한 곳
 *   blog  m.blog.naver.com/cecil122222/223355906005   1~5기 정리글. 칸이 규칙적이다
 *   cafe  네이버 카페 '이모션 왕국' 게시판 16            제목이 곧 「○○의 티니핑, 이름」이다
 *                                                (소개가 아니라 감정이라 emotion 에 담는다)
 *
 * ■ 마법은 참고용이다
 *   나무위키·블로그의 마법 칸은 주문명과 효과다 (「<약오르지롱> 막대사탕으로
 *   팅클퍼프를 뿌려…」). 도감의 magic 은 캐릭터를 풀어 쓴 서술문이라 성격이 다르다.
 *   **도감의 서술문을 그대로 둔다.** 여기 모은 값은 견주어 보는 용도다.
 *
 * ■ 하츄핑 계열 5종은 나무위키가 문서를 공유한다
 *   소품이 「손거울(1기) → 하프(2기) → 향수(3기)…」처럼 한 칸에 뭉쳐 온다.
 *   블로그는 다이아=하프, 플로라=향수, 베리=핸드벨로 따로 적어 두어 이쪽이 낫다.
 *
 * ⚠️ 나무위키는 파이썬 urllib 으로 받으면 본문이 비어 온다. Node 의 fetch 를 쓴다.
 *
 * 실행:  node tools/fetch-profile.mjs            (받아 둔 것은 다시 받지 않는다)
 *        node tools/fetch-profile.mjs --force     (전부 다시 받는다)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CACHE = "/tmp/namu-pages";                 // 받아 온 원본을 여기 쌓아 둔다
const OUT = path.join(__dirname, "profile.json");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const BLOG = "https://m.blog.naver.com/cecil122222/223355906005";
const CAFE_ID = 31037796;                        // 이모션 왕국
const CAFE_MENU = 16;                            // 게시판 「캐릭터&도감 정보」
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 같은 자리를 가리키는 칸 이름들. 앞의 것부터 찾아 먼저 걸리는 것을 쓴다.
   마리마다 말이 달라서다 — 키키핑은 「소품」이 아니라 「무기: 막대사탕」이다. */
const FIELDS = {
  item:  ["소품", "무기", "아이템", "소지품"],
  magic: ["마법", "능력", "마법 능력"],
};

/* 첫 등장은 모으지 않는다. 154마리에 있긴 한데 고유값이 91개뿐이라 「○○ 1화」로
   몰리고(5기는 25마리 중 17마리가 같다), 하츄핑 계열은 문서를 공유해 다섯이
   1기 1화로 잘못 붙는다. 이미 있는 episode(그 마리가 주인공인 회차)와도 헷갈린다. */

/* 나무위키에서 「하츄핑」 문서 하나로 합쳐진 계열 */
const HEARTS = new Set([
  "다이아 하츄핑", "플로라 하츄핑", "베리 하츄핑", "스타 하츄핑", "프린세스 하츄핑",
]);

function loadData() {
  const win = {};
  new Function("window", fs.readFileSync(path.join(ROOT, "data/teeniepings.js"), "utf8"))(win);
  return win.TEENIEPINGS || [];
}

const unesc = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

/* 각주(<a href='#fn-1'>[1]</a>)는 지운다 — 본문이 아니라 곁다리다.
   <br> 과 </strong> 은 줄바꿈으로 살린다 (대사와 소개가 <br> 없이 붙는 문서가 있다). */
function text(html) {
  return unesc(html
    .replace(/<a[^>]*href=['"]#fn-[^'"]*['"][^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/<br[^>]*>|<\/strong>|<\/p>|<\/div>/g, "\n")
    .replace(/<[^>]+>/g, ""))
    .split("\n").map((s) => s.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

/* ── 나무위키 ───────────────────────────────── */

/* 한 줄 소개.
 *
 * 문서 맨 위 인용문에 「○○의 티니핑, 이름」 꼴로 실린다. 그런데 **모든 마리에
 * 있는 것이 아니다.** 하츄핑·바로핑·방글핑·꾸래핑·왕자핑처럼 인용문이 명대사뿐인
 * 문서가 있다. 아무 인용문이나 집으면 "하얗게 불태웠어, 방글..." 같은 대사가
 * 소개 자리에 앉는다. 그래서 **소개꼴인 것만 받고, 아니면 비운다.**
 * 채우다 틀린 말을 넣느니 빈 채로 두는 편이 낫다.
 *
 * 소개꼴인지는 「…의 티니핑」이나 「…의 <제 이름>」이 들어 있는지로 가른다
 * (사뿐핑은 「기품의 사뿐핑」처럼 티니핑을 안 쓰기도 한다).
 * 일본판 대사 블록은 가나가 섞여 오므로 먼저 걸러 낸다.
 *
 * 인용문에 없으면 og:description 을 같은 잣대로 본다. 거기서 올 때는 각주 본문이
 * 문장 사이에 끼어 말이 끊기므로, <a title='…'> 에 있는 각주 글을 모아 도로 빼낸다. */
function intro(html, name) {
  const quoted = (line) => /^[“"″'‘].*[”"″'’][!?.]?$/.test(line.trim());
  const kana = /[\u3040-\u30ff]/;
  const looksLikeIntro = (t) =>
    new RegExp("\uc758\\s*(\ud2f0\ub2c8\ud551|" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")").test(t);

  for (const m of html.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g)) {
    const t = text(m[1]);
    if (!t || kana.test(t)) continue;
    if (t.split("\n").every(quoted)) continue;
    if (looksLikeIntro(t)) return t;
  }

  const og = /<meta[^>]*property=['"]og:description['"][^>]*content=['"]([\s\S]*?)['"]\s*\/?>/.exec(html);
  if (!og) return "";
  let s = text(og[1]);
  for (const a of html.matchAll(/<a[^>]*href=['"]#fn-[^'"]*['"][^>]*>/g)) {
    const title = /title=['"]([^'"]*)['"]/.exec(a[0]);
    const t = title ? text(title[1]) : "";
    if (t.length >= 2) s = s.split(t).join(" ");   // 빈 값으로 자르면 글자가 다 흩어진다
  }
  s = s.replace(/\s+/g, " ").trim();
  return looksLikeIntro(s) ? s : "";
}

/* 프로필 표의 한 줄. <tr> 안에서 첫 칸이 label 이면 둘째 칸이 값이다.
   칸 이름만 찾아 그다음 <td> 를 집으면 어긋난다 — 이름이 값 안에 다시 나오는
   줄이 있어서다 (키키핑의 「무기: 막대사탕」 각주에 '소품'이 들어 있다). */
function row(html, labels) {
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (tds.length < 2) continue;
    if (labels.includes(text(tds[0][1]))) {
      const v = text(tds[1][1]);
      if (v) return v;
    }
  }
  return "";
}

async function namuPage(name, force) {
  const file = path.join(CACHE, encodeURIComponent(name) + ".html");
  if (!force && fs.existsSync(file) && fs.statSync(file).size > 20000) {
    return fs.readFileSync(file, "utf8");
  }
  const res = await fetch("https://namu.wiki/w/" + encodeURIComponent(name), {
    headers: { "User-Agent": UA },
    redirect: "follow",                 // 「다롱핑」→「아롱핑&다롱핑」 처럼 넘어간다
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const html = await res.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, html);
  await sleep(300);                     // 남의 서버다. 천천히 간다
  return html;
}

/* ── 블로그 ─────────────────────────────────── */

/* 글 하나에 100마리 남짓이 같은 짜임으로 늘어서 있다:
 *   이름 / 이름 / 성별: … / 소품: … / 마법: <주문> 설명 / 좋아하는 것: … / …
 * 이름 줄이 나오면 새 마리로 넘어가고, 「칸: 값」 줄을 그 마리에 담는다.
 * 값이 여러 줄로 이어지는 것도 있어(마법 설명) 다음 칸이 나올 때까지 잇는다. */
const BLOG_KEYS = ["성별", "소품", "상징", "파트너", "마법",
                   "좋아하는 것", "싫어하는 것", "좋아하는 음식", "싫어하는 음식", "로미와 변신"];

function parseBlog(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  const re = new RegExp("^(" + BLOG_KEYS.join("|") + ")\\s*:\\s*(.*)$");
  const out = new Map();
  let cur = null, last = null;
  for (const line of text(body).split("\n")) {
    const m = re.exec(line);
    if (m && cur) { out.get(cur)[m[1]] = m[2].trim(); last = m[1]; continue; }
    if (/^[가-힣A-Za-z&·\s]{2,12}핑$/.test(line)) {          // 이름 줄
      cur = line.trim();
      if (!out.has(cur)) out.set(cur, {});
      last = null;
      continue;
    }
    if (cur && last && out.get(cur)[last]) out.get(cur)[last] += " " + line;   // 이어지는 값
  }
  return out;
}

async function blogSource(force) {
  const file = path.join(CACHE, "blog-cecil.html");
  let html;
  if (!force && fs.existsSync(file) && fs.statSync(file).size > 20000) {
    html = fs.readFileSync(file, "utf8");
  } else {
    const res = await fetch(BLOG, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    html = await res.text();
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, html);
  }
  return parseBlog(html);
}

/* ── 카페 ───────────────────────────────────── */

/* 게시판 목록은 로그인 없이 공개 API 로 열린다 (cafeMember: false 로도 200 이 온다).
 * 본문은 막혀 있지만 **제목만으로 충분하다** — 「티니핑 도감📚 - 수리의 티니핑,
 * 고쳐핑🛠️」처럼 감정과 이름이 제목에 그대로 들어 있고, 6기까지 있다. */
async function cafeSource(force) {
  const file = path.join(CACHE, "cafe-titles.json");
  if (!force && fs.existsSync(file)) return new Map(JSON.parse(fs.readFileSync(file, "utf8")));

  const titles = [];
  for (let page = 1; page <= 10; page++) {
    const url = "https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json"
      + `?search.clubid=${CAFE_ID}&search.menuid=${CAFE_MENU}&search.page=${page}&search.perPage=50`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://cafe.naver.com/" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const r = (await res.json()).message.result;
    titles.push(...r.articleList.map((a) => unesc(a.subject)));
    if (!r.hasNext) break;
    await sleep(300);
  }
  const out = new Map();
  for (const s of titles) {
    const m = /[-–]\s*([^,]+?)의 티니핑,\s*([^\s<>]+핑)/.exec(s);
    if (m) out.set(m[2].trim(), m[1].trim());
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify([...out]));
  return out;
}

/* ── 합치기 ─────────────────────────────────── */

async function main() {
  const force = process.argv.includes("--force");
  const list = loadData();

  console.log("블로그·카페 먼저…");
  const blog = await blogSource(force).catch((e) => (console.error("  ✗ 블로그: " + e.message), new Map()));
  const cafe = await cafeSource(force).catch((e) => (console.error("  ✗ 카페: " + e.message), new Map()));
  console.log(`  블로그 ${blog.size}마리 · 카페 ${cafe.size}마리\n나무위키…`);

  const out = [];
  let n = 0;
  for (const t of list) {
    n++;
    const rec = { id: t.id, nameKo: t.nameKo };
    let html = null;
    try {
      html = await namuPage(t.nameKo, force);
    } catch (e) {
      console.error(`  ✗ ${t.nameKo}: ${e.message}`);
      rec.error = String(e.message);
    }
    const b = blog.get(t.nameKo) || {};

    rec.intro   = { namu: html ? intro(html, t.nameKo) : "" };
    // 카페 제목에서 나온 값은 소개가 아니라 감정 한 낱말이다 (「명예의 티니핑, 샤를핑」)
    rec.emotion = { cafe: cafe.get(t.nameKo) || "" };
    rec.item  = { namu: html ? row(html, FIELDS.item) : "",  blog: b["소품"] || "" };
    rec.magic = { namu: html ? row(html, FIELDS.magic) : "", blog: b["마법"] || "" };
    if (HEARTS.has(t.nameKo)) rec.shared = "하츄핑";   // 나무위키 값이 계열 공용이다
    out.push(rec);
    if (n % 40 === 0) console.log(`  … ${n}/${list.length}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

  /* 얼마나 찼고 어디가 어긋나는지 알려 준다 — 사람이 손봐야 할 자리다 */
  const has = (k, s) => out.filter((r) => r[k] && r[k][s]).length;
  const pad = (v) => String(v).padStart(6);
  console.log(`\n${out.length}마리 → ${path.relative(ROOT, OUT)}\n`);
  console.log("  칸            나무위키   그 밖");
  console.log(`  한 줄 소개    ${pad(has("intro", "namu"))}        —`);
  console.log(`  감정(참고)         —   ${pad(has("emotion", "cafe"))} (카페)`);
  console.log(`  소품          ${pad(has("item", "namu"))}   ${pad(has("item", "blog"))} (블로그)`);
  console.log(`  마법(참고)    ${pad(has("magic", "namu"))}   ${pad(has("magic", "blog"))} (블로그)`);

  const both = out.filter((r) => r.item.namu && r.item.blog);
  const same = both.filter((r) => r.item.namu === r.item.blog).length;
  console.log(`\n  소품이 두 곳에 다 있는 ${both.length}마리 중 ${same}마리가 글자까지 같다`
    + ` — 나머지 ${both.length - same}마리는 봐야 한다`);
}

main();
