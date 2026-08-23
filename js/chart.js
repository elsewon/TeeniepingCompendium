/* ===== 통계 그래프 =====
 * Worker 의 /series 를 불러 목록·이름 맞추기·인기 차트의 방문·공유 추이를 그린다.
 *
 * 여섯 줄을 색 여섯 가지로 나누는 대신 **영역 3색 × 선 모양 2종**으로 묶었다.
 * 데이터가 원래 (영역 × 방문/공유) 구조라 그 구조를 그대로 보여 주고,
 * 색이 세 가지뿐이라 색각 이상에서도 구별이 쉽다(모든 짝에서 검사 통과).
 *
 * 색에만 기대지 않도록 실선(방문) 끝에 영역 이름을 직접 붙이고,
 * 범례·십자선 툴팁·표 보기를 함께 둔다.
 *
 * 통계 페이지(stats.html) 자체는 세지 않으므로 여기에도 나오지 않는다.
 */
const CHART_API = "https://teenieping-counter.elsewon.workers.dev";

/* 읽기 요청에 fresh=1 을 붙인다. 통계 서버는 읽기 응답을 엣지에 캐시해 두고 만료돼도
   일단 그것을 내주는데(빠르지만 묵은 값), 이 페이지는 숫자를 확인하러 들어오는 곳이라
   그러면 새로고침을 두 번 누르게 된다. 여기서만 캐시를 건너뛴다 —
   꼬리말 숫자나 인기 차트는 그대로 캐시를 쓴다. */
let days = 7;

/* 색은 dataviz 팔레트의 1~3번 슬롯. 세 색은 모든 짝에서 검사를 통과한다. */
/* 켜고 끄는 것은 낱낱의 선이 아니라 '영역'과 '선 모양'이다. 범례가 색 3개와
   선 모양 2개로만 되어 있으므로(drawLegend) 그 둘의 곱이 곧 보이는 선이 된다. */
const SCOPES = [
  { key: "list", label: "목록", on: true },
  { key: "quiz", label: "이름 맞추기", on: true },
  { key: "rank", label: "인기 차트", on: true },
];
const KINDS = [
  { key: "visit", label: "방문", dash: "", on: true },
  { key: "share", label: "공유", dash: "5 4", on: true },
];
const SERIES = SCOPES.flatMap((sc, i) =>
  KINDS.map((k) => ({
    id: `${sc.key}:${k.key}`,
    label: `${sc.label} ${k.label}`,
    color: `var(--series-${i + 1})`,
    dash: k.dash,
    scope: sc,
    kind: k,
  })));
const shownSeries = () => SERIES.filter((s) => s.scope.on && s.kind.on);

const el = {
  spanTabs: document.getElementById("spanTabs"),
  tiles: document.getElementById("tiles"),
  legend: document.getElementById("chartLegend"),
  plot: document.getElementById("chartPlot"),
  csvDownload: document.getElementById("csvDownload"),
  inflow: document.getElementById("inflowList"),
  refTabs: document.getElementById("refTabs"),
};

/* 주소가 없는 공유 링크에만 이름을 붙여 준다.
   리퍼러가 없는 방문은 아예 세지 않으므로(js/stats.js) 여기 올 일이 없다. */
const REF_LABEL = { _share: "공유 링크" };
let refDays = 7;        // 첫 칸(최근 7일)과 맞춘다

let data = null;

/* ── 값 만들기 ──────────────────────────────────
   누적선만 그린다. 전체 누적에서 구간 안의 합을 빼면 구간 시작 직전까지의 값이
   나오므로, 구간 밖의 과거 기록까지 반영된 진짜 누적선이 된다. */
function valuesOf(id) {
  const daily = data.daily[id] || [];
  const inWindow = daily.reduce((a, b) => a + b, 0);
  let running = (data.totals[id] || 0) - inWindow;
  return daily.map((v) => (running += v));
}

/* ── 그리기 ──────────────────────────────────── */
const W = 760, H = 340, M = { top: 14, right: 84, bottom: 30, left: 46 };
const plotW = W - M.left - M.right;
const plotH = H - M.top - M.bottom;

function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p * 2) / 2 * p;      // 1, 1.5, 2 … 단위로 올림
}

