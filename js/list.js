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

function matches(t) {
  if (state.season && t.season !== state.season) return false;
  if (state.grade && t.grade !== state.grade) return false;
  if (state.q) {
    const q = state.q.toLowerCase();
    const hay = (t.nameKo + " " + (t.emotion || "")).toLowerCase();
    if (!hay.includes(q)) return false;
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
