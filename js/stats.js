/* ===== 방문·공유 통계 =====
 *
 * GitHub Pages 에는 서버가 없어 방문을 셀 수 없다. 세는 일은 Cloudflare Worker
 * (worker/counter.js) 가 맡고, 여기서는 그 주소로 요청을 보내 숫자를 받아 온다.
 *
 * 목록 · 이름 맞추기 · 개별 티니핑을 **서로 독립적으로** 센다. 목록의 방문 수는
 * 목록에 들어온 횟수이지 사이트 전체 합계가 아니다.
 *
 * 방문은 모두 세션(탭) 단위다. 목록·퀴즈·순위는 영역마다 한 번, 개별 티니핑은
 * 티니핑마다 한 번 센다 — 같은 세션에서 몰래핑을 두 번 열어도 1, 몰래핑과 라라핑을
 * 하나씩 열면 2 가 된다.
 *
 * 아래 STATS_API 가 비어 있으면 아무 요청도 보내지 않고 통계 줄도 나타나지 않는다.
 * Worker 를 배포한 뒤 그 주소를 넣으면 켜진다. (README 의 "방문·공유 통계" 참고)
 */
const STATS_API = "https://teenieping-counter.elsewon.workers.dev";

/* 지금 페이지가 어느 영역인지 — currentPingId 는 js/util.js 에 있다 */
const pingId = typeof currentPingId === "function" ? currentPingId() : null;
const SCOPE = pingId ? "page"
  : /quiz\.html$/.test(location.pathname) ? "quiz"
  : /rank\.html$/.test(location.pathname) ? "rank"
  : /stats\.html$/.test(location.pathname) ? null   // 통계 페이지 자체는 세지 않는다
  : "list";
const PAGE_PARAM = pingId ? "&page=" + encodeURIComponent(pingId) : "";

function renderStats(s) {
  const box = document.getElementById("stats");
  const wrap = document.getElementById("statsBox");
  if (!box || !s) return;
  const n = (v) => Number(v || 0).toLocaleString("ko-KR");

  if (SCOPE === "page") {
    const p = s.page || {};
    box.textContent = `누적 조회 ${n(p.visit)} · 누적 공유 ${n(p.share)}`;
  } else {
    const c = s[SCOPE] || {};
    box.textContent =
      `오늘 방문 ${n(c.visitToday)} · 누적 방문 ${n(c.visitTotal)}` +
      ` · 오늘 공유 ${n(c.shareToday)} · 누적 공유 ${n(c.shareTotal)}`;
  }
  if (wrap) wrap.hidden = false;
}

/* 받아 온 숫자를 다른 화면도 쓸 수 있게 알린다 (이름 맞추기의 난도별 도전수 등).
   요청을 두 번 보내지 않으려고 이벤트로 넘긴다. */
function publish(s) {
  if (s) document.dispatchEvent(new CustomEvent("ping:stats", { detail: s }));
}

