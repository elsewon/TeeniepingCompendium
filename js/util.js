/* ===== 티니핑 도감 — 공용 유틸 ===== */
/* 데이터는 data/teeniepings.js 가 window.TEENIEPINGS 배열로 주입한다.
   (file:// 로 직접 열어도 동작하도록 fetch 대신 <script> 로딩 사용) */

const DATA = (window.TEENIEPINGS || []).slice();
const BY_ID = Object.fromEntries(DATA.map((t) => [t.id, t]));

function getAll() { return DATA; }
function getById(id) { return BY_ID[id] || null; }
function uniqueSeasons() {
  const seen = new Map();
  DATA.forEach((t) => { if (!seen.has(t.season)) seen.set(t.season, t.seasonKey); });
  return [...seen.entries()].map(([label, key]) => ({ label, key }));
}
function uniqueGrades() {
  const order = ["로열", "레전드", "일반", "빌런"];
  const set = new Set(DATA.map((t) => t.grade));
  return order.filter((g) => set.has(g));
}

/* 이름의 대표 글자(플레이스홀더용) */
function coreChar(name) {
  const n = (name || "?").replace(/핑$/, "");
  return n.charAt(n.length - 1) || name.charAt(0) || "?";
}

/* 색상 유틸: hex 밝기 조절 */
function shade(hex, amt) {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* 플레이스홀더 SVG 생성 — 실제 이미지가 없을 때 사용.
   images/<id>.png 파일이 있으면 그걸 우선 쓰도록 imageMarkup 에서 처리. */
function placeholderSVG(t, size) {
  const s = size || 300;
  const c = t.colorHex || "#ff8fb7";
  const light = shade(c, 46), dark = shade(c, -30);
  const ch = coreChar(t.nameKo);
  const gid = "g_" + t.id.replace(/[^a-z0-9]/gi, "");
  return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${t.nameKo}">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${c}"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#${gid})"/>
  <g opacity="0.9">
    <ellipse cx="${s / 2}" cy="${s * 0.58}" rx="${s * 0.30}" ry="${s * 0.28}" fill="#fff" opacity="0.92"/>
    <circle cx="${s * 0.41}" cy="${s * 0.54}" r="${s * 0.035}" fill="${dark}"/>
    <circle cx="${s * 0.59}" cy="${s * 0.54}" r="${s * 0.035}" fill="${dark}"/>
    <circle cx="${s * 0.41}" cy="${s * 0.532}" r="${s * 0.012}" fill="#fff"/>
    <circle cx="${s * 0.59}" cy="${s * 0.532}" r="${s * 0.012}" fill="#fff"/>
    <ellipse cx="${s * 0.35}" cy="${s * 0.60}" rx="${s * 0.028}" ry="${s * 0.018}" fill="${c}" opacity="0.5"/>
    <ellipse cx="${s * 0.65}" cy="${s * 0.60}" rx="${s * 0.028}" ry="${s * 0.018}" fill="${c}" opacity="0.5"/>
    <path d="M ${s * 0.45} ${s * 0.63} Q ${s * 0.5} ${s * 0.68} ${s * 0.55} ${s * 0.63}" stroke="${dark}" stroke-width="${s * 0.012}" fill="none" stroke-linecap="round"/>
    <text x="${s / 2}" y="${s * 0.24}" font-family="system-ui, sans-serif" font-size="${s * 0.16}" font-weight="800" fill="#fff" text-anchor="middle" opacity="0.95">${ch}</text>
  </g>
</svg>`;
}

/* 이미지 마크업: images/<id>.png 를 시도하고, 실패 시 플레이스홀더 SVG 로 대체.
 *
 * 목록은 157장을 한꺼번에 불러오므로 작은 WebP 썸네일을 쓴다.
 * 상세·퀴즈처럼 크게 보여 주는 곳만 원본 PNG 를 쓴다.
 * (size 는 호출부가 넘기는 표시 크기 — 카드 260, 상세 320, 퀴즈 380) */
function imageMarkup(t, size, prefix) {
  const useThumb = size && size <= 300;
  const dir = prefix || "";
  // ?v=<이미지 해시> — 그림을 고쳐 배포했을 때 브라우저가 캐시된 옛 그림을
  // 계속 보여 주는 것을 막는다. 그림이 그대로면 해시도 그대로라 캐시가 유지된다.
  const v = t.imgv ? "?v=" + t.imgv : "";
  const src = (useThumb
    ? dir + "images/thumb/" + t.id + ".webp"
    : dir + "images/" + t.id + ".png") + v;
  return `<img src="${src}" alt="${t.nameKo}" loading="lazy"
    onerror="this.outerHTML=this.getAttribute('data-fallback')"
    data-fallback="${placeholderSVG(t, size).replace(/"/g, "&quot;").replace(/'/g, "&#39;")}">`;
}

/* URL 쿼리 파라미터 */
function qparam(name) {
  return new URLSearchParams(location.search).get(name);
}

/* ===== 개별 페이지 주소 =====
   개별 페이지는 p/<id>.html 로 미리 만들어 둔 정적 파일이다
   (node tools/build-pages.mjs). 목록·퀴즈가 있는 루트에서는 "p/<id>.html" 로,
   개별 페이지끼리는 같은 폴더라 파일 이름만으로 가리킨다.

   폴더(p/<id>/index.html)가 아니라 파일 하나로 두는 이유: file:// 로 열었을 때
   폴더 주소를 누르면 사파리가 파인더를 열어 버린다. */
function inPingPage() {
  return /\/p\/[^/]+\.html$/.test(location.pathname);
}
function currentPingId() {
  const m = location.pathname.match(/\/p\/([^/]+)\.html$/);
  return m ? decodeURIComponent(m[1]) : null;
}
function pingHref(id) {
  return (inPingPage() ? "" : "p/") + encodeURIComponent(id) + ".html";
}

/* ===== 무작위 티니핑 보기 =====
   상단 바의 🔮 버튼. 모든 페이지가 util.js 를 쓰므로 여기 한 곳에 둔다.
   개별 페이지는 데이터 전체(199KB)를 싣지 않으므로 id 목록만 담은
   data/ping-ids.js 를 쓴다. 목록·퀴즈는 전체 데이터가 있어 거기서 뽑는다. */
function gotoRandomTeenieping() {
  const ids = window.PING_IDS || getAll().map((t) => t.id);
  if (!ids.length) return;
  // 개별 페이지에서 눌렀을 때 지금 보고 있는 티니핑이 또 나오지 않도록 제외
  const current = currentPingId();
  const pool = ids.length > 1 ? ids.filter((x) => x !== current) : ids;
  location.href = pingHref(pool[Math.floor(Math.random() * pool.length)]);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-random]");
  if (!el) return;
  e.preventDefault();
  gotoRandomTeenieping();
});

