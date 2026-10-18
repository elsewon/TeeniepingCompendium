#!/usr/bin/env node
/* ===== data/teeniepings.js 빌드 =====
 *
 *   roster.js  (PDF 도감 시즌1~6 전체 명단 + 등급)   ← 권위 있는 명단
 * + details.js (위키 리서치 상세: 특징/사연/관계/영문명) ← 있으면 병합
 * + magic.js   (개별 페이지에 보여 줄 마법 설명)          ← 있으면 병합
 * + profile.json (나무위키·블로그·카페에서 모은 한 줄 소개/소품)   ← 있으면 병합
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

/* 에피소드 줄거리 (tools/ep-s*.json)
 *
 * 한 마리가 여러 회차에 걸쳐 나오기도 한다. 그런 경우 episodes 에 회차별로 나누어
 * 적는다 — 「6기 7화 …·19화 …」를 한 딱지에 몰아 놓고 줄거리도 한 덩어리로 두면
 * 어느 대목이 어느 화인지 읽는 사람이 갈라 내야 한다.
 *   { nameKo, episode, plot }              회차가 하나일 때 (지금 대부분)
 *   { nameKo, episodes: [{ episode, plot }] }   여러 회차일 때
 * 둘 다 받아 안에서 episodes 배열로 맞춘다. */
const EPISODES = fs.readdirSync(path.join(ROOT, "tools"))
  .filter((f) => /^ep-[\w-]+\.json$/.test(f))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "tools", f), "utf8")));
const epByName = new Map(EPISODES.map((e) => [e.nameKo, e]));

/* 어느 모양으로 적혀 있든 [{ episode, plot }] 로 돌려준다.
   회차 자료가 아예 없으면 details.js 의 설명이라도 회차 없이 담는다. */
function epList(ep, detail) {
  if (ep && Array.isArray(ep.episodes)) return ep.episodes.filter((e) => e && e.plot);
  if (ep && ep.plot) return [{ episode: ep.episode || "", plot: ep.plot }];
  if (detail && detail.story) return [{ episode: "", plot: detail.story }];
  return [];
}

/* 프로필 (tools/profile.json) — 세 출처에서 모은 값 (tools/fetch-profile.mjs).
 * 출처가 어긋나면 **나무위키를 따른다.** 두 곳에 다 있는 소품 106마리 가운데
 * 74마리는 글자까지 같고, 나머지는 대개 표기 차이다 (마법책/책 · 자석(말굽자석)/자석).
 *
 * 마법은 병합하지 않는다. 나무위키 칸은 주문명과 효과인데(「<약오르지롱> 막대사탕으로…」)
 * 도감의 magic 은 캐릭터를 풀어 쓴 서술문이라 성격이 다르다. 서술문을 그대로 둔다. */
