/* ===== 이름 맞추기 (난도: 쉬움/보통/어려움) ===== */
const MODES = {
  easy:   { choices: true, silhouette: false },
  normal: { choices: false, silhouette: false },
  hard:   { choices: false, silhouette: true },
};

const el = {
  diffScreen: document.getElementById("difficultyScreen"),
  stage: document.getElementById("stage"),
  image: document.getElementById("quizImage"),
  answer: document.getElementById("answerArea"),
  next: document.getElementById("nextBtn"),
  modeBar: document.getElementById("modeBar"),
};

let mode = null;

/* 난도별 오늘·누적 도전수. js/stats.js 가 받아 온 것을 이벤트로 넘겨받는다
   (같은 정보를 두 번 요청하지 않으려고). */
let modeCounts = null;
let pool = [];
let current = null;

/* 퀴즈 대상은 전체다. 예전에는 그림 없는 티니핑을 걸렀지만 지금은 157마리 모두
 * 그림이 있다. 혹시 빠지더라도 imageMarkup 이 플레이스홀더로 대체한다. */
function quizPool() {
  return getAll();
}

/* 다음 문제의 그림을 미리 받아 둔다. 원본 PNG 는 200KB 를 넘는 것도 있어 폰에서는
   몇 초가 걸리기도 하는데, 카운트다운이 그림을 기다리므로 그 몇 초가 그대로 빈 화면이
   된다. 지금 문제를 푸는 동안 받아 두면 다음 그림은 캐시에서 바로 뜬다. 주소는
   imageMarkup 이 쓰는 것과 같아야 캐시가 맞는다(js/util.js 의 imageSrc). 받아 둔
   객체는 잡고 있는다 — 놓으면 사파리가 쓰기도 전에 버릴 수 있다. */
let preloaded = null;
function preloadImage(t) {
  if (!t) return;
  const img = new Image();
  img.src = imageSrc(t, 380);
  preloaded = img;
}

/* 셔플 */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* 문제 화면 맨 위에 고른 난도를 보여 준다. 이름만 다시 적는 대신 난도 화면의 그 칸을
   **그대로 복제해** 쓴다 — 이모지·설명·도전수까지 같은 것을 보게 되어, 방금 무엇을
   골랐는지가 한눈에 이어진다. 복제본을 누르면 난도 화면으로 돌아간다.
   data-mode 는 떼어 낸다. 난도를 고르는 클릭은 난도 화면의 칸에만 걸려 있으므로
   복제본이 그 역할까지 물려받지 않게 하려는 것이다. */
function drawModeCard() {
  const src = el.diffScreen.querySelector(`.diff-card[data-mode="${mode}"]`);
  if (!src) return;
  const copy = src.cloneNode(true);
  copy.classList.remove("moving");   // 제자리로 옮기던 중에 복제돼도 그 표시는 따라가지 않게
  copy.removeAttribute("data-mode");
  copy.setAttribute("aria-label", "난도 바꾸기");
  copy.title = "난도 바꾸기";
  el.modeBar.replaceChildren(copy);
}

let stageGen = 0;   // 문제 화면에 들어온 횟수 — 허락을 기다리는 사이 나갔다 오면 옛 시작은 무효

function startMode(m) {
  mode = m;
  wakeAudio();             // 누른 흐름 안에서 — 사파리는 그래야 뒤에 시간으로 내는 비프를 들려준다
  primeSpeech();           // 음성 합성기도 — iOS 는 첫 발화가 누른 흐름 안이어야 3초 뒤 정답 읽기를 허용한다
  if (MODES[m].choices) {
    stopHearing();
    // 쉬움: 선택지 이름을 읽어 줄지 먼저 묻는다 — 이번 방문에 한 번. 음성 합성이 없는 브라우저는
    // 읽을 수 없으니 묻지 않는다.
    if (readChoices === null && window.speechSynthesis) { openPop(speakNote); return; }
    startEasy();
    return;
  }
  // 보통·어려움: 허락 창이 뜨기 전에 마이크 안내를 팝업으로 먼저 보여 준다 — 무엇을 허락하는지,
  // 언제 꺼지는지. 이미 허락된 기기(브라우저가 알려 주는 경우)나 이번 방문에서 이미 답한 뒤에는
  // 곧바로 간다. 마이크는 「좋아요」를 누른 그 흐름 안에서 켠다(사파리).
  if (!micExplained && !micGranted && !mic.dead && recognitionClass()) { openPop(micNote); return; }
  listenAndStart();
}

/* 보통·어려움의 시작 — 난도 화면에 머문 채 마이크를 켠다. 허락 창이 문제 위가 아니라 난도 화면
   위에 뜨고, 허락이 정해지면(켜졌든 거부됐든) 그때 문제 화면으로 넘어가 첫 문제를 낸다 —
   허락 창 뒤로 문제 모양이 비치지 않고, 창이 떠 있는 동안 3초가 새지도 않는다.
   연달아 누르면 켜던 세션은 그대로 두고 넘어갈 곳만 바꾼다. */
function listenAndStart() {
  const gen = ++stageGen;
  mic.onSettled = () => { if (gen !== stageGen) return; showStage(); nextQuestion(); };
  if (mic.off) { settleMic(); return; }  // 손으로 꺼 두었다(「싫어요」·마이크 단추) — 켜지 않고 바로 간다
  if (!mic.wanted) { mic.wanted = true; startHearing(MIC_WAIT_MS); }
  else if (mic.settled) settleMic();     // 이미 켜져 있으면 바로 넘어간다
}

/* 안내 팝업 둘 — 마이크(보통·어려움, #micNote)와 선택지 읽어 주기(쉬움, #speakNote). 난도를 고르면
   문제 화면으로 넘어가기 전에 난도 화면 위에 <dialog> 로 띄운다. showModal() 은 뒤를 가리고 초점을
   팝업 안에 가두며 Esc 로 닫힌다. 바깥(가림막)을 누르거나 Esc 로 닫으면 아무것도 시작하지 않고
   난도 화면에 남는다. 그때는 고른 것이 아니므로 다음에 그 난도를 고를 때 다시 묻고, 둘 중
   하나를 고른 뒤에는 이번 방문 동안 다시 묻지 않는다. */
