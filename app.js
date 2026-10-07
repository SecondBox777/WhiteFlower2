import { renderReportDocument } from './report-content.js';
import { createReportImages } from './report-export.js';
import { questions } from './questions.js';
import { LIMIT_SECONDS, scoreTest, scoringItems, TestClock } from './scoring.js';

document.querySelectorAll('[data-question-count]').forEach(item => { item.textContent = questions.length; });
document.querySelector('meta[name="description"]').content = `${questions.length}문항, 30분. AI가 측정하는 당신의 IQ는... 합성 모형 기반 테스트.`;

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
let adultConfirmed = false;
let emailController;
let reportLanguage = 'ko';
let reportStatus = '';
let reportData = null;
let imageFiles = null;
let imagePromise = null;
let exportUrls = [];
let exportBusy = false;

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
  render(`<span class="flow-eyebrow">AI IQ TEST · PREVIEW</span><h2 class="flow-title" id="flow-title">AI가 측정하는 당신의 IQ는...</h2><p class="flow-text">도형·논리·공간 추론 30문제에 답해 주세요.<br>AI 기반 분석 모형으로 만든 결과 리포트를 화면에서 확인하고 이메일로도 받아보세요.</p><div class="flow-info">◷ 시작 버튼을 누르면 30분 카운트다운이 시작돼요.<br>↶ 제출 전에는 이전 답변을 바꿀 수 있어요.<br>창을 닫거나 다른 탭으로 이동해도 시간은 계속 흘러요.<br>시간이 끝나면 응답이 자동 제출돼요.</div><button class="button primary full" id="begin">TEST 시작 <span>→</span></button><button class="button secondary full" id="random-submit" style="margin-top:10px">랜덤 답안 제출 · 실험용</button><p class="flow-footnote">실험용 버튼은 30개 답안과 풀이 시간을 자동 생성합니다. 새로고침하면 초기화됩니다.</p>`);
  document.querySelector('#random-submit').onclick = () => {
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
  render(`<span class="flow-eyebrow">TEST COMPLETE</span><h2 class="flow-title center" id="flow-title">AI가 추정하는 당신의 IQ는...</h2><div class="iq-result"><strong id="iq-result">${aiReport ? Math.round(result.iq) : '??'}</strong><small>${aiReport ? 'AI 분석 리포트가 완성되었습니다' : '결과 리포트에서 확인하세요'}</small></div><p class="flow-text center">${experimental ? '실험용 랜덤 답안으로 테스트를 완료했습니다.' : expired ? '제한 시간이 종료되어 테스트를 완료했습니다.' : '테스트를 완료했습니다.'}</p><div class="result-stats"><div><span>총 소요 시간</span><strong>${Math.floor(elapsed / 60)}분 ${elapsed % 60}초</strong></div></div>
  <form id="generate-report-form" class="report-email-form">
    <label class="report-language">리포트 언어 <select id="report-language"><option value="ko">한국어</option><option value="en">English</option></select></label>
    <label class="report-consent adult-confirmation" for="report-adult-confirm"><input id="report-adult-confirm" type="checkbox" required><span><span lang="en">I confirm that I am 18 years of age or older.</span><br>본인은 만 18세 이상임을 확인합니다.</span></label>
    <button class="button primary full" id="generate-report" type="submit" disabled>결과 리포트 받아보기</button>
    <p class="flow-footnote">요청하면 답안·풀이 시간·채점 통계를 OpenAI에 전송해 리포트를 생성합니다. 이메일 주소 없이도 이 화면에서 확인할 수 있습니다.</p>
  </form>
  <div id="report-progress" class="report-progress" role="status" aria-live="polite" aria-atomic="true"><span class="report-spinner" aria-hidden="true" hidden></span><div><strong id="report-progress-title"></strong><p id="report-progress-detail"></p></div></div>
  <section id="completed-report" class="completed-report" hidden aria-label="AI 결과 리포트">
    <article id="ai-report" class="report-document"></article>
    <div class="report-tools"><button class="button secondary" id="save-report-photo" type="button">사진으로 저장</button><button class="button secondary" id="share-report" type="button">공유</button></div>
    <p id="report-export-status" class="flow-footnote" role="status" aria-live="polite"></p><div id="report-downloads" class="report-downloads"></div>
    <div id="share-fallback" hidden><label class="checkout-label" for="share-report-text">공유할 보고서 내용</label><textarea id="share-report-text" readonly rows="8"></textarea></div>
    <form id="email-report-form" class="report-email-form"><h3>이메일로도 받아보세요</h3><label class="checkout-label" for="report-email">결과 리포트를 받을 이메일</label><input class="email-input" id="report-email" type="email" name="email" autocomplete="email" maxlength="254" placeholder="you@example.com" required aria-describedby="email-notice"><button class="button primary full" id="email-report" type="submit">이메일로 리포트 받기</button><p class="flow-footnote" id="email-notice">발송을 요청하면 이메일 주소와 이 화면의 리포트를 Resend에 전달합니다.</p><p id="email-report-status" class="flow-text" role="status" aria-live="polite"></p></form>
  </section><div class="result-actions"><button class="button secondary" id="restart">다시 테스트하기</button><button class="button secondary" id="finish">홈으로</button></div>`);
  setupReportActions();
  document.querySelector('#restart').onclick = () => { reset(); intro(); };
  document.querySelector('#finish').onclick = () => dialog.close();
}
function reset() {
  clearInterval(ticker);
  reportController?.abort(); reportController = null; aiReport = null; reportLoading = false;
  emailController?.abort(); emailController = null; reportEmailToken = null;
  emailLoading = false; emailSent = false; emailAddress = ''; emailStatus = ''; adultConfirmed = false;
  reportLanguage = 'ko'; reportStatus = ''; reportData = null; imageFiles = null; imagePromise = null; exportBusy = false;
  clearExportUrls();
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

function updateReportActions() {
  const button = document.querySelector('#generate-report');
  if (!button) return;
  const busy = reportLoading || emailLoading;
  document.querySelector('#save-report-photo').disabled = REPORTS_PAUSED;
  document.querySelector('#share-report').disabled = REPORTS_PAUSED;
  button.disabled = REPORTS_PAUSED || busy || Boolean(aiReport) || !adultConfirmed;
  button.textContent = reportLoading ? 'AI가 리포트를 생성하고 있습니다…' : aiReport ? '리포트 생성 완료' : '결과 리포트 받아보기';
  document.querySelector('#report-adult-confirm').disabled = busy || Boolean(aiReport);
  document.querySelector('#report-language').disabled = busy || Boolean(aiReport);
  document.querySelector('#generate-report-form').setAttribute('aria-busy', String(reportLoading));
  const progress = document.querySelector('#report-progress');
  progress.hidden = !reportLoading && !aiReport && !reportStatus && !REPORTS_PAUSED;
  progress.classList.toggle('is-loading', reportLoading);
  progress.classList.toggle('is-complete', Boolean(aiReport));
  progress.querySelector('.report-spinner').hidden = !reportLoading;
  document.querySelector('#report-progress-title').textContent = reportLoading ? 'AI가 리포트를 생성하고 있습니다.' : aiReport ? '리포트 생성이 완료되었습니다.' : REPORTS_PAUSED ? '리포트 생성은 잠시 중지되어 있습니다.' : '리포트를 생성하지 못했습니다.';
  document.querySelector('#report-progress-detail').textContent = reportLoading ? '답안과 풀이 시간을 분석하고 있어요. 잠시만 기다려 주세요.' : aiReport ? '아래에서 전체 보고서를 확인하고, 저장하거나 이메일로 받아보세요.' : reportStatus;
  const emailButton = document.querySelector('#email-report');
  emailButton.disabled = REPORTS_PAUSED || busy || emailSent || !adultConfirmed || !reportEmailToken;
  emailButton.textContent = emailLoading ? '이메일을 보내고 있습니다…' : emailSent ? '이메일 발송 요청 완료' : '이메일로 리포트 받기';
  document.querySelector('#report-email').disabled = busy || emailSent;
  document.querySelector('#email-report-form').setAttribute('aria-busy', String(emailLoading));
  document.querySelector('#email-report-status').textContent = emailStatus || (aiReport && !reportEmailToken ? '화면 보고서는 이용할 수 있지만 이메일 발송이 준비되지 않았습니다.' : '');
}
function displayReport() {
  if (!reportData || !document.querySelector('#ai-report')) return;
  const reportDocument = renderReportDocument(reportData);
  // The shared renderer escapes all model-provided text before inserting HTML.
  document.querySelector('#ai-report').innerHTML = new DOMParser().parseFromString(reportDocument.html, 'text/html').querySelector('main').innerHTML;
  document.querySelector('#completed-report').hidden = false;
  document.querySelector('#iq-result').textContent = Math.round(result.iq);
  document.querySelector('.iq-result small').textContent = 'AI 분석 리포트가 완성되었습니다';
}
function setupReportActions() {
  const adultInput = document.querySelector('#report-adult-confirm');
  adultInput.checked = adultConfirmed;
  adultInput.onchange = () => { adultConfirmed = adultInput.checked; updateReportActions(); };
  document.querySelector('#report-language').value = reportLanguage;
  const input = document.querySelector('#report-email');
  input.value = emailAddress;
  input.oninput = () => { emailAddress = input.value; };
  displayReport();
  updateReportActions();
  document.querySelector('#generate-report-form').onsubmit = generateReport;
  document.querySelector('#email-report-form').onsubmit = sendReportEmail;
  document.querySelector('#save-report-photo').onclick = saveReportPhoto;
  document.querySelector('#share-report').onclick = shareReport;
}
async function generateReport(event) {
  event.preventDefault();
  if (REPORTS_PAUSED || reportLoading || emailLoading || aiReport || !adultConfirmed || !document.querySelector('#report-adult-confirm').checked) return;
  reportLanguage = document.querySelector('#report-language').value;
  const controller = new AbortController(); reportController = controller;
  const timeout = setTimeout(() => controller.abort(), 75000);
  reportStatus = ''; reportLoading = true; updateReportActions();
  document.querySelector('#report-progress').scrollIntoView({block:'nearest'});
  try {
    const response = await fetch('/api/analyze', {method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({answers,seconds:clock.seconds,expiredIndex:expired?current:null,language:reportLanguage,consent:true,adultConfirmed,experimental})});
    const data = await response.json().catch(() => ({error:'리포트 생성 응답을 확인할 수 없습니다.'}));
    if (reportController !== controller) return;
    if (!response.ok) throw new Error(data.error || '리포트 생성에 실패했습니다.');
    if (!data.report || !data.result) throw new Error('리포트 형식이 올바르지 않습니다.');
    // Prepare the document before committing the successful state.
    renderReportDocument({report:data.report,result:data.result,language:reportLanguage});
    aiReport = data.report; result = data.result; reportEmailToken = data.emailToken || null;
    reportData = {report:aiReport,result,language:reportLanguage};
    displayReport();
    // Prepare images in advance so native sharing can run directly on the next click.
    prepareReportImages().catch(() => {});
  } catch (error) {
    if (reportController === controller) reportStatus = controller.signal.aborted ? '생성 시간이 길어지고 있습니다. 다시 시도해 주세요.' : error.message;
  } finally {
    clearTimeout(timeout);
    if (reportController === controller) { reportLoading = false; reportController = null; updateReportActions(); }
  }
}
async function sendReportEmail(event) {
  event.preventDefault();
  if (REPORTS_PAUSED || reportLoading || emailLoading || emailSent || !adultConfirmed || !reportEmailToken) return;
  const input = document.querySelector('#report-email');
  if (!input.reportValidity()) return;
  emailAddress = input.value.trim();
  const controller = new AbortController(); emailController = controller;
  const timeout = setTimeout(() => controller.abort(), 25000);
  emailStatus = ''; emailLoading = true; updateReportActions();
  try {
    const response = await fetch('/api/email-report', {method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({email:emailAddress,token:reportEmailToken,consent:true,adultConfirmed})});
    const data = await response.json().catch(() => ({error:'이메일 발송 응답을 확인할 수 없습니다.'}));
    if (emailController !== controller) return;
    if (data.code === 'invalid_report_token') {
      // Keep the report readable and downloadable when its delivery token expires.
      throw new Error('이메일 발송 유효시간이 지났습니다. 화면 보고서는 사진으로 저장하거나 공유할 수 있습니다.');
    }
    if (!response.ok) throw new Error(data.error || '이메일 발송에 실패했습니다.');
    emailSent = true;
    emailStatus = '이메일 발송 요청이 완료되었습니다. 받은편지함과 스팸함을 확인해 주세요.';
  } catch (error) {
    if (emailController === controller) emailStatus = controller.signal.aborted ? '이메일 발송 응답이 지연됩니다. 같은 주소로 다시 시도해 주세요.' : error.message;
  } finally {
    clearTimeout(timeout);
    if (emailController === controller) { emailLoading = false; emailController = null; updateReportActions(); }
  }
}
function clearExportUrls() {
  exportUrls.forEach(url => URL.revokeObjectURL(url)); exportUrls = [];
}
function prepareReportImages() {
  if (!reportData) return Promise.reject(new Error('리포트를 먼저 생성해 주세요.'));
  if (imageFiles) return Promise.resolve(imageFiles);
  if (imagePromise) return imagePromise;
  const source = reportData;
  imagePromise = createReportImages(source).then(files => {
    if (reportData !== source) throw new Error('새로운 테스트가 시작되었습니다.');
    imageFiles = files; return files;
  }).catch(error => { if (reportData === source) imagePromise = null; throw error; });
  return imagePromise;
}
function setExportStatus(message) {
  const status = document.querySelector('#report-export-status');
  if (status) status.textContent = message;
}
async function saveReportPhoto() {
  if (REPORTS_PAUSED || exportBusy || !reportData) return;
  const source = reportData;
  exportBusy = true; setExportStatus('리포트를 사진으로 만들고 있습니다…');
  try {
    const files = await prepareReportImages();
    if (reportData !== source || !document.querySelector('#report-downloads')) return;
    clearExportUrls();
    const downloads = document.querySelector('#report-downloads'); downloads.replaceChildren();
    for (const file of files) {
      const url = URL.createObjectURL(file); exportUrls.push(url);
      const link = document.createElement('a'); link.href = url; link.download = file.name;
      link.textContent = files.length > 1 ? `사진 ${downloads.children.length + 1} 저장` : '사진 다시 저장';
      downloads.append(link);
    }
    downloads.querySelector('a').click();
    setExportStatus(files.length > 1 ? `전체 보고서를 사진 ${files.length}장으로 만들었습니다. 아래 링크에서 각 사진을 저장해 주세요.` : '사진 저장을 시작했습니다. 다운로드한 파일을 확인해 주세요.');
  } catch (error) { if (reportData === source) setExportStatus(error.message); }
  finally { if (reportData === source) exportBusy = false; }
}
async function shareReport() {
  if (REPORTS_PAUSED || exportBusy || !reportData) return;
  const source = reportData;
  const {subject,text} = renderReportDocument(source);
  exportBusy = true;
  try {
    // Do not await image generation here: browsers require a fresh click for native sharing.
    if (navigator.share) {
      const data = imageFiles && navigator.canShare?.({files:imageFiles}) ? {title:subject,files:imageFiles} : {title:subject,text};
      await navigator.share(data);
      if (reportData === source) setExportStatus('공유 요청을 완료했습니다.');
    } else {
      await navigator.clipboard.writeText(text);
      if (reportData === source) setExportStatus('보고서 내용을 복사했습니다. 원하는 앱에 붙여넣어 공유하세요.');
    }
  } catch (error) {
    if (reportData !== source) return;
    if (error.name === 'AbortError') { setExportStatus('공유를 취소했습니다.'); return; }
    // Clipboard permissions and native sharing vary; always provide a selectable fallback.
    const fallback = document.querySelector('#share-fallback');
    if (fallback) {
      fallback.hidden = false;
      const input = document.querySelector('#share-report-text'); input.value = text; input.focus(); input.select();
      setExportStatus('아래 보고서 내용을 복사해서 공유하세요. 사진으로 저장해 공유할 수도 있습니다.');
    }
  } finally { if (reportData === source) exportBusy = false; }
}