async function callStats(path, options) {
  if (!STATS_API) return null;
  try {
    const res = await fetch(STATS_API + path,
      { ...options, mode: "cors", cache: "no-store", signal: timeoutSignal(STATS_TIMEOUT) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;   // 통계는 부가 기능이라 실패해도 사이트는 그대로 동작한다
  }
}

/* 세션(탭) 안에서 이미 셌는지. 개별 티니핑은 마리마다 따로 표시를 남긴다. */
function alreadyVisited() {
  if (!SCOPE) return true;
  const key = SCOPE === "page" ? "ping-visited-page-" + pingId : "ping-visited-" + SCOPE;
  try {
    const seen = sessionStorage.getItem(key) === "1";
    sessionStorage.setItem(key, "1");
    return seen;
  } catch {
    return false;   // 사파리 비공개 모드 등에서 막히면 그냥 센다
  }
}

/* ===== 방문 경로 =====
   어디를 거쳐 들어왔는지 한 세션에 한 번만 센다.

   리퍼러가 있으면 그 주소(호스트)를 쓴다. 공유 버튼이 붙인 ?s=1 표식이 함께 있어도
   주소 쪽을 택한다 — "공유로 들어왔다" 보다 "어디에 올린 링크였나" 가 더 알 만하고,
   공유였다는 것은 표식 없이도 그 주소를 보면 대개 짐작이 된다.

   그래서 _share 는 "공유 버튼을 거쳤는데 어디서 왔는지 알 길이 없는 경우" 가 된다.
   카카오톡 같은 인앱 브라우저가 리퍼러를 안 보내므로 메신저 유입이 여기 모인다.

   사이트 안에서 넘어온 것은 표식이 붙어 있어도 세지 않는다 — 밖에서 들어온 것만
   방문 경로다. 공유 링크를 우리 페이지 안에서 눌러 봐야 새 방문자가 온 것이 아니다.

   리퍼러도 표식도 없으면(앱·북마크·주소 입력) 역시 세지 않는다 — 어디서 왔는지
   알려 주는 것이 없어 목록에 쓸 데가 없다. */
function referralHost() {
  const r = document.referrer;
  if (r) {
    try {
      const host = new URL(r).host.toLowerCase().replace(/^www\./, "");
      const self = location.host.toLowerCase().replace(/^www\./, "");
      return host === self ? null : host;      // 안에서 온 것이면 여기서 끝
    } catch { /* 주소가 망가졌으면 아래 표식으로 넘어간다 */ }
  }
  return new URLSearchParams(location.search).get("s") === "1" ? "_share" : null;
}

/* 표식을 주소에 남겨 두면 받은 사람이 그 주소를 다시 공유하거나 북마크할 때
   계속 공유 유입으로 잡힌다. 세고 난 뒤 조용히 지운다. */
function dropShareMark() {
  const url = new URL(location.href);
  if (!url.searchParams.has("s")) return;
  url.searchParams.delete("s");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

async function countReferral() {
  let counted = false;
  try {
    counted = sessionStorage.getItem("ping-referral") === "1";
    sessionStorage.setItem("ping-referral", "1");
  } catch { /* 저장소가 막히면 매번 센다 */ }
  const host = referralHost();
  dropShareMark();
  // 세션 표시는 셀 것이 없어도 남겨 둔다 — "한 세션에 한 번" 이라는 규칙은 그대로다
  if (counted || !host) return;
  await callStats("/hit?type=ref&host=" + encodeURIComponent(host), { method: "POST" });
}

async function countVisit() {
  if (!SCOPE) return;            // 통계 페이지는 세지도 보여 주지도 않는다
  const stats = alreadyVisited()
    ? await callStats("/stats" + (PAGE_PARAM ? "?" + PAGE_PARAM.slice(1) : ""))
    : await callStats(`/hit?type=visit&scope=${SCOPE}${PAGE_PARAM}`, { method: "POST" });
  renderStats(stats);
  publish(stats);
}

/* 공유가 실제로 이뤄졌을 때 js/util.js 가 이 신호를 보낸다 */
document.addEventListener("ping:share", async () => {
  if (!SCOPE) return;            // 통계 페이지는 세지 않는다 (공유 버튼도 없다)
  const s = await callStats(`/hit?type=share&scope=${SCOPE}${PAGE_PARAM}`, { method: "POST" });
  renderStats(s);
  publish(s);
});

/* 퀴즈에서 문제가 나올 때마다 js/quiz.js 가 이 신호를 보낸다 (난도별 도전수) */
document.addEventListener("ping:quiz", async (e) => {
  const mode = e.detail && e.detail.mode;
  if (!mode) return;
  const s = await callStats("/hit?type=mode&mode=" + encodeURIComponent(mode),
                            { method: "POST" });
  renderStats(s);
  publish(s);
});

countVisit();
countReferral();