function openPop(dlg) {
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");   // <dialog> 를 모르는 옛 브라우저 — 가림막 없이 뜬다
  // 초점은 단추가 아니라 팝업 자체에 둔다. showModal() 은 첫 단추에 초점을 주는데, 사파리는
  // 그 단추에 파란 초점 링을 그려 미리 골라진 것처럼 보였다. 팝업에 두면 어느 쪽도 골라져
  // 보이지 않고, 키보드로는 Tab 으로 단추에 가고 Esc 로 닫는다. 화면 낭독기는 팝업의
  // 제목(aria-labelledby)을 읽는다.
  dlg.focus({ preventScroll: true });
}
function closePop(dlg) {
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

/* 마이크 안내 — 「좋아요」는 그 흐름에서 마이크를 켜고(사파리는 누른 흐름 안에서만 허락을 묻는다),
   「싫어요」는 마이크를 끈 채로 바로 문제로 간다 — 허락 창이 뜨지 않고, 마이크 단추는 회색으로
   남아 누르면 그때 켠다(아직 묻지 않았으니 허락 창이 뜬다). */
let micExplained = false;   // 이번 방문에서 안내에 답했다
let micGranted = false;     // 브라우저가 마이크가 이미 허락됐다고 알려 줬다 (Permissions API)
const micNote = document.getElementById("micNote");
document.getElementById("micOk").addEventListener("click", () => {
  micExplained = true;
  closePop(micNote);
  wakeAudio();               // 이 흐름에서도 깨워 둔다 — 안내를 읽는 동안 세워졌을 수 있다
  listenAndStart();
});
document.getElementById("micSkip").addEventListener("click", () => {
  micExplained = true;
  closePop(micNote);
  // 끈 채로 간다 — 허락 창도 뜨지 않는다. 접는 것(giveUpMic)과 달리 단추는 남긴다: 브라우저는
  // 아직 마이크를 묻지 않았으므로, 나중에 단추를 누르면 그때 허락 창이 뜨고 켜진다.
  mic.off = true;
  mic.wanted = false;
  showStage();
  nextQuestion();
});

/* 선택지 읽어 주기 안내 — 쉬움. 「좋아요」면 문제가 나올 때마다 선택지 셋을 차례로 읽어 주고
   (renderChoices), 「싫어요」면 읽지 않는다 — 이름 옆 스피커 버튼으로는 언제든 들을 수 있다.
   고른 뒤 정답 이름을 읽어 주는 것은 어느 쪽이든 그대로다. 「좋아요」를 누른 흐름에서 곧바로
   첫 문제를 내므로, 이어 읽기가 그 흐름 안에서 엔진을 깨운다(iOS — js/util.js 의 primeSpeech). */
let readChoices = null;     // 이번 방문의 답 — null 이면 아직 묻지 않았다
const speakNote = document.getElementById("speakNote");
function startEasy() {
  showStage();
  nextQuestion();
}
document.getElementById("speakOk").addEventListener("click", () => {
  readChoices = true;
  closePop(speakNote);
  startEasy();
});
document.getElementById("speakSkip").addEventListener("click", () => {
  readChoices = false;
  closePop(speakNote);
  startEasy();
});

// 바깥(가림막)을 누르면 닫는다. 내용(.pop-body)이 팝업을 빈틈없이 덮으므로, 팝업 자체가
// 눌렸다면 그것은 가림막이다 (가림막의 클릭은 팝업 요소로 온다).
[micNote, speakNote].forEach((dlg) => {
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closePop(dlg); });
});
/* 이미 허락된 기기인지 미리 물어 둔다 — 그러면 안내를 건너뛴다. 사파리는 이 이름을 모를 수
   있는데(throw 나 reject), 그러면 모른다고 보고 안내를 보인다. */
if (navigator.permissions && navigator.permissions.query) {
  try {
    navigator.permissions.query({ name: "microphone" })
      .then((st) => {
        micGranted = st.state === "granted";
        st.onchange = () => { micGranted = st.state === "granted"; };
      })
      .catch(() => { /* 이름을 모르는 브라우저 */ });
  } catch { /* 위와 같다 */ }
}

/* 문제 화면으로 넘어간다. 고른 난도 칸이 제자리에서 맨 위(난도 표시줄)로 미끄러져 올라가고,
   문제 칸은 그 아래로 살짝 떠오르며 나타난다 — 무엇을 골랐는지가 눈으로 이어진다. 난도 화면이
   떠 있을 때만 옮긴다(옛 자리를 재야 하므로). */
function showStage() {
  const src = el.diffScreen.hidden ? null : el.diffScreen.querySelector(`.diff-card[data-mode="${mode}"]`);
  const from = src ? src.getBoundingClientRect() : null;
  drawModeCard();
  el.diffScreen.hidden = true;
  el.stage.hidden = false;
  const moved = moveCard(el.modeBar.firstElementChild, from);
  const faded = fadeIn(el.stage.querySelector(".quiz-stage"), true);
  if (moved || faded) transitionEnd = performance.now() + MOVE_MS;
}

/* 난도 화면에서 넘어오는 전환이 끝나는 때(performance.now 기준). 문제는 그 뒤에 시작한다 —
   칸이 올라가는 사이 막대가 줄고 삐가 나면 쫓기듯 보였다. 전환이 없었거나(움직임 줄이기,
   「다음 티니핑」) 이미 끝났으면 곧바로. 끝 알림 대신 시간으로 잰다 — 알림은 탭이 보일 때 온다. */
let transitionEnd = 0;
function afterTransition(fn) {
  const wait = transitionEnd - performance.now();
  if (wait <= 0) fn(); else setTimeout(fn, wait);
}

/* 난도 칸을 옮기는 움직임 — 옛 자리(from)에서 지금 자리로 미끄러져 온다. 새 자리에 먼저 놓고
   옛 자리만큼 되돌려 둔 데서 풀어 주는 방식(FLIP)이라 자리 계산은 브라우저가 이미 끝낸 뒤다.
   옮기는 동안은 올린 효과와 그 전환을 끈다(.moving) — 전환은 움직임보다 앞서므로, 칸이 손가락
   밑을 지나며 올린 상태가 되면 그 전환이 움직임을 덮어 칸이 한 번에 튀었다.
   움직임을 줄여 달라고 한 기기에서는 옮기지 않고 곧바로 바꾼다. */
const MOVE_MS = 320;
function reduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function moveCard(card, from) {
  if (!card || !from || reduceMotion() || typeof card.animate !== "function") return false;
  const to = card.getBoundingClientRect();
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return false;
  card.classList.add("moving");
  const a = card.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
    { duration: MOVE_MS, easing: "cubic-bezier(.2, .8, .2, 1)" });
  // 끝나면 표시를 뗀다. 애니메이션의 끝 알림은 화면이 보일 때 오므로, 옮기는 사이 탭을 떠나면
  // 늦어져 그동안 칸이 눌리지 않는다 — 시간으로도 뗀다. 그사이 새 움직임이 시작됐으면 그쪽 것은
  // 두고 간다(token).
  const token = (card.moveToken || 0) + 1;
  card.moveToken = token;
  const done = () => { if (card.moveToken === token) card.classList.remove("moving"); };
  a.onfinish = done;
  a.oncancel = done;
  setTimeout(done, MOVE_MS + 150);
  return true;
}
/* 서서히 나타나기. lift 면 조금 아래에서 떠오른다. */
function fadeIn(node, lift) {
  if (!node || reduceMotion() || typeof node.animate !== "function") return false;
  node.animate(
    [{ opacity: 0, transform: lift ? "translateY(12px)" : "none" }, { opacity: 1, transform: "none" }],
    { duration: MOVE_MS, easing: "ease-out" });
  return true;
}

/* 카운트다운 도중에 나가면 그 카운트다운을 끊는다. 두면 숨은 화면 뒤에서 3초 뒤에
   정답이 열리고 도전 한 번이 세어진다 — 보지도 않은 문제를 푼 것으로 치는 셈이다.
   읽던 이름도 화면과 함께 접는다 — 난도 화면 위에서 목소리만 남으면 안 된다. */
/* 돌아갈 때는 거꾸로 — 맨 위의 난도 칸이 제자리로 미끄러져 내려가고, 나머지 칸은 서서히 나타난다. */
function backToDifficulty() {
  const card = el.stage.hidden ? null : el.modeBar.firstElementChild;
  const from = card ? card.getBoundingClientRect() : null;
  stageGen++;
  cancelCountdown();
  stopHearing();
  stopSpeaking();
  el.stage.hidden = true;
  el.diffScreen.hidden = false;
  const dst = el.diffScreen.querySelector(`.diff-card[data-mode="${mode}"]`);
  moveCard(dst, from);
  el.diffScreen.querySelectorAll(".diff-card").forEach((c) => { if (c !== dst) fadeIn(c); });
}

/* 「다음 티니핑」은 정답을 본 뒤에야 열린다.
   답을 고르기 전에 넘길 수 있으면 문제를 본 줄 모르고 지나가는데, 도전 수는
   그대로 올라간다. 잠금 표시는 순위 페이지의 화살표 버튼과 같다 (.btn:disabled). */
function lockNext(locked) { el.next.disabled = locked; }

