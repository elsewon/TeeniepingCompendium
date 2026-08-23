/* ===== 이름 맞추기 (난도: 쉬움/보통/어려움) ===== */
const MODES = {
  easy:   { label: "🍭 쉬움", choices: true, silhouette: false },
  normal: { label: "🍨 보통", choices: false, silhouette: false },
  hard:   { label: "😎 어려움", choices: false, silhouette: true },
};

const el = {
  diffScreen: document.getElementById("difficultyScreen"),
  stage: document.getElementById("stage"),
  image: document.getElementById("quizImage"),
  answer: document.getElementById("answerArea"),
  next: document.getElementById("nextBtn"),
  score: document.getElementById("score"),
  modeLabel: document.getElementById("modeLabel"),
  changeBtn: document.getElementById("changeBtn"),
};

let mode = null;
/* 난도별 주간·월간 도전수. js/stats.js 가 받아 온 것을 이벤트로 넘겨받는다
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

function startMode(m) {
  mode = m;
  pool = [];
  el.modeLabel.textContent = "난도: " + MODES[m].label;
  el.diffScreen.hidden = true;
  el.stage.hidden = false;
  nextQuestion();
}

function backToDifficulty() {
  el.stage.hidden = true;
  el.diffScreen.hidden = false;
}

function nextQuestion() {
  if (!quizPool().length) {
    el.image.innerHTML = "";
    el.answer.innerHTML = `<div class="name-slot"><span class="hint">데이터가 아직 없어요</span></div>`;
    return;
  }
  if (!pool.length) pool = shuffle(quizPool());
  current = pool.pop();
  // 문제 하나 = 도전 한 번. js/stats.js 가 받아서 난도별로 센다.
  document.dispatchEvent(new CustomEvent("ping:quiz", { detail: { mode } }));

  // 이미지 (어려움: 실루엣)
  el.image.innerHTML = imageMarkup(current, 380);
  el.image.classList.toggle("silhouette", MODES[mode].silhouette);

  // 정답 영역 — 두 그리기 함수가 #answerArea 를 통째로 다시 쓴다
  MODES[mode].choices ? renderChoices() : renderNameSlot();
  updateScore();
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

function updateScore() {
  const n = (v) => Number(v || 0).toLocaleString("ko-KR");
  // 통계가 오기 전이나 꺼져 있을 때는 예전처럼 전체 마릿수를 보여 준다
  el.score.textContent = modeCounts
    ? `주간 도전 ${n(modeCounts.week[mode])}  ·  월간 도전 ${n(modeCounts.month[mode])}`
    : `전체 ${quizPool().length}마리`;
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
    updateScore();
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
el.changeBtn.addEventListener("click", backToDifficulty);
el.next.addEventListener("click", nextQuestion);

document.addEventListener("ping:stats", (e) => {
  const m = (e.detail || {}).mode;
  if (!m || !m.week || !m.month) return;
  modeCounts = m;
  if (mode) updateScore();          // 퀴즈를 푸는 중이면 바로 반영
});