/* ===== 페이지 공유 =====
   상단 바 오른쪽 끝의 공유 버튼. 세 페이지가 모두 util.js 를 쓴다.
   휴대폰처럼 공유 시트를 지원하는 곳에서는 시트를 띄우고,
   그렇지 않은 곳에서는 주소를 클립보드에 복사한다. */

/* 공유할 주소 — 목록으로 돌아가기용 from(검색·필터 상태)은 빼고 깨끗한 링크를 준다.
   개별 페이지는 og 태그가 박힌 정적 파일이라 지금 주소를 그대로 공유하면 된다. */
function shareUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("from");
  url.hash = "";
  // 공유 버튼을 거친 링크임을 표시한다 — 유입 통계에서 이것만 확실히 구분된다.
  // 받은 사람 쪽에서는 세고 나서 js/stats.js 가 주소에서 지운다.
  url.searchParams.set("s", "1");
  return url.href;
}

let toastTimer = null;
function showToast(msg, anchor) {
  let box = document.querySelector(".toast");
  if (!box) {
    box = document.createElement("div");
    box.className = "toast";
    box.setAttribute("role", "status");
    document.body.appendChild(box);
  }
  box.textContent = msg;

  // 누른 버튼 바로 아래·오른쪽 끝에 맞춰 띄운다 (버튼을 못 찾으면 화면 오른쪽 위)
  const btn = anchor || document.querySelector("[data-share]");
  const r = btn ? btn.getBoundingClientRect() : null;
  box.style.top = (r ? r.bottom + 10 : 70) + "px";
  box.style.right = Math.max(12, r ? window.innerWidth - r.right : 20) + "px";

  // 방금 붙인 요소는 한 프레임 뒤에 클래스를 줘야 전환 효과가 살아난다
  requestAnimationFrame(() => box.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 2000);
}

/* clipboard API 는 https(또는 localhost)에서만 쓸 수 있다.
   file:// 로 직접 열어 본 경우에는 복사가 되지 않는다. */
function copyText(text) {
  if (!navigator.clipboard || !window.isSecureContext) {
    return Promise.reject(new Error("clipboard unavailable"));
  }
  return navigator.clipboard.writeText(text);
}

/* 공유가 실제로 이뤄졌음을 알린다 — js/stats.js 가 받아서 센다.
   시트를 열었다 그냥 닫은 경우(AbortError)는 부르지 않는다. */
function sharedOnce() {
  document.dispatchEvent(new CustomEvent("ping:share"));
}

async function sharePage(btn) {
  const url = shareUrl();
  const title = document.title;

  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      sharedOnce();
      return;
    } catch (err) {
      // 사용자가 공유 시트를 닫은 것뿐이면 아무 일도 하지 않는다
      if (err && err.name === "AbortError") return;
      // 그 밖의 실패(권한 등)는 아래 복사로 넘어간다
    }
  }

  try {
    await copyText(url);
    sharedOnce();
    showToast("링크를 복사했어요 💗", btn);
    if (btn) {
      btn.classList.add("done");
      setTimeout(() => btn.classList.remove("done"), 1400);
    }
  } catch {
    showToast("복사하지 못했어요 🥲", btn);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-share]");
  if (!btn) return;
  e.preventDefault();
  sharePage(btn);
});
