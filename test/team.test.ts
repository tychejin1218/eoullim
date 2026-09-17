import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildChart, type Chart, chartToKorean } from '@/core/pillars';
import { diagnoseTeam, TeamError } from '@/core/team';
import { JOB_STYLE, ROLE_BY_FAMILY } from '@/data/corpus';
import { ELEMENTS, GOD_FAMILIES, type GodFamily, type Job } from '@/data/tables';

const person = (name: string, y: number, m: number, d: number, h: number | null = 12): Chart =>
  buildChart({ name, calendar: 'solar', year: y, month: m, day: d, hour: h });

const TEAM: Chart[] = [
  person('지영', 1990, 5, 15, 14),
  person('현우', 1993, 11, 3, 9),
  person('민서', 1988, 2, 27, 21),
  person('태경', 1996, 7, 9, 6),
  person('수아', 1991, 9, 30, null),
];

describe('팀 구성', () => {
  it('빈 팀은 거부한다', () => {
    expect(() => diagnoseTeam([])).toThrow(TeamError);
  });

  it('한 명이어도 동작한다 — 페어 항목만 비어 나온다', () => {
    const d = diagnoseTeam([TEAM[0]!]);
    expect(d.members).toHaveLength(1);
    expect(d.pairs).toHaveLength(0);
    expect(d.averageScore).toBeNull();
    expect(d.bestPair).toBeNull();
    expect(d.hardestPair).toBeNull();
    expect(d.matrix).toEqual([[null]]);
  });

  it('N명이면 N(N-1)/2 쌍', () => {
    expect(diagnoseTeam(TEAM).pairs).toHaveLength(10);
  });
});

describe('오행 분포', () => {
  const d = diagnoseTeam(TEAM);

  it('합이 정확히 100', () => {
    expect(ELEMENTS.reduce((s, e) => s + d.elements[e], 0)).toBe(100);
  });

  it('1인 1표 — 시주를 아는 사람이 더 큰 영향을 갖지 않는다', () => {
    // 팀 분포는 개인 백분율의 산술평균이어야 한다 (반올림 오차 1 이내)
    for (const e of ELEMENTS) {
      const mean = d.members.reduce((s, m) => s + m.percent[e], 0) / d.members.length;
      expect(Math.abs(d.elements[e] - mean)).toBeLessThanOrEqual(1);
    }
  });

  it('가장 약한 축과 두꺼운 축은 항상 나온다', () => {
    expect(d.lack.element).toBeTruthy();
    expect(d.excess.element).toBeTruthy();
    expect(d.lack.percent).toBeLessThanOrEqual(d.excess.percent);
    for (const f of [d.lack, d.excess]) {
      expect(f.severity).toBeGreaterThanOrEqual(0);
      expect(f.severity).toBeLessThanOrEqual(1);
      expect(f.text).toBeTruthy();
      expect(f.tip).toBeTruthy();
    }
  });

  it('치우침이 심할수록 severity가 크다', () => {
    const even = diagnoseTeam(TEAM);
    expect(even.lack.severity).toBeCloseTo((20 - even.lack.percent) / 20, 5);
    expect(even.excess.severity).toBeCloseTo((even.excess.percent - 20) / 20, 5);
  });
});

describe('페어 매트릭스', () => {
  const d = diagnoseTeam(TEAM);

  it('대칭이고 대각선은 비어 있다', () => {
    for (let i = 0; i < TEAM.length; i++) {
      expect(d.matrix[i]![i]).toBeNull();
      for (let j = 0; j < TEAM.length; j++) {
        expect(d.matrix[i]![j]).toBe(d.matrix[j]![i]);
      }
    }
  });

  it('모든 칸이 pairs와 일치한다', () => {
    for (const p of d.pairs) {
      const i = d.members.findIndex((m) => m.name === p.a);
      const j = d.members.findIndex((m) => m.name === p.b);
      expect(d.matrix[i]![j]).toBe(p.score);
    }
  });

  it('최고·최저 쌍과 평균', () => {
    const scores = d.pairs.map((p) => p.score);
    expect(d.bestPair!.score).toBe(Math.max(...scores));
    expect(d.hardestPair!.score).toBe(Math.min(...scores));
    expect(d.averageScore).toBe(Math.round(scores.reduce((s, v) => s + v, 0) / scores.length));
  });
});