/* 정답이 나온 순간 — 「다음 티니핑」을 열고, 도전 한 번을 센다.
   문제가 뜬 때가 아니라 답을 본 때 세는 이유: 스쳐 지나간 문제는 푼 것이 아니다.
   난도를 고르자마자 되돌아 나오면 한 번도 세지 않는다. */
function revealed() {
  lockNext(false);
  document.dispatchEvent(new CustomEvent("ping:quiz", { detail: { mode } }));  // js/stats.js
}

function nextQuestion() {
  lockNext(true);
  cancelCountdown();              // 새 문제가 뜨면 앞 문제의 카운트다운은 없는 것이다
  stopSpeaking();                 // 앞 문제의 이름을 읽던 것도 — 새 문제의 소리와 겹치지 않게
  if (!quizPool().length) {
    el.image.innerHTML = "";
    el.answer.innerHTML = `<div class="name-slot"><span class="hint">데이터가 아직 없어요</span></div>`;
    return;
  }
  if (!pool.length) pool = shuffle(quizPool());
  current = pool.pop();
  preloadImage(pool[pool.length - 1]);   // 다음 문제의 그림은 이 문제를 푸는 동안 받아 둔다

  // 이미지 (어려움: 실루엣)
  el.image.innerHTML = imageMarkup(current, 380, "", true);   // 곧바로 받는다 (lazy 아님)
  el.image.classList.toggle("silhouette", MODES[mode].silhouette);

  // 정답 영역 — 두 그리기 함수가 #answerArea 를 통째로 다시 쓴다
  MODES[mode].choices ? renderChoices() : renderNameSlot();
}

/* 정답이 공개되는 순간 나오는 '정답 행'.
 *
 * 인기 차트의 한 줄(.rank-row)과 같은 짜임을 그대로 쓴다 — 그림·이름·태그칩.
 * 같은 것을 두 곳에서 다르게 보여 줄 이유가 없고, 아이는 차트에서 이미 이 모양에
 * 익숙하다. 순위 숫자와 집계 숫자만 빠진다.
 *
 * 행 전체가 개별 페이지로 가는 바로가기다. 예전에는 이름 옆 화살표(→)가 그 표시였는데,
 * 바로 아래 「다음 티니핑 →」 버튼과 같은 글자라 뜻이 갈리지 않았다. 이제 화살표를
 * 없애고 누를 수 있는 면을 행 전체로 넓혔다 — 작은 손에게는 면적이 곧 쓰기 쉬움이다. */
/* O/X 는 글자가 아니라 같은 틀(24×24)에 그린 도형이다. 글자로 두면 글꼴마다 O 는 둥글고 넓게,
   X 는 좁게 나와 둘의 폭·높이가 달랐다. 획 굵기는 같고, 크기는 눈에 같아 보이게 맞춘다 —
   가위표는 끝점 4.75..19.25 에 둥근 끝 1.75 로 바깥이 3..21(18) 인데, 동그라미를 같은 18 로
   두면 모서리까지 뻗는 가위표보다 작아 보였다. 동그라미는 반지름 8.25 에 획 절반 1.75 로
   바깥이 2..22(20) — 한 치수(약 11%) 크다. 7.25·8.0·8.25·8.5 를 나란히 그려 보고 골랐다.
   색은 currentColor 라 정답 행의 .correct / .wrong 이 정한다 (읽어 주기·쉐브론과 같은 방식). */
const MARK_SVG = {
  correct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"' +
    ' role="img" aria-label="맞혔어요"><circle cx="12" cy="12" r="8.25"/></svg>',
  wrong: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"' +
    ' stroke-linecap="round" role="img" aria-label="틀렸어요"><path d="M4.75 4.75 19.25 19.25M19.25 4.75 4.75 19.25"/></svg>',
};

/* mark 는 "correct"(O) · "wrong"(X) · 없음. 차트에서 집계 숫자가 있던
   오른쪽 끝에 겹쳐 그린다 — 자리를 차지하지 않으므로 그림·이름·태그가 행의 폭을
   다 쓴다 (css 의 .answer-row .mark 참고). */
/* noThumb — 보통·어려움은 그림을 뺀다. 큰 그림이 바로 위에 있어 같은 얼굴을 두 번 보여 줄
   까닭이 없다. 쉬움은 선택지 셋이 저마다 얼굴을 보여 줘야 하니 그대로 둔다. */
function answerRowHTML(t, mark, noThumb) {
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  const sign = MARK_SVG[mark] || "";
  return `<div class="rank-row answer-row${mark ? " " + mark : ""}${noThumb ? " no-thumb" : ""}">
    <a class="rank-hit" href="${pingHref(t.id)}" aria-label="${t.nameKo} 자세히 보기"></a>
    ${noThumb ? "" : `<span class="rank-thumb">${imageMarkup(t, 120)}</span>`}
    <span class="rank-body"><span class="rank-text">
      <span class="rank-name-row">
        <span class="rank-name">${t.nameKo}</span>${speakBtnHTML(t.nameKo)}
      </span>
      <!-- 목록 카드와 같은 셋: 기수·등급·성별. 감정은 넣지 않는다 —
           "열쇠 티니핑" 처럼 긴 것이 있어 폰에서 태그가 두 줄로 접혔다. -->
      <span class="rank-tags">
        <span class="tag season">${t.season}</span>
        <span class="tag ${gradeClass}">${t.grade}</span>
        ${t.gender ? `<span class="tag gender-${t.gender}">${t.gender}</span>` : ""}
      </span>
    </span></span><span class="mark">${sign}</span>
  </div>`;
}

/* 정답을 공개한 '그 손가락'이 곧바로 개별 페이지로 이어지지 않게 잠깐 잠가 둔다.
   아이가 빠르게 두 번 누르면 원치 않게 넘어가 버리기 때문.
   링크를 늦게 살리는 일은 css 가 맡는다 (.answer-row.armed). */
function armRows(box) {
  setTimeout(() => {
    box.querySelectorAll(".answer-row").forEach((r) => r.classList.add("armed"));
  }, 350);
}

/* --- 보통/어려움: 이름 가리기 → 3초 카운트다운 뒤 정답 --- */
/* 정답은 손으로 여는 것이 아니라 3초가 지나면 저절로 열린다.
 * 예전에는 「👆 눌러서 이름 보기」 칸을 눌러야 정답이 나왔다. 그러면 그림을 보자마자
 * 눌러 맞혀 보는 참 없이 답만 보고 넘어갈 수 있었다. 시간을 고정해 두면 문제마다
 * 반드시 3초의 '생각하는 참'이 생기고, 그 뒤에는 손을 대지 않아도 답이 온다.
 * 넘기는 것은 그대로 「다음 티니핑」 버튼이다 (정답을 본 뒤에야 열린다).
 *
 * 이름 칸이 그대로 막대다 — 분홍이 왼쪽에서부터 3초 동안 빠져나가고(css 의
 * countdown-drain), 다 빠지면 그 자리에 정답 행이 들어온다. 칸 높이는 정답 행과
 * 같으므로(--answer-h) 바뀌는 순간 화면이 튀지 않는다. 막대의 길이는 여기서
 * animation-duration 으로 넣는다 — 3초라는 숫자를 COUNTDOWN_MS 한 곳에만 두려고.
 *
 * 1초마다 비프음이 난다. 막대는 글을 못 읽는 아이에게도 '줄어드는 것'으로 읽히고,
 * 그림을 보느라 막대를 안 보고 있을 때는 소리가 남은 시간을 알려 준다 — 삐·삐·삐 하고
 * 마지막에 조금 높고 긴 소리와 함께 정답이 열린다. 막대 한가운데에는 남은 초가
 * 3 → 2 → 1 로 소리와 같은 박자로 뜨다가, 마이크로 이름이 들리면 그 자리를 이름에
 * 내준다 (아래 '말해서 맞히기'). */
