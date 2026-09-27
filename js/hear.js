/* ===== 들은 말 → 티니핑 이름 =====
   목록의 말해서 찾기(js/list.js)와 이름 맞추기의 말해서 맞히기(js/quiz.js)가 같이 쓴다.
   두 페이지만 싣는다 — js/util.js 에 두면 개별 페이지 157장이 쓰지도 않을 표를 싣는다.
   data/teeniepings.js 와 js/util.js(getAll) 뒤에 실어야 한다. */

/* ===== 들은 말 고치기 =====
 * 티니핑 이름은 사전에 없는 말이라 인식기가 제 나름대로 아는 낱말로 바꿔 놓는다.
 * "공쥬핑" 은 "공주핑" 으로, "하츄핑" 은 "하추핑" 으로, "까르핑" 은 "가르핑" 으로.
 *
 * 손으로 고른 표를 두지 않는다. 157마리 전부를 규칙으로 훑어 "비슷하게 들리는
 * 열쇠"를 만들어 두고, 들은 말의 열쇠가 그 중 하나와 같으면 진짜 이름으로 바꾼다.
 * 새 티니핑이 늘어도 표를 손볼 일이 없다.
 *
 * 열쇠는 한글을 자모로 풀어 "귀로 잘 안 갈리는 것끼리" 한 자리에 모은 것이다.
 *   된소리·거센소리를 예사소리로   ㄲㅋ→ㄱ  ㄸㅌ→ㄷ  ㅃㅍ→ㅂ  ㅆ→ㅅ  ㅉㅊ→ㅈ
 *   비슷한 홀소리를 한 자리로      ㅒㅔㅖ→ㅐ  ㅑ→ㅏ  ㅕ→ㅓ  ㅛ→ㅗ  ㅠ→ㅜ
 *   받침은 실제 소리대로 중화      ㅅㅆㅈㅊㅌㅎ→ㄷ  ㅋㄲ→ㄱ  ㅍ→ㅂ …
 * 띄어쓰기는 무시한다 ("공주 핑" 도 같은 열쇠). */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
const FOLD = {
  ㄲ: "ㄱ", ㅋ: "ㄱ", ㄸ: "ㄷ", ㅌ: "ㄷ", ㅃ: "ㅂ", ㅍ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ", ㅊ: "ㅈ",
  ㅒ: "ㅐ", ㅔ: "ㅐ", ㅖ: "ㅐ", ㅑ: "ㅏ", ㅕ: "ㅓ", ㅛ: "ㅗ", ㅠ: "ㅜ",
  ㅙ: "ㅚ", ㅞ: "ㅚ", ㅢ: "ㅣ",
};
/* 받침은 초성과 접는 방향이 다르다 — 소리가 일곱으로 중화된다 */
const FOLD_JONG = {
  ㄲ: "ㄱ", ㅋ: "ㄱ", ㄳ: "ㄱ", ㄺ: "ㄱ",
  ㅅ: "ㄷ", ㅆ: "ㄷ", ㅈ: "ㄷ", ㅊ: "ㄷ", ㅌ: "ㄷ", ㅎ: "ㄷ",
  ㅍ: "ㅂ", ㅄ: "ㅂ", ㄿ: "ㅂ",
  ㄼ: "ㄹ", ㄽ: "ㄹ", ㄾ: "ㄹ", ㅀ: "ㄹ", ㄵ: "ㄴ", ㄶ: "ㄴ", ㄻ: "ㅁ",
};

function sayKey(text) {
  let out = "";
  for (const ch of String(text).toLowerCase()) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) {
      if (/[a-z0-9]/.test(ch)) out += ch;      // 영문 이름도 있으므로 남긴다
      continue;
    }
    const cho = CHO[Math.floor(code / 588)];
    const jung = JUNG[Math.floor((code % 588) / 28)];
    const jong = JONG[code % 28].trim();
    out += (FOLD[cho] || cho) + (FOLD[jung] || jung) + (jong ? FOLD_JONG[jong] || jong : "");
  }
  return out;
}

/* 열쇠 → 이름. 두 이름이 같은 열쇠를 가지면(아야핑 / 아아핑) 아무것도 고르지 않고
   null 을 넣어 둔다 — 어느 쪽인지 모르는데 하나를 골라 주면 엉뚱한 것을 찾게 된다. */