describe('역할', () => {
  const d = diagnoseTeam(TEAM);

  it('모든 팀원이 정확히 한 역할에 배정된다', () => {
    const assigned = GOD_FAMILIES.flatMap((f) => d.roleCoverage[f]);
    expect(assigned.sort()).toEqual(d.members.map((m) => m.name).sort());
  });

  it('공백으로 잡힌 역할은 아무도 맡지 않은 역할이다', () => {
    for (const gap of d.roleGaps) {
      expect(d.roleCoverage[gap.family]).toHaveLength(0);
      expect(gap.text).toBeTruthy();
    }
  });

  it('인원이 적다고 무조건 공백이 쌓이지는 않는다', () => {
    // 3명이면 최대 3개 그룹만 맡을 수 있지만, 팀 전체가 가진 비중까지 따지므로
    // 남은 2개가 자동으로 공백이 되지는 않는다
    const small = diagnoseTeam(TEAM.slice(0, 3));
    expect(small.roleGaps.length).toBeLessThanOrEqual(2);
  });
});

describe('리포트', () => {
  it('팀 진단 샘플을 남긴다', () => {
    const d = diagnoseTeam(TEAM);
    const L: string[] = [];

    L.push('══ 팀 구성 ══');
    for (const m of d.members) {
      const p = m.percent;
      L.push(
        `${m.name.padEnd(4)} ${chartToKorean(m.chart).padEnd(24)} 목${String(p['목']).padStart(2)} 화${String(p['화']).padStart(2)} 토${String(p['토']).padStart(2)} 금${String(p['금']).padStart(2)} 수${String(p['수']).padStart(2)}   ${m.role.role} · ${m.strength.label}`,
      );
    }

    L.push('');
    L.push('══ 팀 오행 ══');
    for (const e of ELEMENTS) {
      L.push(`  ${e} ${String(d.elements[e]).padStart(3)}%  ${'█'.repeat(d.elements[e])}`);
    }
    L.push('');
    L.push(`[가장 약한 축] ${d.lack.element} ${d.lack.percent}% — ${d.lack.label}${d.lack.notable ? '  ◀ 주목' : ''}`);
    L.push(`  ${d.lack.text}`);
    L.push(`  팁: ${d.lack.tip}`);
    L.push(`[가장 두꺼운 축] ${d.excess.element} ${d.excess.percent}% — ${d.excess.label}${d.excess.notable ? '  ◀ 주목' : ''}`);
    L.push(`  ${d.excess.text}`);
    L.push(`  팁: ${d.excess.tip}`);

    L.push('');
    L.push(`══ 페어 매트릭스 (평균 ${d.averageScore}) ══`);
    L.push('        ' + d.members.map((m) => m.name.padStart(5)).join(''));
    d.matrix.forEach((row, i) => {
      L.push(d.members[i]!.name.padEnd(8) + row.map((v) => (v === null ? '    ·' : String(v).padStart(5))).join(''));
    });
    L.push('');
    L.push(`가장 잘 맞음: ${d.bestPair!.a} ↔ ${d.bestPair!.b} ${d.bestPair!.score}점 — ${d.bestPair!.band}`);
    L.push(`  ${d.bestPair!.stem.label} / ${d.bestPair!.branch.label}`);
    L.push(`가장 다름:   ${d.hardestPair!.a} ↔ ${d.hardestPair!.b} ${d.hardestPair!.score}점 — ${d.hardestPair!.band}`);
    L.push(`  ${d.hardestPair!.branch.text}`);
    L.push(`  팁: ${d.hardestPair!.branch.tip}`);

    L.push('');
    L.push('══ 역할 ══');
    for (const f of GOD_FAMILIES) {
      const who = d.roleCoverage[f];
      L.push(`  ${f}  ${ROLE(f).padEnd(14)} ${who.length ? who.join(', ') : '—'}`);
    }
    if (d.roleGaps.length) {
      L.push('');
      L.push('비어 있는 역할:');
      d.roleGaps.forEach((g) => L.push(`  · ${g.role} — ${g.text}`));
    }
    L.push('');
    L.push(d.disclaimer);

    writeFileSync('report-team.txt', L.join('\n'));
    expect(L.length).toBeGreaterThan(20);
  });
});

