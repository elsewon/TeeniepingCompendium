/* ===== 목록 페이지: 검색 + 기수/등급 필터 ===== */
/* 검색·필터 상태는 URL 에 담는다.
   그래야 개별 페이지에 다녀와도 목록이 그대로 유지되고, 링크 공유도 된다. */
const params = new URLSearchParams(location.search);
const state = {
  q: params.get("q") || "",
  season: params.get("season") || null,
  grade: params.get("grade") || null,
};

/* 현재 상태를 주소창에 반영 (뒤로가기 기록은 늘리지 않는다) */
function syncURL() {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.season) p.set("season", state.season);
  if (state.grade) p.set("grade", state.grade);
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
}

/* 검색 대상 — 한 글자면 이름·감정만, 두 글자부터는 마법 설명과 에피소드까지 뒤진다.
 *
 * 한 글자에 긴 글까지 넣으면 거의 다 걸린다. "핑" 하나로 157마리가 그대로 남는 식이라
 * 걸러 주는 것이 없다. 두 글자부터는 "눈물", "타르트" 처럼 이야기 속 낱말로 찾을 수 있다.
 *
 * 뒤질 글이 5만 자가 넘으므로(157마리 × 수백 자) 한 번 만든 것은 캐시해 둔다 —
 * 글자를 칠 때마다 다시 이어 붙이고 소문자로 바꾸면 그만큼을 매번 훑게 된다. */
function haystack(t, deep) {
  const key = deep ? "_hayDeep" : "_hay";
  if (t[key] === undefined) {
    const parts = deep
      ? [t.nameKo, t.emotion, t.magic, t.episode, t.story]
      : [t.nameKo, t.emotion];
    t[key] = parts.filter(Boolean).join(" ").toLowerCase();
  }
  return t[key];
}

function matches(t) {
  if (state.season && t.season !== state.season) return false;
  if (state.grade && t.grade !== state.grade) return false;
  if (state.q) {
    const q = state.q.toLowerCase();
    if (!haystack(t, q.length >= 2).includes(q)) return false;
  }
  return true;
}

function cardHTML(t) {
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  const back = location.search ? "?from=" + encodeURIComponent(location.search) : "";
  return `<a class="card" href="${pingHref(t.id)}${back}">
    <div class="thumb">${imageMarkup(t, 260)}</div>
    <div class="body">
      <div class="name">${t.nameKo}</div>
      <div class="tags">
        <span class="tag season">${t.season}</span>
        <span class="tag ${gradeClass}">${t.grade}</span>
        ${t.gender ? `<span class="tag gender-${t.gender}">${t.gender}</span>` : ""}
      </div>
    </div>
  </a>`;
}

function render() {
  syncURL();
  const list = getAll().filter(matches);

  /* 이름에 걸린 것을 앞에 놓는다. 긴 글까지 뒤지면 "하츄핑" 하나로 41마리가 나오는데
     (남의 줄거리에 그 이름이 나오는 마리까지 딸려 온다) 정작 찾던 하츄핑이 뒤로
     밀리면 안 된다. 뒤에 오는 것들도 버리지 않는다 — 그 이야기에 나온다는 것 자체가
     알 만한 일이라, 이름으로 찾다가 딸려 오는 것이 오히려 재미다.
     sort 는 같은 값끼리 차례를 흩뜨리지 않으므로 각 무리 안의 순서는 그대로다. */
  if (state.q.length >= 2) {
    const q = state.q.toLowerCase();
    const rank = (t) => (haystack(t, false).includes(q) ? 0 : 1);
    list.sort((a, b) => rank(a) - rank(b));
  }

  const grid = document.getElementById("grid");
  document.getElementById("count").textContent = `${list.length}마리`;
  grid.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : "";
  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">조건에 맞는 티니핑이 없어요 🥲</div>`;
  }
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
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      // 중간 결과까지 이어 붙인다 — 말하는 대로 검색창이 따라 찬다
      let text = "";
      for (const r of e.results) text += r[0].transcript;
      // 인식기는 문장 끝에 마침표를 붙이곤 한다. 검색어에는 군더더기다.
      setQuery(text.replace(/[.。]\s*$/, ""));
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
