import { describe, expect, it } from 'vitest';

import { compatibility, resolveBranchPair, resolveStemPair } from '@/core/compat';
import { dayStrength, elementPercent, strongestElement, weakestElement } from '@/core/elements';
import { buildChart, decodeChart } from '@/core/pillars';
import { tenGod, tenGodProfile } from '@/core/tenGods';
import { SCORE_WEIGHT } from '@/data/corpus';
import { ELEMENTS } from '@/data/tables';

/** 일간·일지를 지정해 테스트용 사주를 만든다 */
const chart = (name: string, day: string, rest = '甲子乙丑') => decodeChart(`${name}|${rest}${day}`);

describe('오행 점수', () => {
  const real = buildChart({ name: 'x', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 12, trueSolar: false });

  it('백분율 합은 항상 정확히 100', () => {
    const pct = elementPercent(real.pillars);
    expect(ELEMENTS.reduce((s, e) => s + pct[e], 0)).toBe(100);
  });

  it('1990-05-15생은 화가 가장 강하고 목이 가장 약하다', () => {
    const pct = elementPercent(real.pillars);
    expect(strongestElement(pct)).toBe('화');
    expect(weakestElement(pct)).toBe('목');
  });

  it('월령 — 같은 글자라도 월주에 있으면 점수가 더 높다', () => {
    const asMonth = elementPercent([
      { label: '년주', stem: '甲', branch: '子' },
      { label: '월주', stem: '甲', branch: '午' },
      { label: '일주', stem: '甲', branch: '子' },
    ]);
    const asYear = elementPercent([
      { label: '년주', stem: '甲', branch: '午' },
      { label: '월주', stem: '甲', branch: '子' },
      { label: '일주', stem: '甲', branch: '子' },
    ]);
    expect(asMonth['화']).toBeGreaterThan(asYear['화']);
  });

  it('신강·신약은 일간 오행 + 인성으로 본다', () => {
    const s = dayStrength(real.dayStem, elementPercent(real.pillars));
    expect(s.support).toBeGreaterThan(0);
    expect(['strong', 'weak']).toContain(s.mode);
  });
});

describe('십성 판정', () => {
  it('일간 庚(금) 기준', () => {
    expect(tenGod('庚', '庚')).toBe('비견'); // 같은 금, 같은 양
    expect(tenGod('庚', '辛')).toBe('겁재'); // 같은 금, 음양 다름
    expect(tenGod('庚', '壬')).toBe('식신'); // 금생수, 같은 양
    expect(tenGod('庚', '癸')).toBe('상관');
    expect(tenGod('庚', '甲')).toBe('편재'); // 금극목, 같은 양
    expect(tenGod('庚', '乙')).toBe('정재');
    expect(tenGod('庚', '丙')).toBe('편관'); // 화극금, 같은 양
    expect(tenGod('庚', '丁')).toBe('정관');
    expect(tenGod('庚', '戊')).toBe('편인'); // 토생금, 같은 양
    expect(tenGod('庚', '己')).toBe('정인');
  });

  it('일간 자신은 세지 않는다', () => {
    const p = tenGodProfile([{ label: '일주', stem: '庚', branch: '子' }], '庚');
    expect(p.god['비견']).toBe(0); // 천간 庚은 제외, 子의 癸만 계산됨
    expect(p.god['상관']).toBeGreaterThan(0);
  });

  it('비어 있는 십성 그룹을 알려준다', () => {
    const p = tenGodProfile([{ label: '년주', stem: '庚', branch: '酉' }], '庚');
    expect(p.emptyFamilies.length).toBeGreaterThan(0);
    expect(p.emptyFamilies).not.toContain('비겁');
  });
});

describe('일간 관계', () => {
  it('천간합은 상극보다 먼저 판정한다', () => {
    // 甲(목) 己(토)는 목극토지만 갑기합이 우선
    expect(resolveStemPair('甲', '己').key).toBe('합');
    expect(resolveStemPair('乙', '庚').key).toBe('합');
    expect(resolveStemPair('戊', '癸').key).toBe('합');
  });

  it('같은 오행은 음양으로 갈린다', () => {
    expect(resolveStemPair('庚', '庚').key).toBe('비화_동일');
    expect(resolveStemPair('庚', '辛').key).toBe('비화_상반');
  });

  it('생·극은 방향을 기억한다', () => {
    expect(resolveStemPair('甲', '丙')).toEqual({ key: '생', swap: false }); // 목생화
    expect(resolveStemPair('丙', '甲')).toEqual({ key: '생', swap: true });
    expect(resolveStemPair('甲', '戊')).toEqual({ key: '극', swap: false }); // 목극토
    expect(resolveStemPair('戊', '甲')).toEqual({ key: '극', swap: true });
  });
});

