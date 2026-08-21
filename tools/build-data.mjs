#!/usr/bin/env node
/* ===== data/teeniepings.js 빌드 =====
 *
 *   roster.js  (PDF 도감 시즌1~6 전체 명단 + 등급)   ← 권위 있는 명단
 * + details.js (위키 리서치 상세: 특징/사연/관계/영문명) ← 있으면 병합
 * + magic.js   (개별 페이지에 보여 줄 마법 설명)          ← 있으면 병합
 * → data/teeniepings.js
 *
 * 실행: node tools/build-data.mjs
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadWindowFile(rel) {
  const win = {};
  new Function("window", fs.readFileSync(path.join(ROOT, rel), "utf8"))(win);
  return win;
}
const ROSTER = loadWindowFile("tools/roster.js").ROSTER;
const DETAILS = loadWindowFile("tools/details.js").DETAILS;
/* 마법 설명 (tools/magic.js) — 이름(nameKo)으로 병합한다 */
const MAGIC = loadWindowFile("tools/magic.js").MAGIC || {};

/* 에피소드 줄거리 (tools/ep-s*.json) — 있으면 story 를 실제 줄거리로 덮어쓴다 */
const EPISODES = fs.readdirSync(path.join(ROOT, "tools"))
  .filter((f) => /^ep-[\w-]+\.json$/.test(f))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "tools", f), "utf8")));
const epByName = new Map(EPISODES.map((e) => [e.nameKo, e]));

/* 성별 (tools/gender.json) — 나무위키 정보상자에서 수집.
 * '여성'·'남성'만 태그로 쓰고, '불명' 같은 값은 표시하지 않는다. */
const GENDER_PATH = path.join(ROOT, "tools/gender.json");
const GENDER = fs.existsSync(GENDER_PATH)
  ? JSON.parse(fs.readFileSync(GENDER_PATH, "utf8"))
  : {};
const VALID_GENDER = new Set(["여성", "남성", "남매"]);
const cleanGender = (g) => (VALID_GENDER.has(g) ? g : "");

/* ---------- 한글 → 로마자 (개정 로마자 표기법, id 생성용) ---------- */
const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const JONG = ["","k","k","k","n","n","n","t","l","l","l","l","l","l","l","l","m","p","p","t","t","ng","t","t","k","t","p","t"];

