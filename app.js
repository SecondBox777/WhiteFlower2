import { questions } from './questions.js';
import { LIMIT_SECONDS, scoreTest, TestClock } from './scoring.js';

document.querySelectorAll('[data-question-count]').forEach(item => { item.textContent = questions.length; });
document.querySelector('meta[name="description"]').content = `${questions.length}문항, 30분. AI가 측정하는 당신의 IQ는... 합성 모형 기반 테스트.`;

const dialog = document.querySelector('#flow-dialog');
const content = document.querySelector('#flow-content');
let answers = Array(questions.length).fill(null);
let current = 0;
let stage = 'intro';
let lastTrigger;
let clock;
let ticker;
let result;
let expired = false;

// Keep decoded images alive for subsequent questions and backward navigation.
const preloadedImages = new Map();
function preloadQuestions(start, count = 4) {
  for (const q of questions.slice(start, start + count)) {
    if (!q.image || preloadedImages.has(q.image)) continue;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = start === 0 ? 'auto' : 'low';
    preloadedImages.set(q.image, image);
    image.onerror = () => preloadedImages.delete(q.image);
    image.src = q.image;
    // Decode in advance without blocking answer selection or navigation.
    image.decode().catch(() => {});
  }
}
preloadQuestions(0, 1);

function render(markup) {
  dialog.classList.toggle('testing', stage === 'test');
  content.innerHTML = markup;
  dialog.scrollTop = 0;
  const title = content.querySelector('#flow-title');
  if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
}

function intro() {
  stage = 'intro';
  preloadQuestions(0, 4);
  render(`<span class="flow-eyebrow">AI IQ TEST · PREVIEW</span><h2 class="flow-title" id="flow-title">AI가 측정하는 당신의 IQ는...</h2><p class="flow-text">도형·논리·공간 추론 30문제에 답해 주세요.<br>AI 기반 분석 모형으로 당신의 IQ 추정값을 바로 확인합니다.</p><div class="flow-info">◷ 시작 버튼을 누르면 30분 카운트다운이 시작돼요.<br>↶ 제출 전에는 이전 답변을 바꿀 수 있어요.<br>창을 닫거나 다른 탭으로 이동해도 시간은 계속 흘러요.<br>시간이 끝나면 응답이 자동 제출돼요.</div><button class="button primary full" id="begin">TEST 시작 <span>→</span></button><p class="flow-footnote">새로고침하면 응답과 시간이 초기화됩니다.</p>`);
  document.querySelector('#begin').onclick = () => {
    clock = new TestClock(performance.now());
    stage = 'test';
    ticker = setInterval(updateTimer, 100);
    question();
  };
}
function updateTimer() {
  if (stage !== 'test') return;
  const remaining = clock.remaining(performance.now());
  if (remaining <= 0) { finish(true); return; }
  const label = content.querySelector('#time-left');
  const bar = content.querySelector('#time-bar');
  if (label) {
    const seconds = Math.ceil(remaining);
    label.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    bar.style.width = `${remaining / LIMIT_SECONDS * 100}%`;
    bar.parentElement.setAttribute('aria-valuenow', String(Math.ceil(remaining)));
    bar.parentElement.classList.toggle('urgent', remaining <= 300);
  }
}
function finish(timedOut = false) {
  if (stage !== 'test') return;
  clock.record(performance.now());
  expired = timedOut;
  result = scoreTest(answers, clock.seconds, timedOut ? current : null);
  clearInterval(ticker);
  stage = 'done';
  if (dialog.open) showResult();
}
function showResult() {
  const elapsed = Math.round(clock.seconds.reduce((a, b) => a + b, 0));
  render(`<span class="demo-label">TEST RESULT · 합성 모형 기반</span><h2 class="flow-title center" id="flow-title">AI가 측정하는 당신의 IQ는...</h2><div class="iq-result"><span>예비 IQ 추정값</span><strong id="iq-result">${Math.round(result.iq)}</strong><small>합성 모집단의 선형 회귀 추정</small></div><p class="flow-text center">${expired ? '30분이 종료되어 자동 제출되었습니다. 제한에 도달한 문항과 미응답은 0점 처리했습니다.' : '테스트를 완료했습니다.'}</p><div class="result-stats"><div><span>시간 보정 점수</span><strong id="score-result">${result.score.toFixed(2)} / 100</strong></div><div><span>정답 문항</span><strong>${result.correct} / 30</strong></div><div><span>총 소요 시간</span><strong>${Math.floor(elapsed / 60)}분 ${elapsed % 60}초</strong></div></div><div class="flow-info">이 값은 실제 응시자 실험으로 검증되지 않은, AI에 의한 합성·예비 모형의 추정값입니다. 공인 IQ나 개인의 지능을 확정하는 값으로 해석할 수 없습니다.${result.score < 10 || result.score > 95 ? '<br>극단 점수에서는 선형 근사의 해석이 특히 제한됩니다.' : ''}</div><button class="button primary full" id="restart">다시 테스트하기 <span>↻</span></button><button class="button secondary full" id="finish" style="margin-top:10px">홈으로 돌아가기</button>`);
  document.querySelector('#restart').onclick = () => { reset(); intro(); };
  document.querySelector('#finish').onclick = () => dialog.close();
}
function reset() {
  clearInterval(ticker);
  answers = Array(questions.length).fill(null);
  current = 0; clock = null; result = null; expired = false;
}

