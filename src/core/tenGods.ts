/**
 * 십성(十星)
 *
 * 일간(나)을 기준으로 다른 글자가 어떤 관계인지를 열 가지로 나눈 것.
 * 이 프로젝트에서는 역할 추천의 근거로 쓴다.
 */

import { BRANCH, CONTROLS, GENERATES, GOD_FAMILIES, GOD_FAMILY, type GodFamily, STEM, type Stem, type TenGod } from '@/data/tables';

import type { Pillar } from './pillars';

/** 일간에서 본 상대 천간의 십성 */
export function tenGod(dayStem: Stem, target: Stem): TenGod {
  const me = STEM[dayStem];
  const other = STEM[target];
  const samePolarity = me.polarity === other.polarity;

  // 나와 같은 오행 → 비겁
  if (me.element === other.element) return samePolarity ? '비견' : '겁재';
  // 내가 낳는 것 → 식상
  if (GENERATES[me.element] === other.element) return samePolarity ? '식신' : '상관';
  // 내가 누르는 것 → 재성
  if (CONTROLS[me.element] === other.element) return samePolarity ? '편재' : '정재';
  // 나를 누르는 것 → 관성
  if (CONTROLS[other.element] === me.element) return samePolarity ? '편관' : '정관';
  // 남은 경우는 나를 낳아주는 것 → 인성
  return samePolarity ? '편인' : '정인';
}

export type TenGodScores = Record<TenGod, number>;
export type FamilyScores = Record<GodFamily, number>;

export interface TenGodProfile {
  god: TenGodScores;
  family: FamilyScores;
  topGod: TenGod;
  topFamily: GodFamily;
  /** 점수가 0인 그룹 — 팀에서 비어 있는 역할을 찾을 때 쓴다 */
  emptyFamilies: GodFamily[];
}

const STEM_WEIGHT = 2;
const HIDDEN_MAIN_WEIGHT = 1.4;
const HIDDEN_SUB_WEIGHT = 0.7;

const emptyGods = (): TenGodScores => ({
  비견: 0,
  겁재: 0,
  식신: 0,
  상관: 0,
  편재: 0,
  정재: 0,
  편관: 0,
  정관: 0,
  편인: 0,
  정인: 0,
});

export function tenGodProfile(pillars: Pillar[], dayStem: Stem): TenGodProfile {
  const god = emptyGods();

  for (const p of pillars) {
    // 일간 자신은 비교 대상이 아니다
    if (p.label !== '일주') god[tenGod(dayStem, p.stem)] += STEM_WEIGHT;

    BRANCH[p.branch].hidden.forEach((h, i) => {
      god[tenGod(dayStem, h)] += i === 0 ? HIDDEN_MAIN_WEIGHT : HIDDEN_SUB_WEIGHT;
    });
  }

  const family: FamilyScores = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const [name, value] of Object.entries(god) as [TenGod, number][]) {
    family[GOD_FAMILY[name]] += value;
  }

  const topGod = (Object.keys(god) as TenGod[]).reduce((best, g) => (god[g] > god[best] ? g : best));
  const topFamily = GOD_FAMILIES.reduce((best, f) => (family[f] > family[best] ? f : best), GOD_FAMILIES[0]);

  return {
    god,
    family,
    topGod,
    topFamily,
    emptyFamilies: GOD_FAMILIES.filter((f) => family[f] === 0),
  };
}