const COUNTDOWN_MS = 3000;
const TICK_MS = 1000;
let countdownTimers = [];
let countdownSeq = 0;             // 그림을 기다리는 사이에 문제가 바뀌었는지 가리는 표

function cancelCountdown() {
  countdownSeq++;                 // 아직 그림을 기다리던 시작도 여기서 무효가 된다
  countdownTimers.forEach(clearTimeout);
  countdownTimers = [];
}

/* box 안의 그림이 화면에 나타난 뒤 fn 을 부른다. 이미 내려와 있으면(캐시) 곧바로.
   못 내려오면 imageMarkup 의 onerror 가 플레이스홀더로 갈아 끼우는데, 그것도 그림이
   나타난 것이므로 error 에도 부른다. (onerror 가 img 를 떼어 내도 같은 발송 안이라
   여기 걸어 둔 처리기는 그대로 불린다.) */
function whenImageShown(box, fn) {
  const img = box.querySelector("img");
  if (!img || img.complete) { fn(); return; }
  let done = false;
  const go = () => { if (!done) { done = true; fn(); } };
  img.addEventListener("load", go, { once: true });
  img.addEventListener("error", go, { once: true });
}

/* 카운트다운은 그림이 화면에 나타난 뒤에 시작한다. 웹에서는 원본 PNG 가 내려오는 데
   한 박자가 걸려, 문제가 뜨자마자 돌리면 빈 분홍 칸 위에서 숫자가 먼저 줄어들었다 —
   맞혀 볼 그림도 없이 3초가 샌다. 로컬 파일에서는 그림이 그 자리에서 떠서 눈에 띄지
   않았다. 기다리는 동안 막대는 가득 찬 채 서 있고 숫자는 비어 있다(css 의 .counting). */
/* 이름 칸 마크업 — 막대·들린 이름(또는 남은 초)·마이크 */
/* 진행 표시(role) 는 막대에 단다 — 칸에 달면 그 안의 마이크 단추가 보조 기술에 가려진다. */
function slotHTML() {
  const secs = COUNTDOWN_MS / 1000;
  return `
    <div class="name-slot" id="nameSlot">
      <span class="countdown-fill" role="progressbar" aria-label="정답까지 남은 시간"
            aria-valuemin="0" aria-valuemax="${secs}" aria-valuenow="${secs}"
            style="animation-duration: ${COUNTDOWN_MS}ms"></span>
      <span class="heard"></span>${micHTML()}
    </div>`;
}

function renderNameSlot() {
  el.answer.innerHTML = slotHTML();
  const slot = document.getElementById("nameSlot");

  // 소리는 누른 흐름 안에서 깨워 둔다 — 사파리는 그래야 뒤에 시간으로 내는 비프를
  // 들려준다. 음성 합성기는 따로 깨우지 않는다 — 맥 사파리에서 재 보니 누른 뒤 1.5초
  // 있다 부른 읽어 주기도 그냥 났다 (아이폰은 아직 못 재 봤다).
  wakeAudio();
  // 이번 문제의 창. 세션은 문제 화면에 들어올 때 이미 켜져 있다 — 그새 저절로 끝나
  // 있으면 이 흐름에서 다시 켠다 (iOS 는 흐름 밖의 start 를 막을 수 있다).
  hearing = { text: "", matched: false, over: false, base: mic.count, onSettled: null };
  if (mic.wanted && !mic.rec && !mic.dead) startHearing();

  // 카운트다운은 넷이 갖춰져야 시작한다 — 그림이 화면에 나타나고(whenImageShown), 마이크가
  // 정해져 있고(첫 문제는 startMode 가 이미 기다렸고, 다시 켜는 중이면 그것이 정해지고),
  // 난도 칸이 올라가는 전환이 끝나고(afterTransition), 소리 컨텍스트가 실제로 돌고(whenAudioReady).
  const seq = countdownSeq;
  let imageShown = false;
  let started = false;                // 그림과 마이크 양쪽에서 불리므로 한 번만 시작한다
  const tryStart = () => {
    if (started || seq !== countdownSeq) return;   // 이미 시작했거나, 기다리는 사이 나갔다
    // 마이크는 켜려는 중일 때만 기다린다 — 접었거나(dead) 쓰지 않기로 했으면(wanted 아님)
    // 기다릴 것이 없다.
    if (!imageShown || !(mic.settled || mic.dead || !mic.wanted)) return;
    started = true;
    afterTransition(() => {
      if (seq !== countdownSeq) return;
      whenAudioReady(() => { if (seq === countdownSeq) startCountdown(slot); });
    });
  };
  hearing.onSettled = tryStart;
  whenImageShown(el.image, () => { imageShown = true; tryStart(); });
}

/* 소리 컨텍스트가 돌고 시계가 갈 때 fn 을 부른다. 허락 창이 뜨는 사이 사파리가 컨텍스트를
   세워 두면 첫 비프가 컨텍스트가 깨어나는 만큼 늦어져 막대와 어긋난다. 컨텍스트가 없으면
   곧바로, 아니면 깨우고 시계가 가는 것을 본 뒤 간다 — 1.5초 넘게 걸리면 그냥 간다
   (소리는 거드는 것이지 막대를 세우는 것이 아니다). */
const AUDIO_WAIT_MS = 1500;   // 컨텍스트가 깨어나 시계가 가기를 기다리는 한도
function whenAudioReady(fn) {
  const ctx = audioCtx;
  if (!ctx) { fn(); return; }
  const clock = ctx.currentTime;
  let done = false;
  const go = () => { if (!done) { done = true; fn(); } };
  // 세워져 있으면 깨운다. 돌고 있다고 해도 시계가 서 있을 수 있다 — 아이폰은 마이크 녹음이
  // 시작되는 순간 오디오 세션을 바꾸느라 상태는 running 인 채 렌더링만 1초쯤 멈춘다.
  // 그 위에 예약한 삐는 시계가 다시 갈 때 몰려 나므로, 시계가 실제로 가는 것을 보고 시작한다.
  if (ctx.state !== "running") {
    try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch { /* 못 깨우면 한도에서 간다 */ }
  }
  const poll = () => {
    if (done) return;
    if (ctx.state === "running" && ctx.currentTime > clock + 0.02) { go(); return; }
    setTimeout(poll, 50);
  };
  setTimeout(poll, 30);
  setTimeout(go, AUDIO_WAIT_MS);
}

/* 3초 카운트다운 — 막대가 줄어들고, 1초마다 숫자와 비프, 3초에 판정과 정답.

   소리는 컨텍스트의 출력 지연(outputLatency)만큼 늦게 스피커에 닿는다. 마이크가 켜지는
   것과 같은 순간에 컨텍스트를 만드는 맥 사파리에서 160ms 였다 — 녹음용 오디오 장치에
   붙어서 그렇다(진단 페이지처럼 마이크 전에 만든 컨텍스트는 5ms). 그만큼 소리를 먼저
   내고 화면은 그 뒤에 바꾼다: 첫 삐를 지금 내고 지연만큼 뒤에 막대와 숫자를 시작하며,
   그다음 삐들은 저마다의 눈금보다 지연만큼 앞서 낸다. 정답도 띵이 들리는 때에 연다.
   지연을 모르는 브라우저에서는 0 이라 전과 같다. 터무니없는 값은 0.4초에서 자른다. */
