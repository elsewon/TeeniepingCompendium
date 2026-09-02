/* ===== 목록 페이지: 검색 + 기수/등급/좋아요 필터 ===== */
/* 검색·필터 상태는 URL 에 담는다.
   그래야 개별 페이지에 다녀와도 목록이 그대로 유지되고, 링크 공유도 된다. */
const params = new URLSearchParams(location.search);
const state = {
  q: params.get("q") || "",
  season: params.get("season") || null,
  grade: params.get("grade") || null,
  liked: params.get("liked") === "1",
};

/* 현재 상태를 주소창에 반영 (뒤로가기 기록은 늘리지 않는다) */
function syncURL() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.season) p.set("season", state.season);
  if (state.grade) p.set("grade", state.grade);
  if (state.liked) p.set("liked", "1");
  const qs = p.toString();
  history.replaceState(null, "", qs ? "?" + qs : location.pathname);
}

function buildFilters() {
  const sEl = document.getElementById("seasonFilters");
  uniqueSeasons().forEach(({ label }) => {
    const b = document.createElement("button");
    b.className = "chip season";
    b.textContent = label;
    b.onclick = () => {
      state.season = state.season === label ? null : label;
      syncChips(); render();
    };
    b.dataset.season = label;
    sEl.appendChild(b);
  });

  const gEl = document.getElementById("gradeFilters");
  uniqueGrades().forEach((grade) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = grade;
    b.onclick = () => {
      state.grade = state.grade === grade ? null : grade;
      syncChips(); render();
    };
    b.dataset.grade = grade;
    gEl.appendChild(b);
  });
}

function syncChips() {
  document.querySelectorAll("[data-season]").forEach((el) => {
    el.classList.toggle("active", el.dataset.season === state.season);
  });
  document.querySelectorAll("[data-grade]").forEach((el) => {
    el.classList.toggle("active", el.dataset.grade === state.grade);
  });
  document.querySelectorAll("[data-liked]").forEach((el) => {
    el.classList.toggle("active", state.liked);
  });
}

/* 좋아요 칩은 기수·등급과 달리 데이터에서 만들지 않는다 (값이 하나뿐이라
   index.html 에 그대로 적혀 있다). 눌리면 켜고 끈다. */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-liked]");
  if (!el) return;
  state.liked = !state.liked;
  syncChips(); render();
});

/* 검색 대상과 우선순위 — 이름 → 감정 → 소개 → 마법.
 *
 * 앞에 적은 밭에서 걸린 것이 앞에 선다. "하츄핑"으로 찾으면 하츄핑이 먼저 나오고,
 * 남의 소개나 마법 글에 그 이름이 나오는 마리가 뒤따른다.
 *
 * 감정이 이름 바로 다음이다. 「사랑」·「올바름」처럼 낱말 하나라 스치듯 걸리는 일이
 * 없고, 그 마리를 한마디로 이르는 말이라 이름에 버금간다. 뒤에 두었더니 「사랑」으로
 * 찾을 때 감정이 곧 '사랑'인 하츄핑이, 소개에 그 말이 스친 마리들 뒤로 밀렸다.
 *
 * 에피소드 제목과 줄거리는 뒤지지 않는다. 줄거리는 마리당 수백 자라 아무 낱말이나
 * 걸린다 — "하츄핑" 하나로 41마리가 나왔고, 그중 35마리는 남의 줄거리에 이름이
 * 스쳤을 뿐이었다.
 *
 * 한 글자로 찾을 때는 짧은 밭(이름·감정)만 본다. 긴 글까지 넣으면 "핑" 하나로
 * 157마리가 그대로 남아 걸러 주는 것이 없다. 두 글자부터 소개와 마법도 뒤져
 * "눈물", "타르트" 처럼 이야기 속 낱말로 찾을 수 있다. */
const SEARCH = [
  { key: "nameKo", short: true },
  { key: "emotion", short: true },
  { key: "intro" },
  { key: "magic" },
];

