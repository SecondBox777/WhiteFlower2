import { questions } from './questions.js';

document.querySelectorAll('[data-question-count]').forEach(item => { item.textContent = questions.length; });
document.querySelector('meta[name="description"]').content = `${questions.length}개의 질문으로 발견하는 나의 사고 패턴. Mindscope 인지 능력 탐색 테스트.`;

const dialog = document.querySelector('#flow-dialog');
const content = document.querySelector('#flow-content');
let answers = Array(questions.length).fill(null);
let current = 0;
let stage = 'intro';
let lastTrigger;

// Keep decoded images alive for subsequent questions and backward navigation.
const preloadedImages = new Map();
function preloadQuestions(start, count = 2) {
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
  content.innerHTML = markup;
  dialog.scrollTop = 0;
  const title = content.querySelector('#flow-title');
  if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
}

function intro() {
  stage = 'intro';
  preloadQuestions(0, 3);
  render(`<span class="flow-eyebrow">MEET YOUR MIND</span><h2 class="flow-title" id="flow-title">잠깐의 집중, 새로운 발견.</h2><p class="flow-text">편안한 마음으로 ${questions.length}개의 질문에 답해 주세요.<br>가장 적절하다고 생각하는 답을 하나씩 선택하면 됩니다.</p><div class="flow-info">◷ 권장 시간 약 15분 · 시간 제한 없음<br>◇ 도형 추론 10문항 · 임시 문항 ${questions.filter(q => q.placeholder).length}개<br>↶ 제출 전에는 이전 답변을 바꿀 수 있어요.</div><p class="flow-text">이 테스트는 표준화된 IQ 검사가 아닌 참고용 예시입니다. 테스트는 무료이며, 상세 리포트 구매 단계는 데모로 체험할 수 있습니다.</p><button class="button primary full" id="begin">준비됐어요, 시작하기 <span>→</span></button><p class="flow-footnote">응답은 이 페이지에서만 유지됩니다. 새로고침하면 초기화됩니다.</p>`);
  document.querySelector('#begin').onclick = () => { stage = 'test'; question(); };
}

function question() {
  const q = questions[current];
  preloadQuestions(current + 1);
  render(`<div class="progress-top"><span>${q.category}</span><span>${String(current + 1).padStart(2, '0')} <span aria-hidden="true">/</span> ${questions.length}</span></div><div class="progress-track" role="progressbar" aria-label="문항 진행률" aria-valuenow="${current + 1}" aria-valuemin="0" aria-valuemax="${questions.length}"><span style="width:${(current + 1) / questions.length * 100}%"></span></div><span class="flow-eyebrow">QUESTION ${String(current + 1).padStart(2, '0')}</span><h2 class="flow-title" id="flow-title">${q.title}</h2>${q.prompt ? `<div class="question-prompt">${q.prompt}</div>` : ''}${q.image ? `<a class="question-image-link" href="${q.image}" target="_blank" rel="noopener" aria-label="${q.imageAlt} 크게 보기 (새 탭)"><img class="question-image" decoding="async" fetchpriority="high" src="${q.image}" alt="${q.imageAlt}" width="1254" height="1254"><span>문제 크게 보기 ↗</span></a><p class="flow-footnote">이미지 아래의 보기 A~D 중 하나를 선택해 주세요.</p>` : ''}<div class="answers" role="group" aria-labelledby="flow-title">${q.options.map((option, i) => `<button class="answer ${answers[current] === i ? 'selected' : ''}" data-answer="${i}" aria-pressed="${answers[current] === i}"><span>${option}</span>보기 ${option}</button>`).join('')}</div><div class="flow-actions"><button class="button secondary" id="previous" ${current === 0 ? 'disabled' : ''}>← 이전 문항</button><button class="button primary" id="next" ${answers[current] === null ? 'disabled' : ''}>${current === questions.length - 1 ? '테스트 완료' : '다음 문항'} <span>→</span></button></div><p class="flow-footnote">정답을 모르겠다면 가장 가까운 답을 선택해 주세요.</p>`);
  content.querySelectorAll('[data-answer]').forEach(button => {
    button.onclick = () => {
      answers[current] = Number(button.dataset.answer);
      content.querySelectorAll('[data-answer]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
      document.querySelector('#next').disabled = false;
    };
  });
  document.querySelector('#previous').onclick = () => { if (current > 0) { current--; question(); } };
  document.querySelector('#next').onclick = () => {
    if (answers[current] === null) return;
    if (current < questions.length - 1) { current++; question(); }
    else { stage = 'checkout'; checkout(); }
  };
}

function checkout() {
  render(`<span class="demo-label">DEMO · 실제 결제 없음</span><div class="success-icon">✓</div><h2 class="flow-title center" id="flow-title">${questions.length}개의 질문, 모두 완료했어요!</h2><p class="flow-text center">수고하셨습니다. 이제 나의 사고 패턴을<br>상세 리포트로 알아볼 차례예요.</p><div class="order-row"><span>영역별 분석 · 전체 문항 해설</span><span>상세 리포트 1부</span></div><div class="order-row total"><span>결제 예정 금액</span><span>₩4,900</span></div><form id="checkout-form"><label class="checkout-label" for="email">리포트를 받을 이메일</label><input class="email-input" id="email" name="email" type="email" placeholder="you@example.com" autocomplete="email" maxlength="254" required aria-describedby="email-help"><p class="flow-text" id="email-help" style="font-size:11px">데모에서는 이메일을 저장하거나 발송하지 않습니다. 예시 주소를 사용해도 됩니다.</p><label class="consent"><input type="checkbox" required><span>참고용 테스트이며, 현재 단계는 실제 결제·이메일 발송이 없는 데모임을 확인했습니다.</span></label><button class="button primary full" type="submit">결제 흐름 체험하기 <span>→</span></button></form><button class="button secondary full" id="review" style="margin-top:10px">응답 다시 확인하기</button><p class="flow-footnote">정식 서비스에서는 결제 확인 후에만 이메일로 분석지가 발송됩니다.</p>`);
  document.querySelector('#review').onclick = () => { stage = 'test'; question(); };
  document.querySelector('#checkout-form').onsubmit = event => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email').trim();
    stage = 'done';
    render(`<span class="demo-label">DEMO COMPLETE</span><div class="success-icon">✉</div><h2 class="flow-title center" id="flow-title">리포트를 받기까지,<br>모든 단계를 체험했어요.</h2><p class="flow-text center">입력한 이메일<br><span class="email-highlight" id="submitted-email"></span></p><div class="flow-info">현재는 프로토타입입니다. 요금은 청구되지 않았으며 이메일도 발송되지 않았습니다.<br><br>정식 서비스에서는 결제 확인 → 응답 분석 → 리포트 생성 → 이메일 발송 순서로 처리됩니다.</div><button class="button primary full" id="finish">홈으로 돌아가기 <span>↗</span></button><p class="flow-footnote">창을 닫으면 입력한 이메일은 화면에서 삭제됩니다.</p>`);
    document.querySelector('#submitted-email').textContent = email;
    document.querySelector('#finish').onclick = () => dialog.close();
  };
}

document.querySelectorAll('[data-start]').forEach(button => {
  button.onclick = () => {
    lastTrigger = button;
    dialog.showModal();
    if (stage === 'test') question();
    else if (stage === 'checkout') checkout();
    else { answers = Array(questions.length).fill(null); current = 0; intro(); }
  };
});
document.querySelector('#close-dialog').onclick = () => dialog.close();
dialog.addEventListener('close', () => { content.replaceChildren(); lastTrigger?.focus(); });