function draw() {
  const shown = shownSeries();
  const all = shown.flatMap((s) => valuesOf(s.id));
  const max = niceMax(Math.max(1, ...all));
  const n = data.dates.length;
  const x = (i) => M.left + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v) => M.top + plotH - (plotH * v) / max;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const grid = [...new Set(ticks)].map((v) => `
    <line class="grid" x1="${M.left}" y1="${y(v)}" x2="${W - M.right}" y2="${y(v)}"/>
    <text class="tick" x="${M.left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");

  // 날짜는 6개쯤만 (겹치지 않게)
  const step = Math.max(1, Math.ceil(n / 6));
  const xlabels = data.dates.map((d, i) =>
    (i % step === 0 || i === n - 1)
      ? `<text class="tick" x="${x(i)}" y="${H - 10}" text-anchor="middle">${d.slice(5).replace("-", "/")}</text>`
      : "").join("");

  const lines = shown.map((s) => {
    const pts = valuesOf(s.id).map((v, i) => `${x(i)},${y(v)}`).join(" ");
    return `<polyline class="line" points="${pts}" stroke="${s.color}"
      ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
  }).join("");

  /* 색에만 기대지 않도록 실선(방문) 끝에 영역 이름을 직접 붙인다.
     겹치면 아래로 밀어 12px 간격을 확보한다. */
  const ends = shown.filter((s) => !s.dash)
    .map((s) => ({ s, y: y(valuesOf(s.id)[n - 1]) }))
    .sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => {
    if (i > 0 && e.y - ends[i - 1].y < 12) e.y = ends[i - 1].y + 12;
  });
  const endLabels = ends.map((e) => `<text class="end-label" x="${W - M.right + 8}"
    y="${Math.min(e.y + 4, H - M.bottom)}" fill="${e.s.color}">${e.s.label}</text>`).join("");

  el.plot.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="영역별 방문·공유 추이">
      ${grid}${xlabels}${lines}${endLabels}
      <g id="hoverLayer"></g>
      <rect id="hitArea" x="${M.left}" y="${M.top}" width="${plotW}" height="${plotH}" fill="transparent"/>
    </svg>
    <div class="chart-tip" id="chartTip" hidden></div>`;

  hookHover({ x, y, n, shown });
}

/* ── 손가락/마우스 따라다니는 안내 ────────────────── */
function hookHover({ x, y, n, shown }) {
  const svg = el.plot.querySelector("svg");
  const layer = el.plot.querySelector("#hoverLayer");
  const hit = el.plot.querySelector("#hitArea");
  const tip = el.plot.querySelector("#chartTip");

  const move = (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - box.left) / box.width * W;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - M.left) / (plotW / Math.max(1, n - 1)))));
    layer.innerHTML =
      `<line class="crosshair" x1="${x(i)}" y1="${M.top}" x2="${x(i)}" y2="${M.top + plotH}"/>` +
      shown.map((s) => `<circle class="dot" cx="${x(i)}" cy="${y(valuesOf(s.id)[i])}" r="4.5"
         fill="${s.color}"/>`).join("");
    tip.hidden = false;
    tip.innerHTML = `<b>${data.dates[i]}</b>` + shown.map((s) =>
      `<span><i style="background:${s.color}"></i>${s.label} ${valuesOf(s.id)[i].toLocaleString("ko-KR")}</span>`).join("");
    const left = (x(i) / W) * box.width;
    tip.style.left = Math.min(Math.max(left, 60), box.width - 60) + "px";
  };
  const leave = () => { layer.innerHTML = ""; tip.hidden = true; };

  hit.addEventListener("mousemove", move);
  hit.addEventListener("mouseleave", leave);
  hit.addEventListener("touchmove", move, { passive: true });
  hit.addEventListener("touchend", leave);
}

/* ── 범례 · 표 ─────────────────────────────────
   색 3개와 선 모양 2개로만 적는다. 이 그래프가 여섯 줄을 나누는 규칙이 그대로
   (영역 3색 × 방문/공유 2모양)이므로, 범례도 그 두 벌만 보여 주면 된다.
   여섯 칸에 "목록 방문 · 목록 공유 …" 를 다 적으면 영역 이름을 여섯 번
   되풀이하게 되어 폰에서 세 줄로 접혔다. 지금은 360px 폰까지 한 줄, 그보다 좁아도
   두 줄이다.

   누르면 그 벌이 통째로 켜지고 꺼진다 — 색을 끄면 그 영역의 두 줄이, 선 모양을
   끄면 모든 영역의 그 줄이 사라진다. 둘을 함께 쓰면 한 줄만 남길 수도 있다. */
function drawLegend() {
  // 모양 칸에만 표식을 그린다. 색 칸은 이름 자체를 그 색으로 적는다 —
  // 그래프에서 선 끝에 붙는 영역 이름도 같은 색 글자라, 둘이 곧바로 이어진다.
  const line = (dash) => `<svg width="20" height="10" aria-hidden="true">
      <line x1="1" y1="5" x2="19" y2="5" stroke="var(--ink-soft)" stroke-width="2"
        ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;

  const colors = SCOPES.map((sc, i) =>
    `<button class="legend-item legend-color${sc.on ? "" : " off"}" data-scope="${sc.key}"
      type="button" style="color: var(--series-${i + 1})">${sc.label}</button>`).join("");

  // 모양 칸은 색을 쓰지 않는다 — 여기서 알려 주는 것은 모양뿐이다
  const shapes = KINDS.map((k) =>
    `<button class="legend-item${k.on ? "" : " off"}" data-kind="${k.key}" type="button">
      ${line(k.dash)}${k.label}
    </button>`).join("");

  el.legend.innerHTML = `<div class="legend-set">${colors}</div>` +
    `<div class="legend-set">${shapes}</div>`;
}

