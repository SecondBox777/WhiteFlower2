// Source: supplied answer workbook and simulation/results.json (synthetic, preliminary).
export const LIMIT_SECONDS = 1800;
export const scoringItems = [
  {
    "answer": "A",
    "points": 2,
    "referenceSeconds": 20
  },
  {
    "answer": "D",
    "points": 2,
    "referenceSeconds": 20
  },
  {
    "answer": "B",
    "points": 2,
    "referenceSeconds": 20
  },
  {
    "answer": "C",
    "points": 3,
    "referenceSeconds": 25
  },
  {
    "answer": "A",
    "points": 3,
    "referenceSeconds": 25
  },
  {
    "answer": "C",
    "points": 4,
    "referenceSeconds": 40
  },
  {
    "answer": "B",
    "points": 3,
    "referenceSeconds": 30
  },
  {
    "answer": "A",
    "points": 4,
    "referenceSeconds": 45
  },
  {
    "answer": "C",
    "points": 5,
    "referenceSeconds": 75
  },
  {
    "answer": "D",
    "points": 5,
    "referenceSeconds": 90
  },
  {
    "answer": "C",
    "points": 2,
    "referenceSeconds": 20
  },
  {
    "answer": "A",
    "points": 2,
    "referenceSeconds": 20
  },
  {
    "answer": "B",
    "points": 2,
    "referenceSeconds": 20
  },
  {
    "answer": "C",
    "points": 2,
    "referenceSeconds": 25
  },
  {
    "answer": "B",
    "points": 2,
    "referenceSeconds": 25
  },
  {
    "answer": "B",
    "points": 4,
    "referenceSeconds": 50
  },
  {
    "answer": "C",
    "points": 5,
    "referenceSeconds": 70
  },
  {
    "answer": "A",
    "points": 5,
    "referenceSeconds": 75
  },
  {
    "answer": "D",
    "points": 5,
    "referenceSeconds": 90
  },
  {
    "answer": "C",
    "points": 5,
    "referenceSeconds": 90
  },
  {
    "answer": "B",
    "points": 3,
    "referenceSeconds": 45
  },
  {
    "answer": "B",
    "points": 2,
    "referenceSeconds": 30
  },
  {
    "answer": "C",
    "points": 3,
    "referenceSeconds": 45
  },
  {
    "answer": "A",
    "points": 3,
    "referenceSeconds": 50
  },
  {
    "answer": "D",
    "points": 3,
    "referenceSeconds": 50
  },
  {
    "answer": "C",
    "points": 4,
    "referenceSeconds": 65
  },
  {
    "answer": "A",
    "points": 4,
    "referenceSeconds": 65
  },
  {
    "answer": "D",
    "points": 4,
    "referenceSeconds": 70
  },
  {
    "answer": "B",
    "points": 4,
    "referenceSeconds": 70
  },
  {
    "answer": "C",
    "points": 3,
    "referenceSeconds": 55
  }
];
export function speedFactor(ratio) {
  if (ratio <= 0.4) return 1;
  if (ratio <= 0.65) return 0.9;
  if (ratio <= 1) return 0.75;
  if (ratio <= 1.5) return 0.5;
  if (ratio <= 2) return 0.25;
  return 0;
}
export function scoreTest(answers, seconds, expiredIndex = null) {
  let score = 0, correct = 0;
  scoringItems.forEach((item, index) => {
    if (index === expiredIndex || answers[index] !== 'ABCD'.indexOf(item.answer)) return;
    correct++;
    score += item.points * (0.8 + 0.2 * speedFactor((seconds[index] ?? 0) / item.referenceSeconds));
  });
  return { score, correct, iq: 79.76334234199149 + 0.6930466663250522 * score };
}
// Monotonic clock: revisits accumulate; time continues while the dialog is closed.
export class TestClock {
  constructor(now) { this.start = now; this.entered = now; this.current = 0; this.seconds = Array(30).fill(0); }
  remaining(now) { return Math.max(0, LIMIT_SECONDS - (now - this.start) / 1000); }
  record(now) {
    const end = Math.min(now, this.start + LIMIT_SECONDS * 1000);
    this.seconds[this.current] += Math.max(0, end - this.entered) / 1000;
    this.entered = end;
  }
  move(index, now) { this.record(now); this.current = index; }
}