function startCountdown(slot) {
  // 40ms 아래는 보정하지 않는다 — 귀로 못 가르는 차이에 화면을 늦추면 삐가 숫자보다 앞서 보인다
  const raw = Math.round(((audioCtx && audioCtx.outputLatency) || 0) * 1000);
  const lat = raw < 40 ? 0 : Math.min(400, raw);
  const ticks = Math.round(COUNTDOWN_MS / TICK_MS);
  const bar = slot.querySelector(".countdown-fill");
  const at = (fn, ms) => { if (ms <= 0) fn(); else countdownTimers.push(setTimeout(fn, ms)); };
  const show = (i) => { bar.setAttribute("aria-valuenow", ticks - i); paintCount(ticks - i); };

  at(() => { slot.classList.add("counting"); show(0); }, lat);   // 막대는 이때부터 줄어든다 (css 의 countdown-drain)
  beep(880, 110);                                                // 첫 소리는 그 자리에서 — 지연 뒤에 막대와 같이 들린다
  for (let i = 1; i < ticks; i++) {
    at(() => beep(880, 110), i * TICK_MS);
    at(() => show(i), lat + i * TICK_MS);
  }
  // 판정은 지금까지 들린 것으로 — 소리가 나는 때에 정하고, 화면은 같은 판정으로 연다.
  // 맞혔으면 띵 대신 딩동(chime). 듣기는 끄지 않는다 — 문제마다 켜고 끄면 iOS 가 그때마다
  // 알림음을 낸다. 이 뒤에 들리는 것은 다음 문제가 시작될 때까지 버린다(hearing.over).
  let hit = false;
  at(() => {
    hit = !!(hearing && hearing.matched);
    if (hit) chime(); else beep(1320, 380);
  }, COUNTDOWN_MS);
  at(() => {
    if (hearing) hearing.over = true;
    revealName(hit ? "correct" : null);
  }, lat + COUNTDOWN_MS);
}

/* 이름 칸을 정답 행으로 갈아 끼운다 — 이름·그림·태그를 한꺼번에 보여 주고,
   그 자리가 그대로 개별 페이지로 가는 바로가기가 된다.
   mark 는 말해서 맞혔을 때의 "correct" 뿐이다. 오른쪽 끝 — 마이크가 있던 자리 — 에
   O 가 온다. 틀렸거나 말이 없으면 아무 표시도 없다 (아래 '말해서 맞히기'). */
function revealName(mark) {
  el.answer.innerHTML = answerRowHTML(current, mark, true);   // 그림은 바로 위에 있다
  armRows(el.answer);
  el.image.classList.remove("silhouette"); // 어려움: 실제 이미지 공개
  lastReveal = { name: current.nameKo, at: performance.now() };   // 마이크에 되돌아 들리면 거른다(isEcho)
  speakText(current.nameKo, el.answer.querySelector(".answer-row [data-speak]"));
  revealed();
}

/* ===== 말해서 맞히기 (보통·어려움) =====
   문제 화면에 있는 동안 마이크가 켜져 있다. 아이가 이름을 말하면 들린 말을 막대 한가운데에
   보여 주고(말하는 도중의 중간 결과도 바로 — 목록의 말해서 찾기와 같은 까닭), 3초가
   되면 정답 행의 오른쪽 끝 — 마이크가 있던 자리 — 에 O 를 그린다. 맞혔을 때만이다.
   틀렸거나 말이 없으면 아무 표시도 하지 않는다 — 지어낸 이름은 인식기가 자주 어긋나서
   맞게 말했는데 X 를 받는 일이 생기고, 말이 없었던 것은 틀린 것이 아니다.

   들은 말은 js/hear.js 의 fixHeard 로 이름으로 고쳐 견준다. 후보 셋 중 하나라도 정답이면
   맞힌 것으로 치고, 소리 열쇠가 같은 짝(아야핑/아아핑)은 둘 다 정답이다(sameName).
   한 번 맞혔으면 그 뒤에 딴말을 해도 맞힌 것이다.

   듣기는 문제가 아니라 문제 화면 단위다. 난도 칸을 누른 그 흐름 안에서 start() 를 불러야
   사파리가 허락을 묻고 켜 주며, 허락이 정해지면 그때 첫 문제를 낸다(startMode). 그 뒤로는
   문제 사이에도 끄지 않는다 — iOS 는 인식기를 켜고 끌 때마다 알림음을 내는데, 문제마다
   켜고 끄니 문제마다 두 번씩 울렸다. 난도 화면으로 나가거나 화면을 떠날 때 끈다.
   저절로 끝나면(긴 침묵·세션 한도·네트워크) 다시 켠다 — 곧장 끝나기를 되풀이하면
   세 번까지만. 다시 켤 때는 이미 허락된 뒤라 창은 뜨지 않고 알림음만 한 번 난다.

   결과는 세션 내내 쌓이므로 문제마다 창을 낸다. 문제를 시작할 때 그때까지의 결과 수를
   적어 두고(hearing.base) 그 뒤에 온 것만 이번 문제로 본다. 3초 판정 뒤에 오는 것은
   다음 문제가 시작될 때까지 버린다. 정답을 읽어 주는 우리 목소리는 대개 판정 뒤에
   받아 적혀 그대로 버려지고, 「다음 티니핑」을 아주 빨리 눌러 새 문제로 새어 든 것은
   공개한 지 몇 초 안에 들린 그 이름을 무시하는 것으로 거른다(isEcho).

   첫 문제는 마이크가 정해진 뒤에 낸다 — 실제로 녹음이 시작됐거나(audiostart), 못 켜졌거나(거부·
   오류·인식 없음). 그때까지는 난도 화면에 머문다 — 허락 창이 문제 위에 뜨면 그 뒤로 문제
   모양이 비치고, 창이 떠 있는 동안 3초가 새면 첫 문제가 마이크 없이 지나가 버린다.
   신호가 없는 브라우저가 있을까 봐 30초에는 그냥 낸다(MIC_WAIT_MS). 문제
   도중에 다시 켜는 중이면 2초까지만 기다린다(MIC_RESTART_WAIT_MS). 마이크 표시가
   번지는 것도 실제로 켜진 뒤부터다.

   인식이 없는 브라우저(파이어폭스 등)나 허락을 받지 못한 기기에서는 마이크 표시를 내지
   않고 카운트다운만 돈다 — 아무 일도 안 하는 것을 남기지 않는 것은 목록과 같다. 한 번
   거부하면 단추를 눌러도 브라우저가 허락 창을 다시 띄워 주지 않으므로 남겨 둘 까닭이 없다.
   인식기 클래스는 부를 때마다 window 에서 찾는다 — 시험할 때 가짜를 끼워 넣기 쉽게. */
const MIC_WAIT_MS = 30000;          // 처음 켤 때(허락 창) 기다리는 한도 — 신호가 없는 브라우저용 안전망
const MIC_RESTART_WAIT_MS = 2000;   // 문제 도중에 다시 켤 때 기다리는 한도
const ECHO_MS = 4000;               // 공개한 정답이 되돌아 들리는 것으로 보는 시간
const mic = {
  rec: null,          // 지금 듣고 있는 인식기
  wanted: false,      // 문제 화면에 있어 켜 두어야 하는가
  listening: false,   // 실제로 듣는 중인가 (start 뒤)
  settled: false,     // 켜졌든 못 켜졌든 정해졌는가
  dead: false,        // 허락을 못 받았거나 시작이 안 되면 이번 방문에서는 접는다 (단추도 거둔다)
  off: false,         // 손으로 꺼 두었다(「싫어요」·마이크 단추) — 단추를 누를 때까지 스스로 켜지 않는다
  count: 0,           // 이번 세션에서 지금까지 쌓인 결과 수
  restarts: 0,
  startedAt: 0,
  capTimer: null,
  onSettled: null,    // 정해지면 한 번 부를 것 (첫 문제 내기)
};
let hearing = null;      // 이번 문제에 들린 것 { text, matched, over, base, onSettled }
let lastReveal = null;   // 마지막으로 읽어 준 정답 { name, at }