function romanize(str) {
  let out = "";
  for (const ch of str) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code <= 11171) {
      const cho = Math.floor(code / 588);
      const jung = Math.floor((code % 588) / 28);
      const jong = code % 28;
      out += CHO[cho] + JUNG[jung] + JONG[jong];
    } else {
      out += ch;
    }
  }
  return out;
}
function slugify(nameKo) {
  return romanize(nameKo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ---------- 기존 이미지/데이터와 호환되는 id 고정 ---------- */
const ID_OVERRIDE = {
  "emotion|하츄핑": "heartsping",
  "emotion|라라핑": "lalaping",
  "emotion|아자핑": "ajaping",
  "emotion|바로핑": "baroping",
  "emotion|해핑": "haeping",
  "emotion|차차핑": "chachaping",
  "emotion|화나핑": "roarping",
  "emotion|차나핑": "moseyping",
  "emotion|시러핑": "nonoping",
  "emotion|무셔핑": "spookping",
  "jewel|조아핑": "joaping",
  "jewel|방글핑": "banggeulping",
  "jewel|믿어핑": "mideoping",
  "jewel|토닥핑": "todakping",
  "key|행운핑": "luckyping",
  "key|나나핑": "nanaping",
  "key|꾸래핑": "kkuraeping",
  "dessert|새콤핑": "saekomping",
  "dessert|달콤핑": "dalkomping",
  "dessert|캔디핑": "candyping",
  "star|초롱핑": "chorongping",
  "star|빤짝핑": "banjjakping",
  "star|스타 하츄핑": "star-heartsping",
  "star|오로라핑": "auroraping",
  // 하츄핑 계열은 시즌마다 디자인이 달라 각각 별도 id 로 관리한다
  "jewel|다이아 하츄핑": "diamond-heartsping",
  "key|플로라 하츄핑": "flora-heartsping",
  "dessert|베리 하츄핑": "berry-heartsping",
  "princess|프린세스 하츄핑": "princess-heartsping",
};

/* ---------- 상세 인덱스 ---------- */
const stripPrefix = (n) => n.replace(/^(다이아|플로라|베리|프린세스|스타)\s?/, "");
const detailByKey = new Map();   // seasonKey|nameKo
const detailByName = new Map();  // nameKo(접두어 제거) — 유일할 때만 사용
const nameCount = new Map();
DETAILS.forEach((d) => {
  detailByKey.set(d.seasonKey + "|" + d.nameKo, d);
  const n = stripPrefix(d.nameKo);
  nameCount.set(n, (nameCount.get(n) || 0) + 1);
  if (!detailByName.has(n)) detailByName.set(n, d);
});

function findDetail(seasonKey, nameKo) {
  const exact = detailByKey.get(seasonKey + "|" + nameKo);
  if (exact) return exact;
  const n = stripPrefix(nameKo);
  if (nameCount.get(n) === 1) return detailByName.get(n);
  return null;
}

/* ---------- 색상: 상세에 없으면 시즌 색을 변주 ---------- */
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}
function seasonVariant(baseHex, i) {
  const [h, s, l] = hexToHsl(baseHex);
  // 인덱스마다 색상환을 넓게 돌려 카드가 단조롭지 않도록
  return hslToHex(h + i * 47, Math.min(0.85, Math.max(0.45, s)), Math.min(0.75, Math.max(0.55, l)));
}

/* ---------- 조립 ---------- */
const entries = [];
const agentIdToFinal = new Map(); // 리서치 임시 id → 최종 id (관계 재매핑용)

ROSTER.forEach((season) => {
  season.names.forEach((nameKo, i) => {
    const key = season.seasonKey + "|" + nameKo;
    const detail = findDetail(season.seasonKey, nameKo);
    const id = ID_OVERRIDE[key] || (detail && detail.id) || slugify(nameKo) || season.seasonKey + "-" + i;

    let grade = "일반";
    if (season.royal.includes(nameKo)) grade = "로열";
    else if (season.legend.includes(nameKo)) grade = "레전드";
    else if (season.villain.includes(nameKo)) grade = "빌런";

    if (detail) agentIdToFinal.set(detail.id, id);

    const ep = epByName.get(nameKo);

    entries.push({
      id,
      nameKo,
      nameEn: (detail && detail.nameEn) || "",
      season: season.season,
      seasonKey: season.seasonKey,
      grade,
      gender: cleanGender(GENDER[nameKo]),
      emotion: (detail && detail.emotion) || "",
      magic: MAGIC[nameKo] || "",
      episode: (ep && ep.episode) || "",
      // 에피소드 줄거리가 있으면 그것을 쓰고, 없으면 기존 설명을 유지한다
      story: (ep && ep.plot) || (detail && detail.story) || "",
      _rawRelations: (detail && detail.relations) || [],
      colorHex: (detail && detail.colorHex) || seasonVariant(season.color, i),
    });
  });
});

/* 중복 id 방지 */
const usedIds = new Set();
entries.forEach((e) => {
  if (!usedIds.has(e.id)) { usedIds.add(e.id); return; }
  let n = 2;
  while (usedIds.has(e.id + "-" + n)) n++;
  e.id = e.id + "-" + n;
  usedIds.add(e.id);
});

/* 관계 재매핑: 리서치 임시 id → 최종 id, 세트 밖은 제거 */
const validIds = new Set(entries.map((e) => e.id));
let dropped = 0;
entries.forEach((e) => {
  e.relations = e._rawRelations
    .map((r) => ({ id: agentIdToFinal.get(r.id) || r.id, label: r.label }))
    .filter((r) => {
      const ok = validIds.has(r.id) && r.id !== e.id;
      if (!ok) dropped++;
      return ok;
    });
  delete e._rawRelations;
});

/* 이미지 내용의 짧은 해시(imgv)를 기록한다. 이미지 URL 뒤에 ?v=<imgv> 를
 * 붙이기 위한 것이다. GitHub Pages 는 max-age=600 으로 응답하는데, 목록
 * 페이지는 방문할 때마다 썸네일 157장을 받으므로 브라우저에 전부 캐시된다.
 * 그림을 고쳐 배포해도 파일 이름이 같으면 캐시된 옛 그림이 계속 보인다
 * (개별 페이지는 그 캐릭터를 열어야 받으므로 캐시가 없어 바로 바뀐다 —
 *  같은 배포인데 목록만 안 바뀌는 것처럼 보이는 이유다).
 * 그림이 바뀌면 해시가 바뀌어 URL 이 달라지므로 즉시 반영된다. */
const imgHash = (p) =>
  fs.existsSync(p)
    ? crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex").slice(0, 8)
    : "";
entries.forEach((e) => {
  const v = imgHash(path.join(ROOT, "images", e.id + ".png"));
  if (v) e.imgv = v;
});

/* 관계 양방향 보정 (A→B 있으면 B→A 도 추가) */
const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
let added = 0;
entries.forEach((e) => {
  e.relations.forEach((r) => {
    const t = byId[r.id];
    if (t && !t.relations.some((x) => x.id === e.id)) {
      t.relations.push({ id: e.id, label: r.label });
      added++;
    }
  });
});

/* ---------- 출력 ---------- */
const header = `/* ===== 티니핑 데이터 (자동 생성) =====
 * 생성: node tools/build-data.mjs
 * 원본: tools/roster.js (PDF 도감 시즌1~6 전체 명단) + tools/details.js (위키 리서치 상세)
 * ⚠️ 이 파일을 직접 수정하지 마세요. tools/roster.js 또는 tools/details.js 를 고친 뒤 다시 빌드하세요.
 *
 * 등급: 로열 | 레전드 | 일반 | 빌런
 * 이미지: images/<id>.png (없으면 colorHex 기반 플레이스홀더 자동 사용)
 */
window.TEENIEPINGS = `;

const body = JSON.stringify(entries, null, 2);
fs.writeFileSync(path.join(ROOT, "data/teeniepings.js"), header + body + ";\n");

/* ---------- 리포트 ---------- */
const byGrade = {}, bySeason = {};
entries.forEach((e) => {
  byGrade[e.grade] = (byGrade[e.grade] || 0) + 1;
  bySeason[e.season] = (bySeason[e.season] || 0) + 1;
});
const withMagic = entries.filter((e) => e.magic).length;
const withEp = entries.filter((e) => e.episode).length;
console.log(`✅ data/teeniepings.js 생성 — 총 ${entries.length}마리`);
console.log("   등급:", byGrade);
console.log("   기수:", bySeason);
console.log(`   마법 설명: ${withMagic} / ${entries.length}`);
console.log(`   에피소드 줄거리: ${withEp} / ${entries.length}`);
console.log(`   관계: 양방향 보정 +${added}, 세트 밖 제거 ${dropped}`);