/* 지금 보고 있는 그대로를 CSV 로. 엑셀이 한글을 깨뜨리지 않도록 BOM 을 붙인다. */
function toCSV() {
  const head = ["날짜", ...SERIES.map((s) => s.label)].join(",");
  const rows = data.dates.map((d, i) =>
    [d, ...SERIES.map((s) => valuesOf(s.id)[i])].join(","));
  return "\uFEFF" + [head, ...rows].join("\r\n") + "\r\n";
}

function csvName() {
  return `티니핑도감-통계-누적-${data.dates[data.dates.length - 1]}.csv`;
}

/* 방문 경로 — 많이 들어온 순으로. 막대는 가장 큰 값 대비 길이다. */
async function loadInflow() {
  el.inflow.innerHTML = `<li class="empty">불러오는 중…</li>`;
  let rows = null;
  try {
    const res = await fetch(`${CHART_API}/refs?days=${refDays}&limit=20&fresh=1`,
      { mode: "cors", cache: "no-store", signal: timeoutSignal(STATS_TIMEOUT) });
    if (res.ok) rows = (await res.json()).rows;
  } catch { /* 아래에서 안내 */ }

  if (!rows) {
    el.inflow.innerHTML = `<li class="empty">불러오지 못했어요 🥲</li>`;
    return;
  }

  if (!rows.length) {
    el.inflow.innerHTML = `<li class="empty">이 기간에는 기록이 없어요 🌱</li>`;
    return;
  }
  const max = Math.max(1, ...rows.map((r) => r.n));
  el.inflow.innerHTML = rows.map((r) => `<li>
      <span class="inflow-name">${REF_LABEL[r.host] || r.host}</span>
      <span class="inflow-bar"><i style="width:${(r.n / max) * 100}%"></i></span>
      <span class="inflow-num">${r.n.toLocaleString("ko-KR")}</span>
    </li>`).join("");
}

el.refTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-days]");
  if (!btn) return;
  [...el.refTabs.children].forEach((b) => b.classList.toggle("active", b === btn));
  refDays = Number(btn.dataset.days);
  loadInflow();
});

/* 맨 위 요약 숫자 — 세 페이지를 더한 값이다. 어느 쪽이 얼마인지는 아래 그래프가 보여 준다. */
function drawTiles(stats) {
  const sum = (kind) => SCOPES.reduce((a, s) => a + Number((stats[s.key] || {})[kind] || 0), 0);
  const n = (v) => v.toLocaleString("ko-KR");
  el.tiles.innerHTML = [
    ["오늘 방문", sum("visitToday")],
    ["누적 방문", sum("visitTotal")],
    ["오늘 공유", sum("shareToday")],
    ["누적 공유", sum("shareTotal")],
  ].map(([label, v]) => `<li><b>${n(v)}</b><span>${label}</span></li>`).join("");
}

async function loadTiles() {
  try {
    const res = await fetch(`${CHART_API}/stats?fresh=1`,
      { mode: "cors", cache: "no-store", signal: timeoutSignal(STATS_TIMEOUT) });
    if (res.ok) drawTiles(await res.json());
  } catch { /* 숫자가 없으면 그냥 비워 둔다 */ }
}

function redraw() {
  draw();
  drawLegend();
}

el.legend.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-scope], [data-kind]");
  if (!btn) return;
  const list = btn.dataset.scope ? SCOPES : KINDS;
  const item = list.find((x) => x.key === (btn.dataset.scope || btn.dataset.kind));
  // 한 벌을 통째로 끄면 그릴 것이 없어진다 — 각 벌의 마지막 하나는 남긴다
  if (item.on && list.filter((x) => x.on).length === 1) return;
  item.on = !item.on;
  redraw();
});

el.spanTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-days]");
  if (!btn) return;
  [...el.spanTabs.children].forEach((b) => b.classList.toggle("active", b === btn));
  days = Number(btn.dataset.days);
  load();
});

el.csvDownload.addEventListener("click", () => {
  if (!data) return;
  const url = URL.createObjectURL(new Blob([toCSV()], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = csvName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

async function load() {
  el.plot.innerHTML = `<div class="empty">불러오는 중…</div>`;
  try {
    const res = await fetch(`${CHART_API}/series?days=${days}&fresh=1`,
      { mode: "cors", cache: "no-store", signal: timeoutSignal(STATS_TIMEOUT) });
    data = res.ok ? await res.json() : null;
  } catch { data = null; }
  if (!data) {
    el.plot.innerHTML = `<div class="empty">통계를 불러오지 못했어요 🥲</div>`;
    return;
  }
  redraw();
}

load();
loadTiles();
loadInflow();
