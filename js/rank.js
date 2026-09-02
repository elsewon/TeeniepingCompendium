/* ===== 인기 차트 =====
 * 방문·좋아요 수는 Cloudflare Worker 가 세고 있다 (worker/counter.js).
 * 여기서는 /rank 를 불러 순위를 그린다. 이름과 그림은 data/teeniepings.js 에서 가져온다.
 *
 * 기간은 주·월 둘이고 달력 기준이다 — 주는 월요일 시작, 월은 1일 시작(모두 한국 시각).
 * 일간은 두지 않는다. 하루치는 표본이 너무 적어 한두 번의 조회로 순위가 뒤집힌다.
 * 이전/다음 기간은 여기서 날짜를 계산해 at 으로 넘긴다.
 *
 * 첫 화면은 집계가 끝난 직전 기간을 연다. 이번 기간은 아직 차오르는 중이라
 * 순위가 하루에도 뒤집히고, 다 채워진 쪽이 견주어 볼 것이 많다. 이번 기간에는
 * 다음(›) 한 번으로 가고, 그때는 기간 이름 옆에 (집계중) 이 붙는다.
 */
const RANK_API = "https://teenieping-counter.elsewon.workers.dev";

const el = {
  periodTabs: document.getElementById("periodTabs"),
  prev: document.getElementById("prevBtn"),
  next: document.getElementById("nextBtn"),
  range: document.getElementById("rankRange"),
  like: document.getElementById("likeList"),
  visit: document.getElementById("visitList"),
};

/* 줄 세우는 기준 두 가지. 화면에 나오는 차례이자 행 안의 숫자 차례이기도 하다.
   들인 수고가 적은 것부터 — 조회는 열기만 해도 오르고, 좋아요는 기기당 한 번뿐이라
   더 진심에 가깝다 (worker/counter.js 의 SCORE 와 같은 차례). */
const SORTS = [
  { key: "visit", label: "조회" },
  { key: "like", label: "좋아요" },
];

const state = { period: "week", at: null, now: null };

/* ── 기간 계산 ────────────────────────────────── */
const day = (iso) => new Date(iso + "T00:00:00Z");
const iso = (d) => d.toISOString().slice(0, 10);

function shift(period, at, step) {
  if (period === "month") {
    const [y, m] = at.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + step, 1));
    return d.toISOString().slice(0, 7);
  }
  return iso(new Date(day(at).getTime() + step * 7 * 86400000));
}

/* 지금이 어느 기간인지. worker/counter.js 의 seoulParts 와 같은 셈을 여기서도 한다 —
   첫 화면을 직전 기간으로 열려면 응답을 받기 전에 알아야 하기 때문이다.
   한국 시각으로 옮긴 뒤 UTC 달력을 읽으므로 보는 기기의 시간대와 상관없다. */
function seoulNow(period) {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  if (period === "month") return d.toISOString().slice(0, 7);
  const dow = (d.getUTCDay() + 6) % 7;                       // 월=0 … 일=6
  return new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10);
}

/* 첫 화면에 열 기간 — 집계가 끝난 직전 것. 기기 시계가 어긋나 엉뚱한 기간을 물어도
   (집계중) 표시는 응답의 now 로 가리므로 표시까지 함께 틀리지는 않는다. */
const defaultAt = (period) => shift(period, seoulNow(period), -1);

/* ISO 8601 주 번호. 그 주의 목요일이 속한 해가 그 주의 연도다 —
   그래서 2024-12-30 월요일은 "2025년 1주", 2026-12-28 은 "2026년 53주" 가 된다. */
function isoWeek(mondayIso) {
  const thu = new Date(day(mondayIso).getTime() + 3 * 86400000);
  const year = thu.getUTCFullYear();
  const week = Math.floor((thu.getTime() - Date.UTC(year, 0, 1)) / 86400000 / 7) + 1;
  return `${year}년 ${week}주`;
}

function rangeLabel(period, at) {
  if (period === "month") {
    const [y, m] = at.split("-");
    return `${y}년 ${Number(m)}월`;
  }
  return isoWeek(at);
}

/* ── 그리기 ──────────────────────────────────── */
/* 직전 기간 대비 오르내림. 비교할 기록이 없으면 delta 자체가 오지 않는데,
   그때도 빈 칸을 내보낸다 — 순위 숫자 아래 자리를 늘 같은 높이로 잡아 두어야
   숫자가 그림과 수직 가운데에 그대로 선다 (css 의 .rank-no 참고). */
function deltaHTML(row) {
  if (!("delta" in row)) return `<em class="rank-delta"></em>`;
  if (row.was == null) return `<em class="rank-delta new">신규</em>`;
  if (row.delta === 0) return `<em class="rank-delta same">–</em>`;
  return row.delta > 0
    ? `<em class="rank-delta up">▲${row.delta}</em>`
    : `<em class="rank-delta down">▼${-row.delta}</em>`;
}

