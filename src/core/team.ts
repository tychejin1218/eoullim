/**
 * 팀 진단
 *
 * 개인 리포트를 여러 개 늘어놓는 게 아니라, 팀을 하나의 단위로 본다.
 *   ① 팀 전체 오행 분포 — 무엇이 비어 있고 무엇이 넘치는가
 *   ② 페어 매트릭스     — 누구와 누가 어떤 조합인가
 *   ③ 역할 배치         — 누가 무엇을 맡으면 좋고, 아무도 못 맡는 역할은 무엇인가
 *
 * 1인 1표다. 시주를 아는 사람이 더 큰 영향을 갖지 않도록,
 * 원점수를 합산하지 않고 각자의 백분율을 평균낸다.
 */

import {
  type DiagnosisText,
  DISCLAIMER,
  JOB_LABEL,
  JOB_STYLE,
  ROLE_BY_FAMILY,
  type RoleText,
  SAME_JOB_SAME_STYLE,
  TEAM_EXCESS,
  TEAM_LACK,
  TEAM_ROLE_GAP,
} from '@/data/corpus';
import { type Element, ELEMENTS, GOD_FAMILIES, type GodFamily, type Job, JOBS } from '@/data/tables';

import { type Compatibility, compatibility } from './compat';
import { type DayStrength, dayStrength, elementPercent, type ElementScores, strongestElement, toPercent, weakestElement } from './elements';
import type { Chart } from './pillars';
import { type TenGodProfile, tenGodProfile } from './tenGods';

/** 오행이 완전히 고르면 각 20% */
const EVEN_ELEMENT_SHARE = 20;
/**
 * 강조할 만한 치우침의 기준(severity 0~1).
 *
 * 실제 분포가 대칭이 아니라서 양쪽을 따로 잡는다.
 * 최약 오행은 10% 근처, 최강 오행은 30% 근처에 몰린다.
 *   결핍 0.5 → 10% 이하
 *   과잉 0.6 → 32% 이상
 *
 * 인원이 많을수록 평균이 균등에 수렴하므로 큰 팀에서는 잘 뜨지 않는다.
 * 그건 의도된 동작이다 — 8명이 모여도 한 축이 비어 있다면 진짜 신호다.
 */
export const NOTABLE_LACK_SEVERITY = 0.5;
export const NOTABLE_EXCESS_SEVERITY = 0.6;
/**
 * 아무도 주력으로 맡지 않았더라도, 팀 전체가 이 비중 이상 갖고 있으면
 * 공백으로 보지 않는다. 균등 비중은 0.2다.
 */
export const ROLE_GAP_SHARE = 0.14;

export class TeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamError';
  }
}

export interface TeamMember {
  index: number;
  name: string;
  chart: Chart;
  percent: ElementScores;
  strength: DayStrength;
  tenGod: TenGodProfile;
  /** 가장 두꺼운 십성 그룹에서 나온 역할 추천 */
  role: RoleText & { family: GodFamily };
  /** 사용자가 고른 직무 */
  job?: Job;
  jobLabel?: string;
  /** 직무 × 성향 한 줄. 직무를 안 골랐거나 '그 외'면 없다 */
  jobStyle?: string;
}

export interface ElementFinding extends DiagnosisText {
  element: Element;
  percent: number;
  /** 균등(20%)에서 얼마나 벗어났는가. 0~1 */
  severity: number;
  /** 눈에 띄게 치우쳤는가. UI에서 강조 여부로 쓴다 */
  notable: boolean;
}

/** 같은 직무를 같은 성향으로 하는 사람들 */
export interface JobOverlap {
  job: Job;
  label: string;
  family: GodFamily;
  members: string[];
  text: string;
}

export interface JobGroup {
  job: Job;
  label: string;
  members: string[];
}

export interface RoleGap {
  family: GodFamily;
  role: string;
  text: string;
}

export interface TeamDiagnosis {
  members: TeamMember[];
  /** 팀원 백분율의 평균. 합 100 */
  elements: ElementScores;
  /**
   * 가장 약한 축. 어떤 팀에도 하나는 있으므로 항상 채워진다.
   * 강조할 만한지는 notable로 판단한다.
   */
  lack: ElementFinding;
  /** 가장 두꺼운 축. 마찬가지로 항상 채워진다 */
  excess: ElementFinding;
  pairs: Compatibility[];
  /** members 순서대로의 N×N. 대각선은 null */
  matrix: (number | null)[][];
  averageScore: number | null;
  bestPair: Compatibility | null;
  hardestPair: Compatibility | null;
  /** 십성 그룹 → 그 역할이 가장 두꺼운 팀원들 */
  roleCoverage: Record<GodFamily, string[]>;
  /** 아무도 맡지 않은 역할. 팀 비중이 낮은 순 */
  roleGaps: RoleGap[];
  /** 직무 구성. 아무도 직무를 고르지 않았으면 빈 배열 */
  jobGroups: JobGroup[];
  /** 같은 직무 + 같은 성향 조합 */
  jobOverlaps: JobOverlap[];
  disclaimer: string;
}

function teamElements(members: TeamMember[]): ElementScores {
  const sum: ElementScores = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const m of members) {
    for (const e of ELEMENTS) sum[e] += m.percent[e];
  }
  return toPercent(sum);
}

