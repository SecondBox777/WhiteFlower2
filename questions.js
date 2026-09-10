// Set to 30 to reserve another ten question slots.
export const TOTAL_QUESTIONS = 20;

const imageQuestions = Array.from({ length: 10 }, (_, index) => {
  const id = `Q${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    category: '도형 추론',
    title: '물음표에 들어갈 도형을 고르세요.',
    image: `${id}.webp`,
    imageAlt: `${index + 1}번 도형 추론 문제와 보기 A, B, C, D`,
    options: ['A', 'B', 'C', 'D'],
    placeholder: false,
    // Answer keys and explanations will be supplied separately before scoring.
    answer: null,
    explanation: null,
  };
});

export const questions = [
  ...imageQuestions,
  ...Array.from({ length: TOTAL_QUESTIONS - imageQuestions.length }, (_, index) => ({
    id: `Q${String(imageQuestions.length + index + 1).padStart(2, '0')}`,
    category: '준비 중',
    title: '새로운 문제가 들어갈 자리예요.',
    prompt: '문항 준비 중 · PLACEHOLDER\n아무 보기나 선택하면 다음 단계로 진행할 수 있어요.',
    options: ['A', 'B', 'C', 'D'],
    placeholder: true,
    answer: null,
    explanation: null,
  })),
];
