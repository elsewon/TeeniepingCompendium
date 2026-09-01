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
  copy.removeAttribute("data-mode");
  copy.setAttribute("aria-label", "난도 바꾸기");
  copy.title = "난도 바꾸기";
  el.modeBar.replaceChildren(copy);
}

function startMode(m) {
  mode = m;
  pool = [];
  drawModeCard();
  el.diffScreen.hidden = true;
  el.stage.hidden = false;
  nextQuestion();
}

function backToDifficulty() {
  el.stage.hidden = true;
  el.diffScreen.hidden = false;
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
  if (!quizPool().length) {
    el.image.innerHTML = "";
    el.answer.innerHTML = `<div class="name-slot"><span class="hint">데이터가 아직 없어요</span></div>`;
    return;
  }
  if (!pool.length) pool = shuffle(quizPool());
  current = pool.pop();

  // 이미지 (어려움: 실루엣)
  el.image.innerHTML = imageMarkup(current, 380);
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
/* mark 는 "correct"(O) · "wrong"(X) · 없음. 차트에서 집계 숫자가 있던
   오른쪽 끝에 겹쳐 그린다 — 자리를 차지하지 않으므로 그림·이름·태그가 행의 폭을
   다 쓴다 (css 의 .answer-row .mark 참고). */
function answerRowHTML(t, mark) {
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  const sign = mark === "correct" ? "O" : mark === "wrong" ? "X" : "";
  return `<div class="rank-row answer-row${mark ? " " + mark : ""}">
    <a class="rank-hit" href="${pingHref(t.id)}" aria-label="${t.nameKo} 자세히 보기"></a>
    <span class="rank-thumb">${imageMarkup(t, 120)}</span>
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

/* --- 보통/어려움: 이름 가리기 --- */
function renderNameSlot() {
  el.answer.innerHTML = `
    <div class="name-slot" id="nameSlot" role="button" tabindex="0">
      <span class="hint">👆 눌러서 이름 보기</span>
    </div>`;
  const slot = document.getElementById("nameSlot");
  const act = () => {
    // 이름 칸을 정답 행으로 갈아 끼운다 — 이름·그림·태그를 한꺼번에 보여 주고,
    // 그 자리가 그대로 개별 페이지로 가는 바로가기가 된다.
    el.answer.innerHTML = answerRowHTML(current);
    armRows(el.answer);
    el.image.classList.remove("silhouette"); // 어려움: 실제 이미지 공개
    speakText(current.nameKo, el.answer.querySelector(".answer-row [data-speak]"));
    revealed();
  };
  slot.addEventListener("click", act);
  slot.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
  });
}

/* --- 쉬움: 3지선다 --- */
/* 선택지는 <button> 이 아니라 role="button" 인 <div> 다 — 버튼 안에 버튼을 넣으면
 * 파서가 안쪽 버튼을 바깥으로 밀어내 마크업이 깨진다. 이름 칸(.name-slot)이
 * 원래 쓰던 방식과 같다.
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
  // 읽는지 눈으로도 따라갈 수 있다.
  speakSeries(btns.map((b) => ({
    text: b.querySelector(".choice-name").textContent,
    btn: b.querySelector("[data-speak]"),
  })));
  let settled = false;

  const pick = (btn, e) => {
    if (e && e.target.closest("[data-speak]")) return;   // 안쪽 읽어 주기 버튼
    if (settled) return;
    settled = true;
    const chosenId = btn.dataset.id;
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

/* 이벤트 */
el.diffScreen.querySelectorAll(".diff-card").forEach((card) => {
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

document.addEventListener("ping:stats", (e) => {
  const m = (e.detail || {}).mode;
  if (!m || !m.today || !m.total) return;
  modeCounts = m;
  drawModeCounts();
  if (mode) drawModeCard();         // 푸는 중이면 위에 얹힌 칸까지 다시 그린다
});
