/* ===== 개별 페이지(p/<id>.html) 보조 스크립트 =====
 *
 * 내용은 빌드 때 이미 다 그려져 있다(node tools/build-pages.mjs).
 * 여기서는 주소에 실려 온 검색·필터 상태(from)만 링크에 붙여 준다.
 *
 * 목록에서 "3기 + 로열"로 걸러 보다가 한 마리를 눌러 들어오면
 * 그 상태가 ?from= 에 담겨 온다. 돌아가기·관계 목록 링크에 그대로 이어 붙여야
 * 뒤로 갔을 때 보던 목록이 유지된다.
 */
(function () {
  const from = new URLSearchParams(location.search).get("from");
  if (!from || !from.startsWith("?")) return;

  const back = document.querySelector(".back-link");
  if (back) back.href = "../index.html" + from;

  // 관계 목록의 다른 티니핑으로 넘어갈 때도 목록 상태를 들고 간다
  document.querySelectorAll("[data-ping]").forEach((a) => {
    a.href += "?from=" + encodeURIComponent(from);
  });
})();

/* ===== 좋아요 =====
 *
 * 숫자는 js/stats.js 가 이미 받아 온 것을 ping:stats 로 넘겨받아 쓴다
 * (같은 것을 두 번 물어보지 않으려고). 누를 때만 따로 /hit 을 보낸다.
 *
 * 누른 기록은 sessionStorage 가 아니라 localStorage 에 남긴다 — 방문 수와 달리
 * 좋아요는 "이 사람이 이 티니핑을 좋아한다" 는 표시라, 탭을 새로 열 때마다
 * 다시 눌릴 수 있으면 안 된다. 되돌리는 길은 두지 않았다(worker/counter.js 참고).
 *
 * 버튼은 숫자를 받은 뒤에야 나타난다. Worker 가 꺼져 있거나 응답이 없으면
 * 눌러도 아무 일이 없는 버튼이 남는 편보다 아예 안 보이는 편이 낫다.
 */
(function () {
  const btn = document.querySelector("[data-like]");
  const id = typeof currentPingId === "function" ? currentPingId() : null;
  if (!btn || !id || typeof callStats !== "function") return;

  const countBox = btn.querySelector(".like-count");
  const key = "ping-liked-" + id;
  const n = (v) => Number(v || 0).toLocaleString("ko-KR");

  function liked() {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;        // 사파리 비공개 모드 등에서 막히면 매번 누를 수 있다
    }
  }
  function remember() {
    try { localStorage.setItem(key, "1"); } catch { /* 막혀 있어도 이번 한 번은 센다 */ }
  }

  function paint(count) {
    if (count != null) countBox.textContent = n(count);
    const on = liked();
    btn.classList.toggle("liked", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.hidden = false;
  }

  document.addEventListener("ping:stats", (e) => {
    const p = e.detail && e.detail.page;
    if (p && typeof p.like === "number") paint(p.like);
  });

  btn.addEventListener("click", async () => {
    if (liked()) {
      showToast("이미 좋아요를 눌렀어요 ❤️", btn);
      return;
    }
    remember();
    // 누른 티는 곧바로 낸다 — 응답을 기다리는 동안 아무 반응이 없으면 또 누르게 된다
    paint(Number(String(countBox.textContent).replace(/[^0-9]/g, "")) + 1);
    const s = await callStats(
      `/hit?type=like&scope=page&page=${encodeURIComponent(id)}`, { method: "POST" });
    if (s && s.page) paint(s.page.like);
  });
})();