describe('일지 관계', () => {
  it('육합', () => {
    expect(resolveBranchPair('子', '丑')).toBe('육합');
    expect(resolveBranchPair('卯', '戌')).toBe('육합');
  });

  it('반합은 왕지가 껴야 성립한다', () => {
    expect(resolveBranchPair('申', '子')).toBe('반합'); // 子가 왕지
    expect(resolveBranchPair('子', '辰')).toBe('반합');
    expect(resolveBranchPair('申', '辰')).toBe('무관'); // 왕지 없음
  });

  it('충', () => {
    expect(resolveBranchPair('子', '午')).toBe('충');
    expect(resolveBranchPair('寅', '申')).toBe('충');
  });

  it('겹치는 관계는 덜 날 선 쪽을 택한다', () => {
    expect(resolveBranchPair('巳', '申')).toBe('육합'); // 육합이자 삼형
    expect(resolveBranchPair('丑', '未')).toBe('충'); // 충이자 형
  });

  it('자형은 지정된 네 글자가 겹칠 때만', () => {
    expect(resolveBranchPair('午', '午')).toBe('형');
    expect(resolveBranchPair('亥', '亥')).toBe('형');
    expect(resolveBranchPair('子', '子')).toBe('무관');
  });

  it('해', () => {
    expect(resolveBranchPair('子', '未')).toBe('해');
    expect(resolveBranchPair('卯', '辰')).toBe('해');
  });
});

describe('궁합 점수', () => {
  const a = chart('지영', '甲子');
  const b = chart('현우', '己丑');

  it('인자 순서를 바꿔도 점수는 같다', () => {
    expect(compatibility(a, b).score).toBe(compatibility(b, a).score);
  });

  it('생·극 문장은 순서와 무관하게 주는 쪽을 먼저 부른다', () => {
    const wood = chart('목씨', '甲子'); // 목
    const fire = chart('화씨', '丙寅'); // 화 — 목생화
    for (const c of [compatibility(wood, fire), compatibility(fire, wood)]) {
      expect(c.stem.key).toBe('생');
      expect(c.stem.label.startsWith('목씨')).toBe(true);
      expect(c.stem.text).toContain('목씨가 판을 만들고');
      expect(c.stem.text).toContain('화씨가 그 위에서');
    }
  });

  it('치환자가 남지 않는다', () => {
    for (const [x, y] of [
      [a, b],
      [chart('A', '甲子'), chart('B', '戊午')],
    ] as const) {
      const c = compatibility(x, y);
      const all = [c.stem.label, c.stem.text, c.stem.tip, c.branch.text, ...c.complement.notes.map((n) => n.text)];
      expect(all.join()).not.toMatch(/\{[AB]\}/);
    }
  });

  it('최저 조합도 30점 밑으로 내려가지 않는다', () => {
    const worst = compatibility(chart('x', '甲戌'), chart('y', '戊辰'));
    expect(worst.score).toBeGreaterThanOrEqual(SCORE_WEIGHT.floor);
  });

  it('점수는 30~100 범위 안에 있다 — 모든 일간·일지 조합', () => {
    const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    let checked = 0;
    for (const s1 of stems)
      for (const b1 of branches) {
        for (const s2 of stems)
          for (const b2 of branches) {
            const c = compatibility(chart('x', s1 + b1), chart('y', s2 + b2));
            expect(c.score).toBeGreaterThanOrEqual(30);
            expect(c.score).toBeLessThanOrEqual(100);
            checked++;
          }
      }
    expect(checked).toBe(14400);
  });

  it('천간합 + 육합이면 높은 점수대가 나온다', () => {
    const c = compatibility(chart('x', '甲子'), chart('y', '己丑'));
    expect(c.stem.key).toBe('합');
    expect(c.branch.key).toBe('육합');
    expect(c.score).toBeGreaterThanOrEqual(75);
  });

  it('보완 문장은 부족한 쪽과 채워주는 쪽을 구분한다', () => {
    const c = compatibility(a, b);
    for (const n of c.complement.notes) {
      expect(n.lacking).not.toBe(n.filler);
      expect(n.text).toContain(n.filler);
    }
  });
});
