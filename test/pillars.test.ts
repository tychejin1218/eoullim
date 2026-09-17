import { describe, expect, it } from 'vitest';

import { type BirthInput, BirthInputError, buildChart, chartToKorean, decodeChart, leapMonthOf, lunarMonthDayCount } from '@/core/pillars';
import { trueSolarShiftMinutes } from '@/core/truesolar';

/** 팔자를 '庚午 辛巳 庚辰 壬午' 형태로 */
const gz = (input: Partial<BirthInput>) =>
  buildChart({ name: '테스터', calendar: 'solar', hour: 12, ...input } as BirthInput)
    .pillars.map((p) => p.stem + p.branch)
    .join(' ');

describe('기본 사주 산출', () => {
  it('1990-05-15 12:00 → 庚午 辛巳 庚辰 壬午', () => {
    expect(gz({ year: 1990, month: 5, day: 15, trueSolar: false })).toBe('庚午 辛巳 庚辰 壬午');
  });

  it('한글 표기', () => {
    const c = buildChart({ name: '테스터', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 12, trueSolar: false });
    expect(chartToKorean(c)).toBe('경오 · 신사 · 경진 · 임오');
  });

  it('시간을 모르면 3주만 세운다', () => {
    const c = buildChart({ name: '테스터', calendar: 'solar', year: 1990, month: 5, day: 15, hour: null });
    expect(c.pillars).toHaveLength(3);
    expect(c.timeKnown).toBe(false);
    expect(c.pillars.map((p) => p.label)).toEqual(['년주', '월주', '일주']);
  });
});

describe('자시 경계 — test411 회귀 테스트', () => {
  // 기존 구현은 '자시'를 고르면 무조건 00:00으로 계산해서
  // 23:30~23:59 출생자의 시주를 조자시(丙子)로 잘못 뽑았다.
  it('23:40 출생은 야자시 → 시주 戊子', () => {
    expect(gz({ year: 1990, month: 5, day: 15, hour: 23, minute: 40, trueSolar: false })).toBe('庚午 辛巳 庚辰 戊子');
  });

  it('00:10 출생은 조자시 → 시주 丙子 (같은 자시라도 다르다)', () => {
    expect(gz({ year: 1990, month: 5, day: 15, hour: 0, minute: 10, trueSolar: false })).toBe('庚午 辛巳 庚辰 丙子');
  });

  it('야자시설(sect 2)은 23시 이후에도 일주를 당일로 유지한다', () => {
    const late = buildChart({ name: 'x', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 23, minute: 40, trueSolar: false, sect: 2 });
    expect(late.dayStem + late.dayBranch).toBe('庚辰');
  });

  it('조자시설(sect 1)은 23시 이후 일주를 다음날로 넘긴다', () => {
    const late = buildChart({ name: 'x', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 23, minute: 40, trueSolar: false, sect: 1 });
    expect(late.dayStem + late.dayBranch).toBe('辛巳');
  });
});

describe('진태양시 보정', () => {
  it('보정 분 — 평시 -32분, 1988 서머타임 -92분, 1955 여름(+8:30 & 서머타임) -62분', () => {
    expect(trueSolarShiftMinutes(1990, 5, 15, 12, 0)).toBe(-32);
    expect(trueSolarShiftMinutes(1988, 7, 15, 12, 0)).toBe(-92);
    expect(trueSolarShiftMinutes(1955, 7, 15, 12, 0)).toBe(-62);
  });

  it('자정 직후 출생은 보정으로 전날이 되어 일주가 바뀐다', () => {
    const at = { year: 1990, month: 5, day: 16, hour: 0, minute: 10 } as const;
    expect(gz({ ...at, trueSolar: false })).toBe('庚午 辛巳 辛巳 戊子'); // 05-16 일주
    expect(gz({ ...at, trueSolar: true })).toBe('庚午 辛巳 庚辰 戊子'); // 23:38 → 05-15 일주
  });

  it('서머타임 시기에는 시주가 한 칸 당겨진다', () => {
    const at = { year: 1988, month: 7, day: 15, hour: 12 } as const;
    expect(gz({ ...at, trueSolar: false })).toBe('戊辰 己未 辛未 甲午'); // 午시
    expect(gz({ ...at, trueSolar: true })).toBe('戊辰 己未 辛未 癸巳'); // 巳시
  });

  it('UTC+8:30 시기(1955 여름)도 반영된다', () => {
    expect(gz({ year: 1955, month: 7, day: 15, hour: 12 })).toBe('乙未 癸未 丁丑 乙巳');
  });

  it('시간을 모르면 보정하지 않는다', () => {
    const c = buildChart({ name: 'x', calendar: 'solar', year: 1990, month: 5, day: 15, hour: null });
    expect(c.birth?.shiftMinutes).toBe(0);
  });
});

