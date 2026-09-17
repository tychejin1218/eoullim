/**
 * 1:1 궁합
 *
 * 세 가지를 보고 100점으로 합친다.
 *   일간 대 일간 (40) — 기본 결이 맞는가
 *   일지 대 일지 (35) — 같이 있을 때 편한가
 *   오행 상호보완 (25) — 서로의 빈 곳을 채워주는가
 *
 * 점수가 낮은 조합도 30점 아래로는 내려가지 않는다(SCORE_WEIGHT.floor).
 * 동료끼리 돌려보는 도구라서, 숫자가 낙인이 되면 안 된다.
 */

import { type BranchPairKey, DAY_BRANCH_PAIR, DAY_STEM_PAIR, ELEMENT_COMPLEMENT, SCORE_BAND, SCORE_WEIGHT, type StemPairKey } from '@/data/corpus';
import { type Branch, CONTROLS, type Element, GENERATES, STEM, type Stem } from '@/data/tables';

import { elementPercent, type ElementScores, weakestElement } from './elements';
import { fillNames } from './korean';
import type { Chart } from './pillars';

type Pair = readonly [Branch, Branch];

/** 천간합 — 전부 상극 관계 위에 성립하므로 상극보다 먼저 본다 */
const STEM_HARMONY: readonly (readonly [Stem, Stem])[] = [
  ['甲', '己'],
  ['乙', '庚'],
  ['丙', '辛'],
  ['丁', '壬'],
  ['戊', '癸'],
];

const SIX_HARMONY: readonly Pair[] = [
  ['子', '丑'],
  ['寅', '亥'],
  ['卯', '戌'],
  ['辰', '酉'],
  ['巳', '申'],
  ['午', '未'],
];

const CLASH: readonly Pair[] = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥'],
];

const PUNISH: readonly Pair[] = [
  ['寅', '巳'],
  ['巳', '申'],
  ['寅', '申'], // 인사신 삼형
  ['丑', '戌'],
  ['戌', '未'],
  ['丑', '未'], // 축술미 삼형
  ['子', '卯'], // 자묘 상형
];

/** 같은 글자가 겹칠 때만 성립하는 자형 */
const SELF_PUNISH: readonly Branch[] = ['辰', '午', '酉', '亥'];

const HARM: readonly Pair[] = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌'],
];

/** 삼합 조와 그 왕지(旺支). 두 글자만으로 반합이 되려면 왕지가 끼어야 한다. */
const TRIADS: readonly { members: readonly Branch[]; king: Branch }[] = [
  { members: ['申', '子', '辰'], king: '子' },
  { members: ['亥', '卯', '未'], king: '卯' },
  { members: ['寅', '午', '戌'], king: '午' },
  { members: ['巳', '酉', '丑'], king: '酉' },
];

function inPairs(pairs: readonly Pair[], x: Branch, y: Branch): boolean {
  return pairs.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
}

/**
 * 두 일간의 관계.
 * '생'과 '극'은 방향이 있어서, 주는 쪽/누르는 쪽을 giver로 돌려준다.
 */
export function resolveStemPair(a: Stem, b: Stem): { key: StemPairKey; swap: boolean } {
  if (STEM_HARMONY.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) {
    return { key: '합', swap: false };
  }

  const ea = STEM[a].element;
  const eb = STEM[b].element;

  if (ea === eb) {
    return {
      key: STEM[a].polarity === STEM[b].polarity ? '비화_동일' : '비화_상반',
      swap: false,
    };
  }
  // a가 b를 낳는다 → a가 주는 쪽
  if (GENERATES[ea] === eb) return { key: '생', swap: false };
  if (GENERATES[eb] === ea) return { key: '생', swap: true };
  // a가 b를 누른다 → a가 조이는 쪽
  if (CONTROLS[ea] === eb) return { key: '극', swap: false };
  return { key: '극', swap: true };
}

/**
 * 두 일지의 관계.
 *
 * 한 쌍이 두 관계에 동시에 걸리는 경우가 있다(巳申은 육합이자 삼형, 丑未는 충이자 형).
 * 협업 도구라 관계가 겹치면 덜 날 선 쪽을 택한다: 육합 > 반합 > 충 > 형 > 해.
 */