function question() {
  if (clock.remaining(performance.now()) <= 0) { finish(true); return; }
  const q = questions[current];
  preloadQuestions(current + 1);
  render(`<div class="test-timer"><div class="timer-label"><span>남은 시간</span><strong id="time-left">30:00</strong></div><div class="time-track" role="progressbar" aria-label="남은 테스트 시간 (초)" aria-valuemin="0" aria-valuemax="1800" aria-valuenow="1800"><span id="time-bar"></span></div></div><div class="progress-top"><span>${q.category}</span><span>${String(current + 1).padStart(2, '0')} <span aria-hidden="true">/</span> ${questions.length}</span></div><div class="progress-track" role="progressbar" aria-label="문항 진행률" aria-valuenow="${current + 1}" aria-valuemin="0" aria-valuemax="${questions.length}"><span style="width:${(current + 1) / questions.length * 100}%"></span></div><span class="flow-eyebrow">QUESTION ${String(current + 1).padStart(2, '0')}</span><h2 class="flow-title" id="flow-title">${q.title}</h2>${q.prompt ? `<div class="question-prompt">${q.prompt}</div>` : ''}${q.image ? `<a class="question-image-link" href="${q.image}" target="_blank" rel="noopener" aria-label="${q.imageAlt} 크게 보기 (새 탭)"><img class="question-image" decoding="async" fetchpriority="high" src="${q.image}" alt="${q.imageAlt}" width="1254" height="1254"><span>문제 크게 보기 ↗</span></a><p class="flow-footnote">이미지 아래의 보기 A~D 중 하나를 선택해 주세요.</p>` : ''}<div class="answers" role="group" aria-labelledby="flow-title">${q.options.map((option, i) => `<button class="answer ${answers[current] === i ? 'selected' : ''}" data-answer="${i}" aria-pressed="${answers[current] === i}"><span>${option}</span>보기 ${option}</button>`).join('')}</div><div class="flow-actions"><button class="button secondary" id="previous" ${current === 0 ? 'disabled' : ''}>← 이전 문항</button><button class="button primary" id="next" ${answers[current] === null ? 'disabled' : ''}>${current === questions.length - 1 ? '테스트 완료' : '다음 문항'} <span>→</span></button></div><p class="flow-footnote">정답을 모르겠다면 가장 가까운 답을 선택해 주세요.</p>`);
  content.querySelectorAll('[data-answer]').forEach(button => {
    button.onclick = () => {
      if (clock.remaining(performance.now()) <= 0) { finish(true); return; }
      answers[current] = Number(button.dataset.answer);
      content.querySelectorAll('[data-answer]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
      document.querySelector('#next').disabled = false;
    };
  });
  updateTimer();
  document.querySelector('#previous').onclick = () => {
    if (clock.remaining(performance.now()) <= 0) { finish(true); return; }
    if (current > 0) { clock.move(current - 1, performance.now()); current--; question(); }
  };
  document.querySelector('#next').onclick = () => {
    if (clock.remaining(performance.now()) <= 0) { finish(true); return; }
    if (answers[current] === null) return;
    if (current < questions.length - 1) { clock.move(current + 1, performance.now()); current++; question(); }
    else finish();
  };
}

document.querySelectorAll('[data-start]').forEach(button => {
  button.onclick = () => {
    lastTrigger = button;
    dialog.showModal();
    if (stage === 'test') question();
    else if (stage === 'done') showResult();
    else { reset(); intro(); }
  };
});
document.querySelector('#close-dialog').onclick = () => dialog.close();
dialog.addEventListener('close', () => { content.replaceChildren(); lastTrigger?.focus(); });

document.addEventListener('visibilitychange', updateTimer);
