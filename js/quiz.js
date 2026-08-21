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
  reveal: document.getElementById("revealInfo"),
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

  // 정답 영역
  hideTags();
  MODES[mode].choices ? renderChoices() : renderNameSlot();
  updateScore();
}

/* 정답이 공개되는 순간 기수·등급·성별·감정 태그를 함께 보여 준다.
   목록 카드와 똑같은 .tag 마크업을 써서 모양을 맞춘다. */
function showTags() {
  const t = current;
  const gradeClass = ["로열", "레전드", "빌런"].includes(t.grade) ? "grade-" + t.grade : "";
  el.reveal.innerHTML = `
    <span class="tag season">${t.season}</span>
    <span class="tag ${gradeClass}">${t.grade}</span>
    ${t.gender ? `<span class="tag gender-${t.gender}">${t.gender}</span>` : ""}
    ${t.emotion ? `<span class="tag">${t.emotion}</span>` : ""}`;
  el.reveal.hidden = false;
}

function hideTags() {
  el.reveal.hidden = true;
  el.reveal.innerHTML = "";
}

function gotoDetail() {
  location.href = pingHref(current.id);
}

/* 정답을 공개한 '그 클릭'이 곧바로 페이지 이동으로 이어지지 않게 잠깐 잠가 둔다.
   아이가 빠르게 두 번 누르면 원치 않게 넘어가 버리기 때문. */
function armLater(ms) {
  const gate = { ok: false };
  setTimeout(() => { gate.ok = true; }, ms || 350);
  return gate;
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
  let gate = null;
  const act = () => {
    // 이름이 이미 공개돼 있으면 두 번째 누름은 개별 페이지로 이동
    if (slot.classList.contains("revealed")) { if (gate.ok) gotoDetail(); return; }
    gate = armLater();
    slot.classList.add("revealed");
    slot.innerHTML = `<span class="ans">${current.nameKo}<span class="go">→</span></span>`;
    slot.title = current.nameKo + " 개별 페이지로 이동";
    el.image.classList.remove("silhouette"); // 어려움: 실제 이미지 공개
    showTags();
  };
  slot.addEventListener("click", act);
  slot.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); }
  });
}

/* --- 쉬움: 3지선다 --- */
function renderChoices() {
  const others = shuffle(quizPool().filter((t) => t.id !== current.id)).slice(0, 2);
  const options = shuffle([current, ...others]);
  el.answer.innerHTML = `<div class="choices">${
    options.map((o) => `<button class="choice-btn" data-id="${o.id}">${o.nameKo}</button>`).join("")
  }</div>`;

  const btns = [...el.answer.querySelectorAll(".choice-btn")];
  let settled = false, gate = null;
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (settled) {
        if (gate.ok && btn.classList.contains("go-detail")) gotoDetail();
        return;
      }
      settled = true;
      gate = armLater();
      const chosenId = btn.dataset.id;
      btns.forEach((b) => {
        if (b.dataset.id === current.id) {
          b.classList.add("correct");
          b.insertAdjacentHTML("afterbegin", '<span class="mark">O</span>');
          // 정답 버튼은 살려 두고 개별 페이지로 가는 버튼으로 바꾼다
          b.insertAdjacentHTML("beforeend", '<span class="go">→</span>');
          b.classList.add("go-detail");
          b.title = current.nameKo + " 개별 페이지로 이동";
        } else {
          b.disabled = true;
          if (b.dataset.id === chosenId) {
            b.classList.add("wrong");
            b.insertAdjacentHTML("afterbegin", '<span class="mark">X</span>');
          }
        }
      });
      showTags();
      updateScore();
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
