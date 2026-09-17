/**
 * 오행 점수
 *
 * 글자를 세기만 하지 않고 자리마다 무게를 다르게 준다.
 * 특히 월지(월주의 지지)는 태어난 계절이라 가장 강하게 친다 — 이걸 월령(月令)이라 한다.
 */

import { BRANCH, type Element, ELEMENTS, GENERATED_BY, STEM, type Stem } from '@/data/tables';

import type { Pillar } from './pillars';

export type ElementScores = Record<Element, number>;

const STEM_WEIGHT = 10;
const BRANCH_WEIGHT = 7;
/** 지장간은 본기 → 중기 → 여기 순으로 약해진다 */
const HIDDEN_WEIGHT = [5, 2.5, 1.5] as const;
/** 월령 가산 */
const MONTH_BONUS = 12;

const emptyScores = (): ElementScores => ({ 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 });

export function rawElementScores(pillars: Pillar[]): ElementScores {
  const score = emptyScores();
  for (const p of pillars) {
    score[STEM[p.stem].element] += STEM_WEIGHT;

    const branch = BRANCH[p.branch];
    score[branch.element] += BRANCH_WEIGHT;
    branch.hidden.forEach((h, i) => {
      score[STEM[h].element] += HIDDEN_WEIGHT[i] ?? 1;
    });

    if (p.label === '월주') score[branch.element] += MONTH_BONUS;
  }
  return score;
}

/** 합이 정확히 100이 되는 백분율. 반올림 잔차는 가장 강한 오행이 흡수한다. */
export function toPercent(raw: ElementScores): ElementScores {
  const total = ELEMENTS.reduce((sum, e) => sum + raw[e], 0);
  if (total === 0) return emptyScores();

  const pct = emptyScores();
  for (const e of ELEMENTS) pct[e] = Math.round((raw[e] / total) * 100);

  const drift = 100 - ELEMENTS.reduce((sum, e) => sum + pct[e], 0);
  if (drift !== 0) pct[strongestElement(pct)] += drift;
  return pct;
}

export function elementPercent(pillars: Pillar[]): ElementScores {
  return toPercent(rawElementScores(pillars));
}

/** 동점이면 목→화→토→금→수 순으로 앞선 것 */
export function strongestElement(scores: ElementScores): Element {
  return ELEMENTS.reduce((best, e) => (scores[e] > scores[best] ? e : best), ELEMENTS[0]);
}

export function weakestElement(scores: ElementScores): Element {
  return ELEMENTS.reduce((worst, e) => (scores[e] < scores[worst] ? e : worst), ELEMENTS[0]);
}

export interface DayStrength {
  mode: 'strong' | 'weak';
  /** 일간 오행 + 그걸 생해주는 오행의 합(%) */
  support: number;
  label: string;
}

/**
 * 신강·신약.
 * 나 자신(일간 오행)과 나를 받쳐주는 오행(인성)이 얼마나 되는지로 본다.
 */
export function dayStrength(dayStem: Stem, percent: ElementScores): DayStrength {
  const self = STEM[dayStem].element;
  const support = percent[self] + percent[GENERATED_BY[self]];

  if (support >= 56) return { mode: 'strong', support, label: '주관이 확고함' };
  if (support >= 45) return { mode: 'strong', support, label: '스스로의 중심이 강함' };
  if (support >= 34) return { mode: 'weak', support, label: '상황 변화에 민감함' };
  return { mode: 'weak', support, label: '주변 영향을 크게 받음' };
}