function rowHTML(row, i, sort) {
  const t = getById(row.id);
  if (!t) return "";
  const n = (v) => Number(v || 0).toLocaleString("ko-KR");
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  // 두 값을 다 보여 주되, 그 목록이 줄 세우는 값을 맨 위에 굵게 놓는다.
  // 순위가 그 값으로 매겨지니 눈이 먼저 닿는 자리에 있어야 한다.
  // 아래 줄(다른 값)은 곁들이면서, 같은 값에서 순위가 갈릴 때 그 까닭이 되어 준다 —
  // 좋아요가 나란히 5인데 순위가 다르면 그 아래 조회수가 다르다.
  const nums = [...SORTS.filter((s) => s.key === sort), ...SORTS.filter((s) => s.key !== sort)]
    .map(({ key, label }) =>
      `<span>${label} ${key === sort ? `<b>${n(row[key])}</b>` : n(row[key])}</span>`)
    .join("");
  // 행 자체가 <a> 였을 때는 이름 옆에 읽어 주기 버튼을 둘 수 없었다
  // (링크 안의 버튼). 지금은 행을 <div> 로 두고 투명한 링크를 위에 겹쳐 깐다.
  return `<div class="rank-row">
    <a class="rank-hit" href="${pingHref(t.id)}" aria-label="${t.nameKo} 자세히 보기"></a>
    <span class="rank-no"><b>${row.rank || i + 1}</b>${deltaHTML(row)}</span>
    <span class="rank-thumb">${imageMarkup(t, 120)}</span>
    <span class="rank-body">
      <span class="rank-text">
        <span class="rank-name-row">
          <span class="rank-name">${t.nameKo}</span>
          ${speakBtnHTML(t.nameKo)}
        </span>
        <span class="rank-tags">
          <span class="tag season">${t.season}</span>
          <span class="tag ${gradeClass}">${t.grade}</span>
        </span>
      </span>
      <span class="rank-nums">${nums}</span>
    </span>
  </div>`;
}

function fill(box, rows, sort, what) {
  box.innerHTML = rows && rows.length
    ? rows.map((r, i) => rowHTML(r, i, sort)).join("")
    : `<div class="empty">이 기간에는 ${what} 기록이 없어요 🌱</div>`;
}

function render(data) {
  if (!data) {
    const oops = `<div class="empty">순위를 불러오지 못했어요 🥲</div>`;
    SORTS.forEach(({ key }) => { el[key].innerHTML = oops; });
    return;
  }
  state.at = data.at;
  state.now = data.now;

  // 아직 오지 않은 기간으로는 갈 수 없다
  const now = data.period === "month" ? data.now.month : data.now.week;
  // 이번 기간은 숫자가 아직 차오르는 중이라 순위가 굳지 않았다 — 기간 이름 옆에 그렇게 적는다.
  // at 과 now 모두 서버가 준 값이라 보는 기기의 시계와 어긋나도 이 표시는 틀리지 않는다.
  el.range.innerHTML = rangeLabel(data.period, data.at)
    + (data.at === now ? ` <em class="rank-live">(집계중)</em>` : "");
  el.next.disabled = data.at >= now;

  SORTS.forEach(({ key, label }) => fill(el[key], data[key], key, label));
}

async function load() {
  const loading = `<div class="empty">불러오는 중…</div>`;
  SORTS.forEach(({ key }) => { el[key].innerHTML = loading; });
  const at = state.at ? `&at=${encodeURIComponent(state.at)}` : "";
  try {
    const res = await fetch(`${RANK_API}/rank?period=${state.period}${at}&limit=10`,
      { mode: "cors", cache: "no-store", signal: timeoutSignal(STATS_TIMEOUT) });
    render(res.ok ? await res.json() : null);
  } catch {
    render(null);
  }
}

/* ── 조작 ────────────────────────────────────── */
function pickTab(tabs, btn, key) {
  [...tabs.children].forEach((b) => b.classList.toggle("active", b === btn));
  state[key] = btn.dataset[key];
}

el.periodTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-period]");
  if (!btn) return;
  pickTab(el.periodTabs, btn, "period");
  state.at = defaultAt(state.period);   // 기간 단위가 바뀌면 다시 직전 기간부터
  load();
});

el.prev.addEventListener("click", () => {
  state.at = shift(state.period, state.at, -1);
  load();
});
el.next.addEventListener("click", () => {
  if (el.next.disabled) return;
  state.at = shift(state.period, state.at, 1);
  load();
});

state.at = defaultAt(state.period);
load();
