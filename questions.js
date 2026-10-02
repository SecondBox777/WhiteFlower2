export const TOTAL_QUESTIONS = 30;

export const questions = Array.from({ length: TOTAL_QUESTIONS }, (_, index) => {
  const id = `Q${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    category: index < 10 ? '도형 추론' : index < 20 ? '논리 추론' : '공간 추론',
    title: '물음표에 들어갈 도형을 고르세요.',
    image: `${id}.webp`,
    imageAlt: `${index + 1}번 ${index < 10 ? '도형 추론' : index < 20 ? '논리 추론' : '공간 추론'} 문제와 보기 A, B, C, D`,
    options: ['A', 'B', 'C', 'D'],
    placeholder: false,
    // Answer keys and explanations will be supplied separately before scoring.
    answer: null,
    explanation: null,
  };
});