/* 이름인지 곧바로 가리려고 따로 담아 둔다 (말해서 찾기의 후보 고르기에 쓴다) */
const NAMES = new Set(getAll().map((t) => t.nameKo));

const NAME_BY_KEY = (() => {
  const m = new Map();
  for (const t of getAll()) {
    const k = sayKey(t.nameKo);
    m.set(k, m.has(k) && m.get(k) !== t.nameKo ? null : t.nameKo);
  }
  return m;
})();

/* 들은 말을 이름으로 고친다. 못 고치면 들은 그대로 돌려준다 —
   "타르트" 처럼 이야기 속 낱말로 찾는 길도 열어 두어야 한다. */
function fixHeard(text) {
  const key = sayKey(text);
  if (!key) return text;

  const exact = NAME_BY_KEY.get(key);
  if (exact) return exact;

  /* 말이 끊겼을 때 이어 준다. "하추" 는 "하츄핑" 의 앞머리인데, 검색이 글자
     그대로 견주는 것이라 츄와 추가 달라 하나도 안 걸린다.
     두 글자(열쇠 4자) 이상이고 앞머리가 걸리는 이름이 딱 하나일 때만 이어 준다. */
  if (key.length >= 4) {
    let only = null;
    for (const [k, name] of NAME_BY_KEY) {
      if (!name || !k.startsWith(key)) continue;
      if (only) return text;              // 둘 이상이면 고르지 않는다
      only = name;
    }
    if (only) return only;
  }

  /* 가운데가 빠졌을 때 되살린다. 아이패드에서 "다이아 하츄핑" 이 "다이아 츄" 로
     들어왔는데, '하' 한 음절이 통째로 빠져 앞머리 맞추기로는 살릴 수 없다.
     들은 열쇠의 낱자가 이름 열쇠에 **차례대로** 들어 있으면(부분열) 같은 이름으로 본다.

     이것만으로는 너무 헐거워 「딸기→달콤핑」·「여유→여우핑」까지 바꿔 버린다.
     그래서 둘을 더 건다 — 들은 말이 세 음절 이상이고, 이름이 그보다 두 음절 넘게
     길지 않을 것. 이러면 「딸기」·「공주」·「프린세스」·「타르트」는 그대로 두고
     감정 84개 가운데 이름으로 바뀌는 것이 하나도 없다. */
  /* 들은 말이 이미 이름의 소리를 갖췄으면 손대지 않는다. NAME_BY_KEY 에 열쇠가
     있다는 것은 그 이름이거나, 아야핑/아아핑처럼 소리가 겹쳐 고르지 않기로 한
     짝이라는 뜻이다. 이때까지 부분열로 넘기면 「아야핑」이 「얌얌핑」이 된다. */
  const heard = syllables(text);
  if (heard >= 3 && !NAME_BY_KEY.has(key)) {
    let only = null;
    for (const [k, name] of NAME_BY_KEY) {
      if (!name) continue;
      const len = syllables(name);
      if (len < heard || len - heard > 2 || !subseq(key, k)) continue;
      if (only) return text;              // 둘 이상이면 고르지 않는다
      only = name;
    }
    if (only) return only;
  }
  return text;
}

/* 한글 낱자만 센다 (사이 띄어쓰기·기호는 뺀다) */
function syllables(text) {
  let n = 0;
  for (const ch of String(text)) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c <= 11171) n++;
  }
  return n;
}

/* a 의 글자가 b 안에 차례대로 다 나오나 */
function subseq(a, b) {
  let i = 0;
  for (const c of b) {
    if (c === a[i]) i++;
    if (i === a.length) return true;
  }
  return false;
}

/* 인식기는 문장 끝에 마침표를 붙이곤 한다 — 검색어에도 이름에도 군더더기다 */
function cleanHeard(s) {
  return String(s || "").replace(/[.。]\s*$/, "").trim();
}

/* 같은 이름으로 치나. 글자가 같거나 소리 열쇠가 같으면 같다고 본다 — 아야핑/아아핑처럼
   귀로 못 가르는 짝은 어느 쪽을 말했든 맞힌 것이다. */
function sameName(a, b) {
  return !!a && !!b && (a === b || sayKey(a) === sayKey(b));
}