function describeMember(chart: Chart, index: number): TeamMember {
  const percent = elementPercent(chart.pillars);
  const tenGod = tenGodProfile(chart.pillars, chart.dayStem);
  const family = tenGod.topFamily;

  const job = chart.job;
  return {
    index,
    name: chart.name,
    chart,
    percent,
    strength: dayStrength(chart.dayStem, percent),
    tenGod,
    role: { family, ...ROLE_BY_FAMILY[family] },
    job,
    jobLabel: job ? JOB_LABEL[job] : undefined,
    // 'ET'(그 외)는 직무 특성을 특정할 수 없어 문장을 두지 않는다
    jobStyle: job && job !== 'ET' ? JOB_STYLE[job][family] : undefined,
  };
}

function buildMatrix(size: number, pairs: Compatibility[], keyOf: (c: Compatibility) => [number, number]) {
  const matrix: (number | null)[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => null as number | null));
  for (const pair of pairs) {
    const [i, j] = keyOf(pair);
    matrix[i]![j] = pair.score;
    matrix[j]![i] = pair.score;
  }
  return matrix;
}

/**
 * 팀 전체를 진단한다.
 * 한 명만 넣어도 동작한다 — 페어 관련 항목이 비어 나올 뿐이다.
 */
export function diagnoseTeam(charts: Chart[]): TeamDiagnosis {
  if (charts.length === 0) throw new TeamError('팀원을 한 명 이상 넣어주세요.');

  const members = charts.map(describeMember);
  const elements = teamElements(members);

  // ── 오행 결핍·과잉
  // 임계값으로 잘라내면 팀 인원수에 따라 발동률이 크게 달라진다
  // (사람이 많을수록 평균이 균등에 수렴한다).
  // 그래서 항상 돌려주되, 치우친 정도를 severity로 같이 준다.
  const weakest = weakestElement(elements);
  const strongest = strongestElement(elements);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const lackSeverity = clamp01((EVEN_ELEMENT_SHARE - elements[weakest]) / EVEN_ELEMENT_SHARE);
  const lack: ElementFinding = {
    element: weakest,
    percent: elements[weakest],
    severity: lackSeverity,
    notable: lackSeverity >= NOTABLE_LACK_SEVERITY,
    ...TEAM_LACK[weakest],
  };

  const excessSeverity = clamp01((elements[strongest] - EVEN_ELEMENT_SHARE) / EVEN_ELEMENT_SHARE);
  const excess: ElementFinding = {
    element: strongest,
    percent: elements[strongest],
    severity: excessSeverity,
    notable: excessSeverity >= NOTABLE_EXCESS_SEVERITY,
    ...TEAM_EXCESS[strongest],
  };

  // ── 페어
  const indexOf = new Map<Compatibility, [number, number]>();
  const pairs: Compatibility[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const c = compatibility(members[i]!.chart, members[j]!.chart);
      indexOf.set(c, [i, j]);
      pairs.push(c);
    }
  }
  const matrix = buildMatrix(members.length, pairs, (c) => indexOf.get(c)!);
  const ranked = [...pairs].sort((a, b) => b.score - a.score);
  const averageScore = pairs.length ? Math.round(pairs.reduce((s, p) => s + p.score, 0) / pairs.length) : null;

  // ── 역할
  const roleCoverage = Object.fromEntries(GOD_FAMILIES.map((f) => [f, members.filter((m) => m.role.family === f).map((m) => m.name)])) as Record<
    GodFamily,
    string[]
  >;

  const familyShare = Object.fromEntries(GOD_FAMILIES.map((f) => [f, 0])) as Record<GodFamily, number>;
  for (const m of members) {
    const total = GOD_FAMILIES.reduce((s, f) => s + m.tenGod.family[f], 0);
    if (total > 0) {
      for (const f of GOD_FAMILIES) familyShare[f] += m.tenGod.family[f] / total;
    }
  }

  // 인원이 5명 미만이면 일부 그룹이 비는 건 산술적으로 당연하다.
  // 그래서 "아무도 주력이 아니다"만으로는 공백으로 보지 않고,
  // 팀 전체가 가진 비중까지 낮을 때만 공백으로 센다.
  const roleGaps: RoleGap[] = GOD_FAMILIES.filter((f) => roleCoverage[f].length === 0 && familyShare[f] / members.length < ROLE_GAP_SHARE)
    .sort((a, b) => familyShare[a] - familyShare[b])
    .map((f) => ({ family: f, role: ROLE_BY_FAMILY[f].role, text: TEAM_ROLE_GAP[f] }));

  // ── 직무
  const jobGroups: JobGroup[] = JOBS.map((job) => ({
    job,
    label: JOB_LABEL[job],
    members: members.filter((m) => m.job === job).map((m) => m.name),
  })).filter((g) => g.members.length > 0);

  const jobOverlaps: JobOverlap[] = [];
  for (const group of jobGroups) {
    for (const family of GOD_FAMILIES) {
      const same = members.filter((m) => m.job === group.job && m.role.family === family);
      if (same.length >= 2) {
        jobOverlaps.push({
          job: group.job,
          label: group.label,
          family,
          members: same.map((m) => m.name),
          text: SAME_JOB_SAME_STYLE,
        });
      }
    }
  }

  return {
    members,
    elements,
    lack,
    excess,
    pairs,
    matrix,
    averageScore,
    bestPair: ranked[0] ?? null,
    hardestPair: ranked.length > 1 ? ranked[ranked.length - 1]! : null,
    roleCoverage,
    roleGaps,
    jobGroups,
    jobOverlaps,
    disclaimer: DISCLAIMER,
  };
}