const PROFILE_PATH = path.join(ROOT, "tools/profile.json");
const PROFILE = fs.existsSync(PROFILE_PATH)
  ? new Map(JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8")).map((r) => [r.nameKo, r]))
  : new Map();

const SEASON_NO = { emotion: 1, jewel: 2, key: 3, dessert: 4, star: 5, princess: 6 };

/* 나무위키 소품 값을 손보는 자리. profile.json 은 fetch-profile.mjs 가 다시 만들므로
   거기를 고치면 다음 수집에 지워진다. 고칠 것은 여기 적어 둔다. */
const ITEM_OVERRIDE = {
  "꺼꿀핑": "말굽자석",        // 나무위키는 「자석(말굽자석)」 — 괄호가 같은 말을 두 번 한다
};

/* 한 줄 소개도 같은 까닭으로 여기서 손본다. 줄 단위로 적고, 빈 배열은 소개를 비운다.
 * 나무위키에서 받은 소개가 깨지는 꼴은 넷이다.
 *
 * ① 문서에 소개꼴 인용문이 없어 og:description 으로 넘어간 것. 거기서는 줄바꿈이 사라져
 *    대사·소개·본문이 한 줄로 붙고, 100자 안팎에서 낱말 중간이라도 잘린다
 *    (뽀니핑 「…자신감의 뽀니핑 쾌활하면」). 각주 글이 끼었다 빠진 자리도 남는다
 *    (빤짝핑 「밝음 의 티니핑」). 문서 '개요' 절 첫머리의 공식 소개를 줄째 옮긴다.
 *    나무위키가 덧붙인 해설(「사실상 소원핑과 동일 분류」)은 옮기지 않는다
 * ② 인용문을 잘못 집은 것. 나나핑은 「6화의 나나핑을 상징하는 대사」가 소개꼴로 보여
 *    솔찌핑의 대사를 받았고, 다롱핑은 아롱핑과 문서를 같이 써서 언니 소개를 받았다
 * ③ 문장 가운데서 줄이 갈린 것. </strong> 을 줄바꿈으로 살리다 보니
 *    시러핑의 굵은 글씨 「"싫다"」 뒤에서 끊겼다
 * ④ 글에 오타가 있는 것. 또까핑 「쾌할하고」·덜덜핑 「새침떼기」는 나무위키 글이 그렇고,
 *    몰래핑 「훔치니」는 나무위키에서는 고쳐졌지만 profile.json 에 고치기 전 글이 남아 있다
 *
 * 옮길 때는 나무위키 문구를 살리되, 바로 이어지는 줄에서 같은 말이 겹치면 한쪽을 뺀다
 * (아름핑 「티 없이 맑고」, 뽀니핑 「쾌활」, 솔찌핑 「솔직함의 티니핑」). 길면 덜 드러나는
 * 줄을 덜고, 어색한 문장은 뜻을 지키며 다듬는다(아름핑·사뿐핑·뽀니핑). 소개 한 줄
 * 끝에는 부호를 둔다 — 읽어 주기는 칸의 글을 통째로 읽어서, 부호가 없으면 다음 줄과
 * 붙여 읽기 쉽다. */
const INTRO_OVERRIDE = {
  // ① og:description 에서 잘려 온 것
  "차차핑": [
    "“차차핑이 희망을 줄게, 차차~”",
    "어떤 힘든 상황이 와도 좌절하지 않는 희망의 티니핑!",
    "항상 낙관적으로 생각하는 너그럽고 믿음직스러운 배려의 아이콘.",
  ],
  "가면핑": [],   // 공식 소개가 없고 '개요'는 나무위키 해설뿐이다 — 틀린 말보다 빈 칸
  "솔찌핑": [
    "“나 솔찌핑이야! 솔직함의 티니핑~!”",
    "그러면 안 된다구, 솔찌!",
    "언제나 감정에 솔직한 요정.",
    "하고 싶은 말은 다 하는 투덜쟁이로,",
    "로미의 티니핑 캐치를 도와주는 미스틱마을의 로열 티니핑.",
  ],
  "행운핑": [
    "행운의 티니핑, 행운핑.",
    "나는 위대한 행운핑이라구!",
    "열쇠핑들을 보호하는 위대한 요정.",
    "로열 티니핑보다 더 강력한 마법의 힘을 가진 레전드 티니핑.",
  ],
  "샤샤핑": [
    "“난 차가운 걸 좋아하는 아이스크림의 요정이야, 샤샤~”",
    "긍정의 티니핑, 샤샤핑.",
    "언제 어느 때나 긍정적으로 생각하며 낙천적인 티니핑.",
    "배려심이 깊어, 남을 먼저 생각하고 양보하며",
    "다른 이의 말에 귀 기울이고,",
    "다정하게 모두를 아우르는 샤샤핑!",
  ],
  "빤짝핑": [
    "“밝음의 솜인형!”",
    "밝음의 티니핑, 빤짝핑.",
    "티 없이 밝고 무해한, 해맑고 엉뚱한 로열 티니핑!",
    "천재인지 바보인지 알 수 없는 괴짜!",
    "겁이 없어서 대담한 성격도 있다구~!",
  ],
  "빛나핑": [
    "“치유의 멜로디!”",
    "치유의 티니핑, 빛나핑.",
    "착한 마음씨에 감수성이 풍부해서",
    "작은 것에도 크게 공감하는 로열 티니핑.",
    "하지만 여린 마음속에 강단 있는 성격도 함께 있다구!",
  ],
  "초롱핑": [
    "“소망의 작은 별!”",
    "소망의 티니핑, 초롱핑.",
    "늘 자신감이 넘치며 활발한 말괄량이인 로열 티니핑!",
    "주목받는 것을 좋아하고 겁 없는 척 나서지만, 사실은 여린 구석이 있다구~!",
  ],
  "오로라핑": [
    "“약속의 힘으로, 우주를 이어 줘!”",
    "약속의 티니핑, 오로라핑.",
    "상냥하고 다정한 성격으로,",
    "강단 있으면서 기품이 넘치는 티니핑!",
    "별들을 보호해 주는 스타-레전드 티니핑이면서,",
    "왕자핑과의 엄청난 러브스토리를 보여주었지~!",
  ],
  "사뿐핑": [
    "“깃털처럼 우아하게~! 사뿐!”",
    "우아하고 예술적인 기품의 사뿐핑.",
    "부드러운 외형에 심지가 곧은 외유내강 성격이다.",
    "신비로운 분위기를 가지고 있으며, 몸으로 감정을 표현한다.",
    "주변에 무관심해 보여도, 사실은 누구보다 친구들을 눈여겨본다.",
  ],
  "아름핑": [
    "“벌써 아름다워~ 아름~! 역시 나야!”",
    "티 없이 맑고 명랑한 고움의 아름핑!",
    "순수하고 단순해서 마음이 이끄는 대로 행동한다.",
    "패션 감각은 천재적이지만, 다른 일에는 모두 서툴다.",
  ],
  "뽀니핑": [
    "“나 미용의 나라 출신이야, 뽀니! 프린세스의 머리도 다 내가 잘라줬지~!”",
    "쾌활하고 당찬 자신감의 뽀니핑!",
    "따뜻하고 여린 마음을 지닌 외강내유 성격으로, 맏언니 같은 리더십을 타고났다.",
    "친구들을 이끌며, 위험한 일이 있으면 먼저 나서서 보호한다.",
    "기분 전환엔 헤어스타일을 바꾸는 게 최고라 생각한다.",
  ],
  // ② 인용문을 잘못 집은 것
  "나나핑": [
    "“내 덕분에 바로 프린세스 로미를 찾은 거라구, 나나!”",
    "열심히 하자, 나나!",
    "언제나 파이팅이 넘치는 요정.",
    "자신만만하게 먼저 나서는 성격으로,",
    "로미의 티니핑 캐치를 도와주는 미스틱마을의 로열 티니핑.",
  ],
  "다롱핑": [
    "어울림의 티니핑, 다롱핑.",
    "몸으로 활동하길 좋아하고",
    "잘 지치지 않는 활발한 티니핑.",
    "활달하고 털털하지만,",
    "언니 앞에선 어리광 피우는 사랑스러운 동생!",
  ],
  // ③ 문장 가운데서 줄이 갈린 것
  "시러핑": [
    "거절은 거절한다! 거부감의 티니핑.",
    "뭐든지 “싫다”며 반대로 행동하고 말하는 까칠한 청개구리!",
  ],
  // ④ 오타
  "덜덜핑": [
    "겨울을 사랑하는, 차가움의 티니핑.",
    "싸우는 것을 싫어하지만, 집을 뺏기면 분노하는 새침데기.",
  ],
  "또까핑": [
    "다른 이의 모습으로 변신하고 싶은, 동경심의 티니핑.",
    "쾌활하고 발랄하지만, 어딘가 살-짝 부족한 느낌이 드는 허당 요정.",
  ],
  "몰래핑": [
    "빼앗음의 티니핑, 몰래핑.",
    "우주별 마을의 괴도!",
    "나쁜 마음을 훔치는 티니핑",
    "정의롭고 단호하지만",
    "엉뚱한 면도 있는 귀여운 친구야!",
  ],
};

/* 하츄핑 계열 5종은 나무위키가 문서를 공유해 소품이 한 칸에 뭉쳐 온다:
 *   「손거울(1기) → 하프(2기) → 향수(3기) → 핸드벨(4기) → 글로우 퍼프(5기) → 요술봉(6기)」
 * 버리고 블로그로 넘어가는 대신 기수로 갈라 각자에게 나눠 준다 — 이것도 나무위키 값이다.
 * 뭉쳐 있지 않은 보통 값은 손대지 않는다. */
function pickBySeason(value, seasonKey) {
  const no = SEASON_NO[seasonKey];
  if (!no || !/\(\d+기\)/.test(value)) return value;
  for (const part of value.split(/\n|→/)) {
    const m = /^(.*?)\s*\((\d+)기\)/.exec(part.trim());
    if (m && Number(m[2]) === no) return m[1].trim();
  }
  return "";
}

/* 나무위키를 먼저 보고, 비었을 때만 블로그를 쓴다.
   소개에서는 폭 없는 빈칸(U+200B 따위)을 걷어 낸다. 야옹핑 문서에는 「야옹핑」과 「!」
   사이에 끼어 있는데, 보이지는 않아도 줄이 그 자리에서 갈릴 수 있다. */
function fromProfile(nameKo, seasonKey) {
  const p = PROFILE.get(nameKo);
  if (!p) return { intro: "", item: "" };
  const lines = INTRO_OVERRIDE[nameKo];
  return {
    intro: (lines ? lines.join("\n") : p.intro.namu || "")
      .replace(/[\u200b\u2060\ufeff]/g, "").trim(),
    item: (ITEM_OVERRIDE[nameKo]
      || pickBySeason(p.item.namu || "", seasonKey) || p.item.blog || "").trim(),
  };
}

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
    const prof = fromProfile(nameKo, season.seasonKey);

    entries.push({
      id,
      nameKo,
      nameEn: (detail && detail.nameEn) || "",
      season: season.season,
      seasonKey: season.seasonKey,
      grade,
      gender: cleanGender(GENDER[nameKo]),
      emotion: (detail && detail.emotion) || "",
      intro: prof.intro,
      item: prof.item,
      magic: MAGIC[nameKo] || "",
      episodes: epList(ep, detail),
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
const withEp = entries.filter((e) => e.episodes.length).length;
console.log(`✅ data/teeniepings.js 생성 — 총 ${entries.length}마리`);
console.log("   등급:", byGrade);
console.log("   기수:", bySeason);
console.log(`   마법 설명: ${withMagic} / ${entries.length}`);
console.log(`   에피소드 줄거리: ${withEp} / ${entries.length}`);
console.log(`   관계: 양방향 보정 +${added}, 세트 밖 제거 ${dropped}`);
