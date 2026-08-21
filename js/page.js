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