/** 라벨은 corpus 를 단일 출처로 쓴다 — 하드코딩하면 조용히 어긋난다 */
function ROLE(f: GodFamily): string {
  return ROLE_BY_FAMILY[f].role;
}

describe('직무 진단', () => {
  const withJob = (name: string, y: number, m: number, d: number, h: number, job: Job): Chart =>
    buildChart({ name, calendar: 'solar', year: y, month: m, day: d, hour: h, job });

  it('직무를 아무도 안 고르면 빈 배열', () => {
    const d = diagnoseTeam(TEAM);
    expect(d.jobGroups).toEqual([]);
    expect(d.jobOverlaps).toEqual([]);
    expect(d.members.every((m) => m.job === undefined)).toBe(true);
  });

  it('직무별로 묶어준다', () => {
    const d = diagnoseTeam([withJob('지영', 1990, 5, 15, 14, 'PM'), withJob('현우', 1993, 11, 3, 9, 'FE'), withJob('민서', 1988, 2, 27, 21, 'FE')]);
    const fe = d.jobGroups.find((g) => g.job === 'FE');
    expect(fe?.members).toEqual(['현우', '민서']);
    expect(fe?.label).toBe('프론트엔드');
    expect(d.jobGroups.find((g) => g.job === 'PM')?.members).toEqual(['지영']);
  });

  it('직무 × 성향 문장이 붙는다', () => {
    const d = diagnoseTeam([withJob('지영', 1990, 5, 15, 14, 'PM')]);
    const m = d.members[0]!;
    expect(m.jobLabel).toBe('프로젝트 매니저');
    expect(m.jobStyle).toBeTruthy();
    expect(m.jobStyle).toBe(JOB_STYLE.PM[m.role.family]);
  });

  it("'그 외'는 직무 문장을 만들지 않는다", () => {
    const d = diagnoseTeam([withJob('지영', 1990, 5, 15, 14, 'ET')]);
    expect(d.members[0]!.jobLabel).toBe('그 외');
    expect(d.members[0]!.jobStyle).toBeUndefined();
  });

  it('같은 직무 + 같은 성향이면 겹침으로 잡는다', () => {
    // 같은 사주를 이름만 바꿔 넣으면 성향이 반드시 같다
    const a = withJob('현우', 1993, 11, 3, 9, 'FE');
    const b = { ...withJob('민서', 1993, 11, 3, 9, 'FE'), name: '민서' };
    const d = diagnoseTeam([a, b]);
    expect(d.jobOverlaps).toHaveLength(1);
    expect(d.jobOverlaps[0]!.job).toBe('FE');
    expect(d.jobOverlaps[0]!.members).toEqual(['현우', '민서']);
    expect(d.jobOverlaps[0]!.text).toBeTruthy();
  });

  it('직무가 같아도 성향이 다르면 겹침이 아니다', () => {
    const d = diagnoseTeam([withJob('현우', 1993, 11, 3, 9, 'FE'), withJob('태경', 1996, 7, 9, 6, 'FE')]);
    const families = d.members.map((m) => m.role.family);
    if (families[0] !== families[1]) expect(d.jobOverlaps).toHaveLength(0);
  });
});