const recognitionClass = () => window.SpeechRecognition || window.webkitSpeechRecognition;

/* 검색창의 마이크(index.html)와 같은 그림 */
const MIC_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
  ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" stroke="none"/>' +
  '<path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><line x1="12" y1="17.5" x2="12" y2="21"/></svg>';

/* 마이크 단추. 켜져 있으면 번지고(listening), 누르면 끄고 켠다(toggleMic). */
function micHTML() {
  if (mic.dead || !recognitionClass()) return "";
  return `<button type="button" class="slot-mic${mic.listening ? " listening" : ""}"` +
    ` aria-pressed="${mic.listening}" aria-label="${mic.listening ? "말해서 맞히기 끄기" : "말해서 맞히기 켜기"}"` +
    ` title="말해서 맞히기">${MIC_ICON}</button>`;
}
function paintMic(on) {
  mic.listening = on;
  const m = el.answer.querySelector(".slot-mic");
  if (!m) return;
  m.classList.toggle("listening", on);
  m.setAttribute("aria-pressed", on ? "true" : "false");
  m.setAttribute("aria-label", on ? "말해서 맞히기 끄기" : "말해서 맞히기 켜기");
}
/* 마이크 단추를 누르면 — 꺼져 있으면 켠다. 다른 페이지에 다녀와(뒤로 가기) 마이크가 꺼진 채
   되살아났는데 스스로 못 켰을 때 손으로 켜는 길이다. 켜져 있으면 끈다 — 다음 문제부터도
   켜지 않고, 다시 누르면 켠다. 누른 흐름 안이라 iOS 도 켜 준다. */
function toggleMic() {
  if (mic.dead) return;
  // 끄는 것도 정해진 것이다 — 다시 켜던 중에 끄면 그 마이크를 기다리던 카운트다운을 풀어 준다.
  // 손으로 껐으니 다음 문제·다른 난도·뒤로 가기로 돌아왔을 때도 스스로 켜지 않는다(off).
  if (mic.rec) { stopHearing(); mic.off = true; settleMic(); return; }
  // 켠다. 「싫어요」로 시작했다면 브라우저가 처음 묻는 것이라 여기서 허락 창이 뜬다 — 누른 흐름
  // 안이라 사파리도 묻는다. 거부하면 오류 처리가 단추를 거둔다(giveUpMic). 손으로 켠 것이니
  // 다시 켜기 횟수도 새로 센다.
  mic.off = false;
  mic.wanted = true;
  mic.restarts = 0;
  startHearing();
}
el.answer.addEventListener("click", (e) => {
  if (e.target.closest(".slot-mic")) toggleMic();
});
/* 들린 이름을 막대 한가운데에. 남은 초를 세던 숫자가 있었다면 밀어낸다. */
function paintHeard(text) {
  const h = el.answer.querySelector(".heard");
  if (!h) return;
  h.textContent = text;
  h.classList.remove("num");
}
/* 아직 들린 말이 없을 때는 남은 초를 큰 숫자로 센다 — 삐 소리마다 3 → 2 → 1. 이름이
   한 번 들리면 그 뒤로는 숫자를 그리지 않는다. 숫자는 요소째 갈아 끼운다 — 새로 놓여야
   튀는 애니메이션(css 의 count-pop)이 다시 돌아, 소리와 같은 박자로 한 번씩 튄다. */
function paintCount(n) {
  if (hearing && hearing.text) return;
  const old = el.answer.querySelector(".heard");
  if (!old) return;
  const fresh = document.createElement("span");
  fresh.className = "heard num";
  fresh.textContent = n;
  old.replaceWith(fresh);
}
/* 이번 방문에서는 마이크를 접는다 — 표시도 그 자리에서 거둔다. 한 번 거부하면 단추를
   눌러도 브라우저가 허락 창을 다시 띄워 주지 않으므로, 남겨 두어도 누를 일이 없다. */
function giveUpMic() {
  mic.dead = true;
  // 접었으면 더 기다릴 것이 없다 — 정해진 것으로 친다. 카운트다운이 오지 않을 마이크를
  // 기다리며 시작하지 않는 일이 없게 한다.
  mic.settled = true;
  const m = el.answer.querySelector(".slot-mic");
  if (m) m.remove();
}
/* 마이크가 정해졌다 — 켜졌든 못 켜졌든. 기다리던 것(첫 문제 내기 · 카운트다운)을 풀어 준다. */
function settleMic() {
  // 이미 정해진 뒤에 또 불려도 된다 — 기다리던 것은 한 번 부르고 떼어 내므로 두 번 가지 않는다.
  // (마이크를 접은 뒤 다시 난도를 고르면 정해진 채로 시작하는데, 그때도 넘어가야 한다.)
  mic.settled = true;
  clearTimeout(mic.capTimer);
  mic.capTimer = null;
  // 부르기 전에 둘 다 떼어 둔다 — 첫 문제 내기(first)가 새 문제의 훅을 달아 두는데,
  // 그것까지 여기서 부르면 카운트다운이 두 번 시작된다. 새 문제의 훅은 그림이 뜰 때 불린다.
  const first = mic.onSettled;
  mic.onSettled = null;
  const go = hearing ? hearing.onSettled : null;
  if (hearing) hearing.onSettled = null;
  if (first) first();
  if (go) go();
}
/* 방금 읽어 준 정답이 인식기에 되돌아 들린 것인가 */
function isEcho(name) {
  return !!lastReveal && performance.now() - lastReveal.at < ECHO_MS && sameName(name, lastReveal.name);
}

/* 문제 화면에 들어올 때 켠다(누른 흐름 안에서). 저절로 끝났을 때는 onend 가 다시 부르고,
   그래도 안 켜져 있으면 다음 문제를 누를 때(renderNameSlot) 그 흐름에서 또 켠다. */
/* soft — 누른 흐름 밖에서 켜 보는 것(되살아날 때). iOS 가 막으면 거부처럼 보이지만
   '허락 안 함'이 아니므로 접지 않고 꺼 둔다. 다음 문제나 마이크 단추를 누를 때 흐름 안에서 켠다. */