export function resolveBranchPair(a: Branch, b: Branch): BranchPairKey {
  if (inPairs(SIX_HARMONY, a, b)) return '육합';

  const halfTriad = TRIADS.some((t) => a !== b && t.members.includes(a) && t.members.includes(b) && (a === t.king || b === t.king));
  if (halfTriad) return '반합';

  if (inPairs(CLASH, a, b)) return '충';
  if (a === b && SELF_PUNISH.includes(a)) return '형';
  if (inPairs(PUNISH, a, b)) return '형';
  if (inPairs(HARM, a, b)) return '해';
  return '무관';
}

/** 상대가 내 최약 오행을 이만큼 가지고 있으면 "채워준다"고 본다 */
const COMPLEMENT_FULL = 25;
/** 이 밑이면 보완 문장을 붙이지 않는다 */
const COMPLEMENT_MENTION = 15;

export interface ComplementNote {
  /** 부족한 쪽 */
  lacking: string;
  /** 채워주는 쪽 */
  filler: string;
  element: Element;
  text: string;
}

export interface Compatibility {
  a: string;
  b: string;
  /** 30 ~ 100 */
  score: number;
  band: string;
  stem: {
    key: StemPairKey;
    label: string;
    text: string;
    tip: string;
    score: number;
  };
  branch: {
    key: BranchPairKey;
    label: string;
    text: string;
    tip: string;
    score: number;
  };
  complement: {
    score: number;
    notes: ComplementNote[];
  };
}

const fill = fillNames;

function bandOf(score: number): string {
  return SCORE_BAND.find((b) => score >= b.min)?.label ?? SCORE_BAND[SCORE_BAND.length - 1]!.label;
}

function complementOf(a: Chart, aPct: ElementScores, b: Chart, bPct: ElementScores): { score: number; notes: ComplementNote[] } {
  const aWeak = weakestElement(aPct);
  const bWeak = weakestElement(bPct);

  const ratio = (have: number) => Math.min(1, Math.max(0, have / COMPLEMENT_FULL));
  const score = SCORE_WEIGHT.complement * ((ratio(bPct[aWeak]) + ratio(aPct[bWeak])) / 2);

  const notes: ComplementNote[] = [];
  if (bPct[aWeak] >= COMPLEMENT_MENTION) {
    notes.push({
      lacking: a.name,
      filler: b.name,
      element: aWeak,
      text: fill(ELEMENT_COMPLEMENT[aWeak], a.name, b.name),
    });
  }
  if (aPct[bWeak] >= COMPLEMENT_MENTION) {
    notes.push({
      lacking: b.name,
      filler: a.name,
      element: bWeak,
      text: fill(ELEMENT_COMPLEMENT[bWeak], b.name, a.name),
    });
  }
  return { score, notes };
}

/** 두 사람의 궁합. 인자 순서를 바꿔도 점수는 같다. */
export function compatibility(a: Chart, b: Chart): Compatibility {
  const stemRel = resolveStemPair(a.dayStem, b.dayStem);
  const stemText = DAY_STEM_PAIR[stemRel.key];
  // '생'·'극'은 주는 쪽이 {A}가 되어야 문장이 맞는다
  const [giver, receiver] = stemRel.swap ? [b, a] : [a, b];

  const branchKey = resolveBranchPair(a.dayBranch, b.dayBranch);
  const branchText = DAY_BRANCH_PAIR[branchKey];

  const aPct = elementPercent(a.pillars);
  const bPct = elementPercent(b.pillars);
  const complement = complementOf(a, aPct, b, bPct);

  const total = stemText.score + branchText.score + complement.score;
  const score = Math.min(100, Math.max(SCORE_WEIGHT.floor, Math.round(total)));

  return {
    a: a.name,
    b: b.name,
    score,
    band: bandOf(score),
    stem: {
      key: stemRel.key,
      label: fill(stemText.label, giver.name, receiver.name),
      text: fill(stemText.text, giver.name, receiver.name),
      tip: fill(stemText.tip, giver.name, receiver.name),
      score: stemText.score,
    },
    branch: {
      key: branchKey,
      label: branchText.label,
      text: branchText.text,
      tip: branchText.tip,
      score: branchText.score,
    },
    complement: {
      score: Math.round(complement.score),
      notes: complement.notes,
    },
  };
}
