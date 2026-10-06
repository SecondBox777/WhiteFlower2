import { questions } from './questions.js';
import { LIMIT_SECONDS, scoreTest, scoringItems, TestClock } from './scoring.js';

document.querySelectorAll('[data-question-count]').forEach(item => { item.textContent = questions.length; });
document.querySelector('meta[name="description"]').content = `${questions.length}문항, 30분. 성인용 퍼즐 연습. 점수는 이 퍼즐에서의 수행만 나타냅니다.`;

// Temporary pause; set false together with wrangler.jsonc TESTING_PAUSED to resume.
const TESTING_PAUSED = false;
// Set false together with wrangler.jsonc REPORTS_PAUSED to resume reports.
const REPORTS_PAUSED = false;

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
let experimental = false;
let aiReport = null;
let reportLoading = false;
let reportController;
let reportEmailToken = null;
let emailLoading = false;
let emailSent = false;
let emailAddress = '';
let emailStatus = '';
let emailController;

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
  render(`<span class="flow-eyebrow">PUZZLE PRACTICE · ADULTS ONLY</span><h2 class="flow-title" id="flow-title">도형·논리 퍼즐 연습</h2><p class="flow-text">도형·논리·공간 추론 30문제에 답해 주세요.<br>AI 기반 분석 모형으로 만든 결과 리포트를 이메일로 받아보세요.</p><div class="flow-info">◷ 시작 버튼을 누르면 30분 카운트다운이 시작돼요.<br>↶ 제출 전에는 이전 답변을 바꿀 수 있어요.<br>창을 닫거나 다른 탭으로 이동해도 시간은 계속 흘러요.<br>시간이 끝나면 응답이 자동 제출돼요.</div><label class="flow-footnote"><input type="checkbox" id="adult-confirm"> 만 18세 이상이며 거주 지역의 성년 기준을 충족합니다.</label><button class="button primary full" id="begin">TEST 시작 <span>→</span></button><button class="button secondary full" id="random-submit" style="margin-top:10px">랜덤 답안 제출 · 실험용</button><p class="flow-footnote">실험용 버튼은 30개 답안과 풀이 시간을 자동 생성합니다. 새로고침하면 초기화됩니다.</p>`);
  document.querySelector('#random-submit').onclick = () => {
    if (!document.querySelector("#adult-confirm").checked) return;
    reset();
    experimental = true;
    answers = questions.map(() => Math.floor(Math.random() * 4));
    clock = new TestClock(performance.now());
    clock.seconds = scoringItems.map(item => Math.round(item.referenceSeconds * (0.6 + Math.random() * 0.8) * 10) / 10);
    const total = clock.seconds.reduce((sum, seconds) => sum + seconds, 0);
    if (total > LIMIT_SECONDS * 0.9) {
      clock.seconds = clock.seconds.map(seconds => Math.floor(seconds * LIMIT_SECONDS * 0.9 / total * 10) / 10);
    }
    result = scoreTest(answers, clock.seconds);
    stage = 'done';
    showResult();
  };
  document.querySelector('#begin').onclick = () => {
    if (!document.querySelector('#adult-confirm').checked) { document.querySelector('#adult-confirm').focus(); return; }
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
  render(`<span class="flow-eyebrow">TEST COMPLETE</span><h2 class="flow-title center" id="flow-title">퍼즐 풀이를 완료했습니다</h2><div class="iq-result"><strong id="iq-result">${result.score.toFixed(1)}</strong><small>퍼즐 점수 / 100 · 지능 측정값이 아닙니다</small></div><p class="flow-text center">${experimental ? '실험용 랜덤 답안으로 테스트를 완료했습니다.' : expired ? '제한 시간이 종료되어 테스트를 완료했습니다.' : '테스트를 완료했습니다.'}</p><div class="result-stats"><div><span>총 소요 시간</span><strong>${Math.floor(elapsed / 60)}분 ${elapsed % 60}초</strong></div></div><form id="email-report-form" class="report-email-form"><label class="checkout-label" for="report-email">결과 리포트를 받을 이메일</label><input class="email-input" id="report-email" type="email" name="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required aria-describedby="email-notice"><label class="flow-footnote"><input id="data-consent" type="checkbox" required> 답안·풀이시간·점수의 OpenAI 전송 및 이메일 주소·리포트의 Resend 전송에 동의합니다.</label><button class="button primary full" id="email-report" type="submit">결과 리포트 받아보기</button><p class="flow-footnote" id="email-notice">이메일 주소를 확인해 주세요. 전송 실패 시 안내에 따라 다시 시도할 수 있습니다.<br>발송 시 이메일 주소와 리포트를 이메일 발송 서비스에 전달합니다.</p><label class="report-language">리포트 언어 <select id="report-language"><option value="ko">한국어</option><option value="en">English</option></select></label><p id="email-report-status" class="flow-text" role="status" aria-live="polite"></p></form><div class="result-actions"><button class="button secondary" id="restart">다시 테스트하기</button><button class="button secondary" id="finish">홈으로</button></div>`);
  setupReportEmail();
  document.querySelector('#restart').onclick = () => { reset(); intro(); };
  document.querySelector('#finish').onclick = () => dialog.close();
}
function reset() {
  clearInterval(ticker);
  reportController?.abort(); reportController = null; aiReport = null; reportLoading = false;
  emailController?.abort(); emailController = null; reportEmailToken = null;
  emailLoading = false; emailSent = false; emailAddress = ''; emailStatus = '';
  answers = Array(questions.length).fill(null);
  current = 0; clock = null; result = null; expired = false; experimental = false;
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
  if (TESTING_PAUSED) {
    button.disabled = true;
    button.textContent = '테스트 일시 중지';
    button.title = '테스트는 잠시 쉬고 있습니다.';
  }
  button.onclick = () => {
    if (TESTING_PAUSED) return;
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

function updateReportEmail() {
  const button = document.querySelector('#email-report');
  if (!button) return;
  const busy = reportLoading || emailLoading;
  button.disabled = REPORTS_PAUSED || busy || emailSent;
  button.textContent = reportLoading ? '리포트를 작성하고 있습니다…' : emailLoading ? '이메일을 보내고 있습니다…' : emailSent ? '이메일 발송 요청 완료' : '결과 리포트 받아보기';
  document.querySelector('#report-email').disabled = busy || emailSent;
  document.querySelector('#report-language').disabled = busy || Boolean(reportEmailToken) || emailSent;
  document.querySelector('#email-report-form').setAttribute('aria-busy', String(busy));
  document.querySelector('#email-report-status').textContent = REPORTS_PAUSED ? '리포트 발송은 잠시 중지되어 있습니다.' : emailStatus;
}
function setupReportEmail() {
  const input = document.querySelector('#report-email');
  input.value = emailAddress;
  input.oninput = () => { emailAddress = input.value; };
  updateReportEmail();
  document.querySelector('#email-report-form').onsubmit = async event => {
    event.preventDefault();
    if (REPORTS_PAUSED || reportLoading || emailLoading || emailSent) return;
    const activeInput = document.querySelector('#report-email');
    if (!activeInput.reportValidity() || !document.querySelector("#data-consent").reportValidity()) return;
    emailAddress = activeInput.value.trim();
    const language = document.querySelector('#report-language').value;
    const controller = new AbortController(); emailController = controller;
    emailStatus = '';
    try {
      if (!reportEmailToken) {
        reportLoading = true; updateReportEmail();
        const response = await fetch('/api/analyze', {method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({answers,seconds:clock.seconds,expiredIndex:expired?current:null,language,adultConfirmed:true,consent:true,experimental})});
        const data = await response.json().catch(() => ({error:'리포트 생성 응답을 확인할 수 없습니다.'}));
        if (emailController !== controller) return;
        if (!response.ok) throw new Error(data.error || '리포트 생성에 실패했습니다.');
        if (!data.report || !data.result) throw new Error('리포트 형식이 올바르지 않습니다.');
        if (!data.emailToken) throw new Error('이메일 발송 설정이 준비되지 않았습니다. 관리자에게 문의해 주세요.');
        aiReport = data.report; reportEmailToken = data.emailToken;
        reportLoading = false;
      }
      emailLoading = true; updateReportEmail();
      const response = await fetch('/api/email-report', {method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({email:emailAddress,token:reportEmailToken,consent:true})});
      const data = await response.json().catch(() => ({error:'이메일 발송 응답을 확인할 수 없습니다.'}));
      if (emailController !== controller) return;
      if (data.code === 'invalid_report_token') { reportEmailToken = null; aiReport = null; }
      if (!response.ok) throw new Error(data.error || '이메일 발송에 실패했습니다.');
      emailSent = true;
      emailStatus = '발송 요청이 접수되었습니다. 받은편지함과 스팸함을 확인해 주세요.';
    } catch (error) {
      if (emailController === controller && !controller.signal.aborted) emailStatus = error.message;
    } finally {
      if (emailController === controller) { reportLoading = false; emailLoading = false; updateReportEmail(); }
    }
  };
}