describe('음력 입력', () => {
  it('음력 1990.04.21 → 양력 1990.05.15', () => {
    const c = buildChart({ name: 'x', calendar: 'lunar', year: 1990, month: 4, day: 21, hour: 12, trueSolar: false });
    expect(c.birth?.solar).toBe('1990.05.15');
    expect(c.pillars.map((p) => p.stem + p.branch).join(' ')).toBe('庚午 辛巳 庚辰 壬午');
  });

  it('윤달 조회', () => {
    expect(leapMonthOf(1990)).toBe(5);
    expect(leapMonthOf(2023)).toBe(2);
    expect(leapMonthOf(2024)).toBe(0);
  });

  it('음력 달의 실제 일수', () => {
    expect(lunarMonthDayCount(1990, 1)).toBe(29);
    expect(lunarMonthDayCount(2023, 2, true)).toBe(29);
  });

  it('29일까지인 달에 30일을 넣으면 그 사실을 알려준다', () => {
    expect(() => buildChart({ name: 'x', calendar: 'lunar', year: 1990, month: 1, day: 30, hour: 12 })).toThrow(/29일까지/);
  });

  it('윤달이 아닌 달에 윤달 표시를 하면 실제 윤달을 알려준다', () => {
    expect(() => buildChart({ name: 'x', calendar: 'lunar', year: 1990, month: 3, day: 1, hour: 12, leap: true })).toThrow(/윤달은 5월/);
  });
});

describe('입력 검증', () => {
  const base = { name: 'x', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 12 } as const;

  it('이름 누락', () => {
    expect(() => buildChart({ ...base, name: '  ' })).toThrow(BirthInputError);
  });

  it('존재하지 않는 양력 날짜', () => {
    expect(() => buildChart({ ...base, month: 2, day: 30 })).toThrow(/존재하지 않는/);
  });

  it('윤년 2월 29일은 통과한다', () => {
    expect(() => buildChart({ ...base, year: 2024, month: 2, day: 29 })).not.toThrow();
  });

  it('범위를 벗어난 시', () => {
    expect(() => buildChart({ ...base, hour: 24 })).toThrow(/0~23/);
  });
});

describe('팔자 코드', () => {
  it('생년월일이 코드에 들어가지 않는다', () => {
    const c = buildChart({ name: '지영', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 12, trueSolar: false });
    expect(c.code).toBe('지영|庚午辛巳庚辰壬午');
    expect(c.code).not.toMatch(/1990|05|15/);
  });

  it('코드로 복원하면 팔자는 같고 생년월일은 없다', () => {
    const origin = buildChart({ name: '지영', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 12, trueSolar: false });
    const restored = decodeChart(origin.code);
    expect(restored.pillars).toEqual(origin.pillars);
    expect(restored.dayStem).toBe(origin.dayStem);
    expect(restored.birth).toBeUndefined();
  });

  it('시간 모름은 6자 코드', () => {
    const c = buildChart({ name: '지영', calendar: 'solar', year: 1990, month: 5, day: 15, hour: null });
    expect(c.code).toBe('지영|庚午辛巳庚辰');
    expect(decodeChart(c.code).timeKnown).toBe(false);
  });

  it('이름에 | 가 있어도 마지막 구분자를 쓴다', () => {
    expect(decodeChart('김|지영|庚午辛巳庚辰壬午').name).toBe('김|지영');
  });

  it('잘못된 코드는 거부한다', () => {
    expect(() => decodeChart('지영|庚午辛巳庚')).toThrow(/6자.*8자/);
    expect(() => decodeChart('庚午辛巳庚辰壬午')).toThrow(/코드 형식/);
    expect(() => decodeChart('지영|XX辛巳庚辰壬午')).toThrow(/천간/);
  });
});