/* 소문자로 바꾼 값을 밭마다 캐시해 둔다 — 글자를 칠 때마다 157마리 × 4밭을
   다시 소문자로 바꾸면 그만큼을 매번 훑게 된다. */
function field(t, key) {
  const c = "_lc_" + key;
  if (t[c] === undefined) t[c] = String(t[key] || "").toLowerCase();
  return t[c];
}

/* 몇 번째 밭에서 걸렸나. 어디에도 안 걸리면 -1 */
function hitRank(t, q) {
  const deep = q.length >= 2;
  for (let i = 0; i < SEARCH.length; i++) {
    if (!deep && !SEARCH[i].short) continue;
    if (field(t, SEARCH[i].key).includes(q)) return i;
  }
  return -1;
}

const LIKE_PREFIX = "ping-liked-";

/* 이 기기에서 좋아요를 누른 id 들. 개별 페이지가 localStorage 에 남긴다
   (js/page.js 의 'ping-liked-<id>'). 서버에 묻지 않으므로 기기마다 다르다. */
function likedIds() {
  const out = new Set();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LIKE_PREFIX) && localStorage.getItem(k) === "1") {
        out.add(k.slice(LIKE_PREFIX.length));
      }
    }
  } catch { /* 사파리 비공개 모드 등에서 막히면 빈 채로 둔다 */ }
  return out;
}
let liked = likedIds();

function matches(t) {
  if (state.season && t.season !== state.season) return false;
  if (state.grade && t.grade !== state.grade) return false;
  if (state.liked && !liked.has(t.id)) return false;
  if (state.q && hitRank(t, state.q.toLowerCase()) < 0) return false;
  return true;
}

function cardHTML(t) {
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  const back = location.search ? "?from=" + encodeURIComponent(location.search) : "";
  // 카드 자체가 <a> 였을 때는 이름 옆에 읽어 주기 버튼을 둘 수 없었다 (링크 안의
  // 버튼). 인기 차트의 행처럼 카드를 <div> 로 두고 투명한 링크를 위에 겹쳐 깐다.
  return `<div class="card">
    <a class="card-hit" href="${pingHref(t.id)}${back}" aria-label="${t.nameKo} 자세히 보기"></a>
    <div class="thumb">${imageMarkup(t, 260)}</div>
    <div class="body">
      <div class="name-row">
        <div class="name">${t.nameKo}</div>
        ${speakBtnHTML(t.nameKo)}
      </div>
      <div class="tags">
        <span class="tag season">${t.season}</span>
        <span class="tag ${gradeClass}">${t.grade}</span>
        ${t.gender ? `<span class="tag gender-${t.gender}">${t.gender}</span>` : ""}
      </div>
    </div>
  </div>`;
}