function startHearing(waitMs, soft) {
  if (!mic.wanted) return;
  const R = recognitionClass();
  if (!R || mic.dead) { settleMic(); return; }   // 기다릴 것이 없다
  if (mic.rec) return;
  mic.settled = false;
  clearTimeout(mic.capTimer);
  mic.capTimer = setTimeout(settleMic, waitMs || MIC_RESTART_WAIT_MS);

  const r = new R();
  r.soft = !!soft;
  r.everStarted = false;
  r.lang = "ko-KR";
  r.interimResults = true;
  r.continuous = true;            // 문제 사이에도 끊기지 않게
  r.maxAlternatives = 3;          // 첫 후보가 어긋나도 뒤 후보가 이름으로 풀리는 일이 잦다

  // 실제로 녹음이 시작됐다 — 허락 창이 모두 닫힌 뒤다. start 가 아니라 audiostart 를 기다린다:
  // iOS 는 start 를 보낸 뒤에 시스템의 음성 인식 허락 창을 한 번 더 띄우고, 녹음은 그 창이
  // 닫힌 뒤에야 시작한다. start 에서 문제를 내면 허락 창 뒤에서 문제가 먼저 떠 있었다.
  r.onstart = null;
  r.onaudiostart = () => {
    if (mic.rec !== r) return;
    r.everStarted = true;
    mic.startedAt = performance.now();
    paintMic(true);
    settleMic();
  };
  r.onresult = (e) => {
    if (mic.rec !== r) return;
    mic.count = e.results.length;
    if (!hearing || hearing.over) return;
    // 이번 문제의 창(base 뒤)만 훑는다. 앞선 결과는 굳은 것이고 마지막 결과는 아직 바뀌는
    // 중일 수 있는데, 어느 쪽이든 정답이 들렸으면 들린 것이다. 보여 줄 말은 뒤에 말한 것이
    // 앞에 말한 것을 덮되, 이름으로 풀리는 후보를 앞세운다.
    let shown = "";
    for (let i = hearing.base; i < e.results.length; i++) {
      const res = e.results[i];
      let pick = "";
      for (let j = 0; j < res.length; j++) {
        const guess = fixHeard(cleanHeard(res[j].transcript));
        if (!guess) continue;
        if (isEcho(guess)) { pick = ""; break; }   // 방금 읽어 준 정답이 되돌아온 것
        if (sameName(guess, current.nameKo)) { hearing.matched = true; pick = current.nameKo; break; }
        if (!pick || (NAMES.has(guess) && !NAMES.has(pick))) pick = guess;
      }
      if (pick) shown = pick;
    }
    if (hearing.matched) shown = current.nameKo;   // 한 번 맞혔으면 그 이름을 그대로 보여 준다
    if (!shown) return;                            // 들린 것이 비면 보이던 것(숫자)을 그대로 둔다
    hearing.text = shown;
    paintHeard(shown);
  };
  r.onerror = (e) => {
    if (mic.rec !== r) return;
    if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
      if (!r.soft) {              // 흐름 밖에서 켜 본 것이면 막힌 것일 뿐이라 접지 않는다
        giveUpMic();
        showToast("마이크를 쓸 수 없어요 🥲");
      }
    }
    settleMic();                  // 거부도 '정해진 것'이다 — 첫 문제를 더 기다리게 하지 않는다
    // no-speech·aborted·network 는 곧이어 오는 onend 가 이어서 맡는다
  };
  r.onend = () => {
    if (mic.rec !== r) return;    // 이미 끊고 새것으로 넘어갔다
    mic.rec = null;
    paintMic(false);
    settleMic();                  // 켜 보지도 못하고 끝났어도 정해진 것이다
    if (!mic.wanted || mic.dead) return;
    if (r.soft && !r.everStarted) return;   // 흐름 밖에서 켜 보다 막힌 것 — 누를 때까지 꺼 둔다
    // 한참 듣다가 끝난 것이면 되풀이가 아니다 — 켠 횟수를 처음부터 센다
    if (performance.now() - mic.startedAt > 5000) mic.restarts = 0;
    if (mic.restarts < 3) { mic.restarts++; startHearing(); }
  };

  mic.rec = r;
  mic.count = 0;                    // 새 세션의 결과는 0 부터 쌓인다
  if (hearing) hearing.base = 0;    // 이번 문제의 창도 거기서부터
  try {
    r.start();
  } catch {
    mic.rec = null;
    giveUpMic();                  // 시작부터 안 되면 이번 방문에서는 접는다
    settleMic();
  }
  // 표시는 아직 켜지 않는다 — 실제로 듣기 시작하면(onstart) 켠다
}

/* 문제 화면을 떠날 때 끈다 — 난도 화면으로 나가기, 화면 떠나기, 쉬움으로 가기.
   처리기를 먼저 떼어 낸다 — 뒤늦은 onend 가 새 세션을 끄거나 다시 켜면 안 된다. */
function stopHearing() {
  mic.wanted = false;
  mic.onSettled = null;
  clearTimeout(mic.capTimer);
  mic.capTimer = null;
  const r = mic.rec;
  mic.rec = null;
  if (r) {
    r.onstart = r.onaudiostart = r.onresult = r.onerror = r.onend = null;
    try { r.abort(); } catch { /* 이미 끝난 인식기면 던질 수 있다 */ }
  }
  paintMic(false);
}
window.addEventListener("pagehide", stopHearing);   // 다른 페이지로 가면 끈다 — 목록의 말해서 찾기와 같은 까닭
/* 다른 페이지에 다녀와 되살아나면(bfcache) 마이크는 떠날 때 꺼 둔 채다. 문제 화면이면 다시
   켜 본다 — iOS 는 누른 흐름 밖에서 켜는 것을 막을 수 있는데, 그러면 꺼진 채로 두고 다음
   문제를 누를 때나 마이크 단추로 켠다(soft). 그때의 거부는 '허락 안 함'이 아니라 접지 않는다. */
window.addEventListener("pageshow", (e) => {
  if (!e.persisted || el.stage.hidden || !mode || MODES[mode].choices || mic.dead || mic.off) return;
  mic.wanted = true;
  startHearing(MIC_RESTART_WAIT_MS, true);
});

/* ===== 비프음 =====
   소리 파일 없이 Web Audio 의 발진기로 낸다 — 그림 157장에 소리 파일까지 얹을 것
   없고, 길이·높이를 숫자로 다룰 수 있다. 사인파라 아이 귀에 둥글고, 10ms 만에 켜서
   꼬리로 스러지게 하여 딸깍 소리가 나지 않는다.

   사파리(특히 아이폰)는 사용자가 누른 흐름 안에서 만들거나 resume() 한 AudioContext
   만 소리를 낸다. 문제는 늘 누른 데서 시작하므로(난도 칸 · 「다음 티니핑」) 그 흐름
   안에서 wakeAudio() 를 부른다 — 난도 칸은 pointerdown 에서, 클릭보다 한 박자 앞서.
   맥 사파리는 음성 합성기가 이미 깨어 있는 상태에서 만든 첫 컨텍스트에 큰 출력 버퍼를
   준다(출력 지연 160ms — 합성기 전에 만든 컨텍스트는 5ms). 그래서 페이지를 열 때 합성기를
   미리 깨우지 않고(js/util.js), 컨텍스트를 만든 뒤에야 무음 발화로 깨운다. 먼저 돌고 있는
   컨텍스트는 그 뒤에 합성기가 깨어나도 그대로다. 정작 소리는 그림이 나타난 뒤 흐름 밖에서 나는데,
   깨어 있는 컨텍스트에서는 그냥 난다. 전화가 오거나 백그라운드에 다녀오면
   컨텍스트가 멈춰 있는데, 다음 문제 역시 누른 데서 시작하므로 거기서 다시 깨어난다.

   AudioContext 가 없는 브라우저나 무음 스위치를 켠 아이폰에서는 소리만 빠지고
   막대는 그대로 간다 — 소리는 막대를 거드는 것이지 대신하는 것이 아니다. */
let audioCtx = null;

function wakeAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  // resume() 이면 된다. 맥 사파리에서 재 보니 resume() 이 끝나기 전에 예약한 소리도
  // 깨어나는 순간 났다. 옛 iOS 가 요구하던 '누른 흐름 안에서 무언가를 실제로 재생'
  // 은 두지 않는다 — 말해서 맞히기가 되는 iOS(14.5+)는 resume() 으로 풀린다.
  try {
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state !== "running") audioCtx.resume();
  } catch { audioCtx = null; }    // 못 깨우면 이번에는 소리 없이 간다
}

/* freq Hz 의 소리를 ms 동안 낸다. 세기는 아이 옆에서 나는 소리라 낮게 잡는다.
   컨텍스트가 멈춰 있으면 깨우고 건다. 사파리는 마이크가 켜지거나 전화가 오면 컨텍스트를
   'interrupted' 로 세워 두는데, 누른 흐름 안에서 한 번 깨운 컨텍스트는 그 뒤로는 흐름
   밖에서도 깨울 수 있다. 멈춘 컨텍스트에서는 시계가 서 있어, 아래 예약은 깨어나는 순간
   그 자리에서 난다 — resume() 이 끝나기를 기다리지 않아도 된다. */
function beep(freq, ms) { tone(freq, 0, ms / 1000); }

