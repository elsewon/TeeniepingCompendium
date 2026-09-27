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
  stopSpeaking();              // 카드가 통째로 바뀐다 — 읽던 이름의 버튼이 사라지므로 읽기도 멈춘다
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
         고쳐서 쓴다. 고치는 규칙은 js/hear.js 에 있다 (이름 맞추기와 같이 쓴다). */
      let head = "";
      for (let i = 0; i < e.results.length - 1; i++) head += e.results[i][0].transcript;
      const last = e.results[e.results.length - 1];
      const clean = (s) => fixHeard(cleanHeard(s));

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

  /* 화면을 떠나면(카드를 눌러 상세로 가기·뒤로 가기) 듣기를 그 자리에서 접는다.
     stop() 은 듣던 것을 마저 풀어 내놓고서야 onend 를 부르는데, 그 사이 페이지가
     얼어 붙으면(bfcache) '듣는 중' 표시를 안은 채 되살아난다. abort() 로 곧바로 끊고
     표시도 여기서 지운다. 처리기는 먼저 떼어 낸다 — 되살아난 뒤 새로 듣기 시작했을 때
     옛 인식기의 onend 가 뒤늦게 와서 새것을 끄면 안 된다.
     읽어 주기 쪽은 js/util.js 가 같은 때에 멈춘다. */
  window.addEventListener("pagehide", () => {
    if (!rec) return;
    const r = rec;
    r.onresult = r.onerror = r.onend = null;
    stopListening();
    try { r.abort(); } catch { /* 이미 끝난 인식기면 던질 수 있다 */ }
  });
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