function render() {
  syncURL();
  liked = likedIds();          // 개별 페이지에 다녀오는 사이에 늘었을 수 있다
  const list = getAll().filter(matches);

  /* 걸린 밭이 앞선 것을 앞에 놓는다. sort 는 같은 값끼리 차례를 흩뜨리지 않으므로
     각 무리 안의 순서는 데이터 그대로다. */
  if (state.q) {
    const q = state.q.toLowerCase();
    const r = new Map(list.map((t) => [t, hitRank(t, q)]));
    list.sort((a, b) => r.get(a) - r.get(b));
  }

  const grid = document.getElementById("grid");
  grid.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<div class="empty" style="grid-column:1/-1">${
        state.liked && !liked.size
          ? "아직 좋아요를 누른 티니핑이 없어요 ❤️"
          : "조건에 맞는 티니핑이 없어요 🥲"}</div>`;
}

const searchEl = document.getElementById("search");
const clearEl = document.getElementById("clearSearch");

function syncClearBtn() {
  clearEl.hidden = searchEl.value.length === 0;
}

searchEl.addEventListener("input", (e) => {
  state.q = e.target.value.trim();
  syncClearBtn();
  render();
});

clearEl.addEventListener("click", () => {
  searchEl.value = "";
  state.q = "";
  syncClearBtn();
  render();
  searchEl.focus();
});

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

/* ===== 말해서 찾기 =====
 * 글을 못 읽는(또는 아직 자판이 서툰) 아이가 이름을 말해서 찾을 수 있게 한다.
 * 브라우저의 음성 인식(Web Speech)을 쓴다 — https 와 마이크 허락이 필요하다.
 *
 * 말하는 도중의 중간 결과(interim)도 검색창에 바로 넣는다. 다 말할 때까지 아무
 * 반응이 없으면 아이는 안 되는 줄 알고 또 누른다. 목록도 그때그때 걸러진다.
 *
 * 음성 인식이 없는 브라우저(파이어폭스 등)에서는 버튼을 아예 감춘다 —
 * 눌러도 아무 일이 없는 버튼이 남는 편보다 낫다 (읽어 주기 버튼과 같은 판단). */
const micEl = document.getElementById("micSearch");
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!Recognition) {
  micEl.hidden = true;
} else {
  let rec = null;

  const stopListening = () => {
    micEl.classList.remove("listening");
    rec = null;
  };

  const setQuery = (text) => {
    searchEl.value = text;
    state.q = text.trim();
    syncClearBtn();
    render();
  };

  micEl.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }        // 듣는 중에 또 누르면 그만 듣는다

    rec = new Recognition();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = false;
    /* 인식기가 내놓는 후보를 셋까지 받는다. 티니핑 이름은 사전에 없는 말이라
       첫 후보가 자주 어긋나는데, 뒤 후보가 이름으로 곧장 풀리는 일이 잦다.
       후보를 안 주는 브라우저에서는 하나만 오므로 예전과 똑같이 움직인다. */
    rec.maxAlternatives = 3;

    rec.onresult = (e) => {
      /* 중간 결과까지 이어 붙인다 — 말하는 대로 검색창이 따라 찬다.
         앞선 결과는 이미 굳은 것이라 첫 후보만 쓰고, 마지막 결과에서만 후보를
         견준다. 이름으로 딱 떨어지는 후보가 있으면 그것을 쓰고, 없으면 첫 후보를
         고쳐서 쓴다. 인식기는 문장 끝에 마침표를 붙이곤 하는데 검색어에는 군더더기다. */
      let head = "";
      for (let i = 0; i < e.results.length - 1; i++) head += e.results[i][0].transcript;
      const last = e.results[e.results.length - 1];
      const clean = (s) => fixHeard(String(s).replace(/[.。]\s*$/, "").trim());

      let first = null;
      for (let i = 0; i < last.length; i++) {
        const guess = clean(head + last[i].transcript);
        if (first === null) first = guess;
        if (NAMES.has(guess)) { first = guess; break; }
      }
      setQuery(first || "");
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        showToast("마이크를 쓸 수 없어요 🥲", micEl);
      } else if (e.error === "no-speech") {
        showToast("잘 못 들었어요. 다시 말해 볼까요? 🥲", micEl);
      }
      stopListening();
    };
    rec.onend = stopListening;

    micEl.classList.add("listening");
    try {
      rec.start();
    } catch {
      stopListening();          // 이미 듣고 있으면 start 가 던진다
    }
  });

  // 자판으로 치기 시작하면 듣기를 멈춘다 (둘이 같은 칸을 두고 다투지 않게)
  searchEl.addEventListener("input", () => { if (rec) rec.stop(); });
}

// esc 로도 지우기
searchEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && searchEl.value) {
    e.preventDefault();
    clearEl.click();
  }
});

/* 스크롤 위치도 함께 되살린다 */
const SCROLL_KEY = "teenieping:list-scroll";
window.addEventListener("pagehide", () => {
  sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ s: location.search, y: window.scrollY }));
});

buildFilters();
syncChips();                 // URL 에서 복원한 필터를 칩에 반영
searchEl.value = state.q;
syncClearBtn();
render();

try {
  const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null");
  if (saved && saved.s === location.search && saved.y > 0) {
    requestAnimationFrame(() => window.scrollTo(0, saved.y));
  }
} catch (_) { /* 저장값이 깨졌으면 무시 */ }