/* 맞혔을 때의 긍정음 — 두 음이 올라가는 '딩동'. 도(C6)에서 미(E6)로 오르는 장3도라 밝게
   들린다. 보통·어려움에서는 3초 끝의 띵 대신 나고, 쉬움에서는 정답 선택지를 고른 순간 난다.
   두 번째 음이 첫 음 꼬리에 살짝 겹쳐 붙어 한 덩어리로 들린다. */
function chime() {
  tone(1047, 0, 0.16);
  tone(1319, 0.14, 0.42);
}

/* freq Hz 의 소리를 offset 초 뒤에 dur 초 동안 낸다. beep 과 chime 이 쓴다. */
function tone(freq, offset, dur) {
  const ctx = audioCtx;
  if (!ctx) return;
  try {
    if (ctx.state !== "running") {
      // 세워진 컨텍스트에 예약하면 깨어나는 순간 뒤늦게 난다 — 막대와 어긋난 삐는 없는 것이
      // 낫다. 이번 소리는 건너뛰고 깨우기만 한다. 다음 소리는 제때 난다.
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => { /* 못 깨우면 다음 소리도 없다 */ });
      return;
    }
    const t = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch { /* 소리는 거드는 것뿐 — 못 내도 카운트다운은 간다 */ }
}

/* --- 쉬움: 3지선다 --- */
/* 선택지는 <button> 이 아니라 role="button" 인 <div> 다 — 버튼 안에 버튼을 넣으면
 * 파서가 안쪽 버튼을 바깥으로 밀어내 마크업이 깨진다. (눌러서 정답을 열던 때의
 * 이름 칸(.name-slot)이 쓰던 방식이다. 지금 이름 칸은 누르는 칸이 아니라 막대다.)
 *
 * 읽어 주기 버튼은 세 선택지 모두에 처음부터 붙는다. 글을 못 읽는 아이에게는
 * 선택지를 들어 보는 것이 곧 문제를 읽는 것이라, 답을 알려 주는 것이 아니다.
 *
 * 고르고 나면 이 칸들은 사라진다 — 셋 다 정답 행으로 갈아 끼워지므로
 * '고른 뒤' 모양은 여기가 아니라 answerRowHTML 에 있다. */
function renderChoices() {
  const others = shuffle(quizPool().filter((t) => t.id !== current.id)).slice(0, 2);
  const options = shuffle([current, ...others]);
  el.answer.innerHTML = `<div class="choices">${
    options.map((o) =>
      `<div class="choice-btn" role="button" tabindex="0" data-id="${o.id}">` +
      `<span class="choice-name">${o.nameKo}</span>${speakBtnHTML(o.nameKo)}</div>`).join("")
  }</div>`;

  const btns = [...el.answer.querySelectorAll(".choice-btn")];

  // 선택지 셋을 텀을 두고 차례로 읽어 준다 — 한글을 아직 못 읽는 아이도 보기를 귀로
  // 훑고 고르도록. 읽는 동안에는 그 선택지의 버튼이 펄스로 뛰어, 지금 어느 이름을
  // 읽는지 눈으로도 따라갈 수 있다. 쉬움을 고를 때 「좋아요」라고 한 경우에만이다(readChoices).
  if (readChoices) {
    speakSeries(btns.map((b) => ({
      text: b.querySelector(".choice-name").textContent,
      btn: b.querySelector("[data-speak]"),
    })));
  }
  let settled = false;

  const pick = (btn, e) => {
    if (e && e.target.closest("[data-speak]")) return;   // 안쪽 읽어 주기 버튼
    if (settled) return;
    settled = true;
    const chosenId = btn.dataset.id;
    // 맞혔으면 보통·어려움과 같은 딩동. 누른 흐름 안이라 컨텍스트도 여기서 깨운다.
    if (chosenId === current.id) { wakeAudio(); chime(); }
    // 선택지 셋을 제자리에서 차트 항목으로 갈아 끼운다. 고른 것 하나만이 아니라
    // 셋 다 바꾸는 이유: 나머지 둘도 결국 티니핑이고, 아이는 방금 들어 본 이름의
    // 얼굴을 궁금해한다. 세 줄 모두 그 티니핑 페이지로 가는 바로가기가 된다.
    // 고르지 않은 오답에는 표시를 하지 않는다 — 틀린 것은 내가 고른 하나뿐이다.
    el.answer.innerHTML = `<div class="choices">${
      options.map((o) => answerRowHTML(
        o, o.id === current.id ? "correct" : o.id === chosenId ? "wrong" : null)).join("")
    }</div>`;
    armRows(el.answer);
    // 정답이 무엇이었는지 귀로도 알려 준다. 정답 행의 버튼이 펄스로 뛴다.
    speakText(current.nameKo, el.answer.querySelector(".answer-row.correct [data-speak]"));
    revealed();
  };

  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => pick(btn, e));
    btn.addEventListener("keydown", (e) => {
      if (e.target.closest("[data-speak]")) return;   // 위와 같은 이유
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(btn, e); }
    });
  });
}

/* 문제 순서는 페이지를 열 때 한 번 섞고 난도를 바꿔도 이어 쓴다 — 난도마다 새로 섞으면
   방금 본 것이 금방 또 나온다. 첫 문제의 그림은 난도를 고르는 동안 미리 받아 둔다. */
pool = shuffle(quizPool());
preloadImage(pool[pool.length - 1]);

/* 이벤트 */
el.diffScreen.querySelectorAll(".diff-card").forEach((card) => {
  // 누르기 시작하는 순간(pointerdown)에 소리 컨텍스트를 먼저 깨우고, 손을 떼는 클릭에서
  // 합성기 깨우기(무음 발화)와 마이크를 켠다. 맥 사파리는 음성 합성기가 이미 깨어 있는
  // 상태에서 만든 첫 컨텍스트에 큰 출력 버퍼(160ms)를 주므로 컨텍스트가 합성기보다 먼저여야
  // 한다 — 클릭 안에서도 wakeAudio 가 primeSpeech 보다 앞서지만, 누름에서 미리 깨워 두면
  // 뗄 때까지 한 박자 여유가 생긴다. pointerdown 을 소리 깨우기로 쳐 주지 않는 브라우저라도
  // 클릭에서 다시 깨우니 해는 없다.
  card.addEventListener("pointerdown", () => wakeAudio());
  card.addEventListener("click", () => startMode(card.dataset.mode));
});
el.modeBar.addEventListener("click", backToDifficulty);
el.next.addEventListener("click", nextQuestion);

/* 난도 고르는 화면의 각 칸 오른쪽에 오늘·누적 도전수를 두 줄로 적는다.
   영역별 방문을 오늘·누적으로 보여 주는 것과 같은 짝이다 — 통계 페이지에서
   이미 익힌 읽는 법이 여기서도 그대로 통한다.
   고르기 전에 어느 난도를 얼마나 해 봤는지 보이는 편이 고르는 데 도움이 된다.
   문제 화면 맨 위에도 이 칸이 그대로 올라가므로(drawModeCard), 고르기 전과 푸는 중에
   같은 숫자를 같은 자리에서 보게 된다. */
function drawModeCounts() {
  if (!modeCounts || !modeCounts.today || !modeCounts.total) return;
  const n = (v) => Number(v || 0).toLocaleString("ko-KR");
  el.diffScreen.querySelectorAll("[data-count]").forEach((box) => {
    const m = box.dataset.count;
    box.innerHTML = `<span>오늘 도전 ${n(modeCounts.today[m])}</span>` +
      `<span>누적 도전 ${n(modeCounts.total[m])}</span>`;
  });
}

onStats((s) => {
  const m = (s || {}).mode;
  if (!m || !m.today || !m.total) return;
  modeCounts = m;
  drawModeCounts();
  if (mode) drawModeCard();         // 푸는 중이면 위에 얹힌 칸까지 다시 그린다
});
