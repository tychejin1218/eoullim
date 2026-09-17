/**
 * 생년월일시 → 사주 팔자
 *
 * 기존 test411 구현에서 두 가지를 고쳤다.
 *  1. 시간을 12시진 드롭다운(자시=00:00)으로 받지 않고 실제 시:분으로 받는다.
 *     → 23:30~23:59 출생자의 시주가 조자시로 잘못 계산되던 문제가 사라진다.
 *  2. 진태양시 보정을 넣었다. (truesolar.ts)
 */

import { Lunar, LunarMonth, LunarYear, Solar } from 'lunar-typescript';

import { BRANCH, type Branch, isBranch, isStem, type PillarLabel, STEM, type Stem, toKorean } from '@/data/tables';

import { SEOUL_LONGITUDE, trueSolarShiftMinutes } from './truesolar';

export type CalendarType = 'solar' | 'lunar';

/**
 * 자시(23:00~01:00)를 보는 유파.
 *  2 = 야자시설 (기본) — 23시 이후에도 일주는 당일 유지, 시주만 다음날 일간 기준
 *  1 = 조자시설       — 23시 이후는 일주까지 다음날로 넘김
 */
export type Sect = 1 | 2;

export interface BirthInput {
  name: string;
  calendar: CalendarType;
  year: number;
  month: number;
  day: number;
  /** 음력 윤달 여부 */
  leap?: boolean;
  /** 실제 출생 시각 0~23. 모르면 null → 시주를 만들지 않는다 */
  hour: number | null;
  minute?: number;
  /** 진태양시 보정 (기본 true) */
  trueSolar?: boolean;
  /** 출생지 경도 °E (기본 서울) */
  longitude?: number;
  sect?: Sect;
}

export interface Pillar {
  label: PillarLabel;
  stem: Stem;
  branch: Branch;
}

export interface Chart {
  name: string;
  /** 년·월·일 3주, 시간을 알면 시주까지 4주 */
  pillars: Pillar[];
  dayStem: Stem;
  dayBranch: Branch;
  timeKnown: boolean;
  /** 팀원끼리 공유하는 코드. 생년월일이 들어 있지 않다 */
  code: string;
  /**
   * 생년월일 입력으로 만든 경우에만 존재한다.
   * 코드로 복원한 Chart에는 없다 — 그게 코드 공유의 요점이다.
   */
  birth?: {
    solar: string;
    lunar: string;
    /** 진태양시 보정으로 움직인 분 (음수 = 앞당김) */
    shiftMinutes: number;
  };
}

export class BirthInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BirthInputError';
  }
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** 해당 음력 달의 실제 일수. 윤달은 leap=true. 없는 달이면 0 */
export function lunarMonthDayCount(year: number, month: number, leap = false): number {
  const m = LunarMonth.fromYm(year, leap ? -month : month);
  return m ? m.getDayCount() : 0;
}

/** 그 해의 윤달 번호. 윤달이 없으면 0 */
export function leapMonthOf(year: number): number {
  return LunarYear.fromYear(year).getLeapMonth();
}

function assertStem(v: string): Stem {
  if (!isStem(v)) throw new BirthInputError(`천간을 알 수 없습니다: ${v}`);
  return v;
}

function assertBranch(v: string): Branch {
  if (!isBranch(v)) throw new BirthInputError(`지지를 알 수 없습니다: ${v}`);
  return v;
}

function validate(input: BirthInput): void {
  const { name, year, month, day, hour, minute = 0 } = input;

  if (!name.trim()) throw new BirthInputError('이름을 입력해주세요.');
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new BirthInputError(`${MIN_YEAR}년~${MAX_YEAR}년 사이만 계산할 수 있습니다.`);
  }
  if (month < 1 || month > 12) throw new BirthInputError('월은 1~12 사이여야 합니다.');
  if (day < 1) throw new BirthInputError('일을 확인해주세요.');
  if (hour !== null && (hour < 0 || hour > 23)) throw new BirthInputError('시는 0~23 사이여야 합니다.');
  if (minute < 0 || minute > 59) throw new BirthInputError('분은 0~59 사이여야 합니다.');

  if (input.calendar === 'solar') {
    const probe = new Date(Date.UTC(2000, month - 1, day));
    probe.setUTCFullYear(year);
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
      throw new BirthInputError('존재하지 않는 양력 날짜입니다.');
    }
    return;
  }

  // 음력: 윤달 여부와 그 달의 실제 일수를 먼저 확인한다.
  if (input.leap) {
    const actual = leapMonthOf(year);
    if (actual !== month) {
      throw new BirthInputError(actual ? `${year}년 윤달은 ${actual}월입니다. ${month}월은 윤달이 아닙니다.` : `${year}년에는 윤달이 없습니다.`);
    }
  }
  const days = lunarMonthDayCount(year, month, input.leap);
  if (days === 0) throw new BirthInputError('존재하지 않는 음력 날짜입니다.');
  if (day > days) {
    throw new BirthInputError(`${year}년 음력 ${input.leap ? '윤' : ''}${month}월은 ${days}일까지입니다.`);
  }
}

/**
 * 생년월일시로 사주를 세운다.
 * 시간을 모르면 정오를 써서 계산하되 시주는 결과에서 뺀다
 * (정오는 어느 유파에서도 날짜 경계에 걸리지 않는다).
 */
export function buildChart(input: BirthInput): Chart {
  validate(input);

  const { name, calendar, year, month, day, leap = false, hour, minute = 0, trueSolar = true, longitude = SEOUL_LONGITUDE, sect = 2 } = input;

  const timeKnown = hour !== null;
  const baseHour = timeKnown ? hour : 12;
  const baseMinute = timeKnown ? minute : 0;

  // 1) 기준 양력 일시를 확정한다
  let solar: Solar;
  if (calendar === 'solar') {
    solar = Solar.fromYmdHms(year, month, day, baseHour, baseMinute, 0);
  } else {
    solar = Lunar.fromYmdHms(year, leap ? -month : month, day, baseHour, baseMinute, 0).getSolar();
  }

  // 2) 진태양시 보정. 날짜를 넘길 수 있고, 넘기면 일주가 바뀌는 게 맞다.
  let shiftMinutes = 0;
  if (timeKnown && trueSolar) {
    shiftMinutes = trueSolarShiftMinutes(solar.getYear(), solar.getMonth(), solar.getDay(), solar.getHour(), solar.getMinute(), longitude);
    if (shiftMinutes !== 0) {
      const shifted = new Date(Date.UTC(2000, solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute() + shiftMinutes));
      shifted.setUTCFullYear(solar.getYear());
      solar = Solar.fromYmdHms(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), shifted.getUTCHours(), shifted.getUTCMinutes(), 0);
    }
  }

  // 3) 팔자
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  ec.setSect(sect);

  const pillars: Pillar[] = [
    { label: '년주', stem: assertStem(ec.getYearGan()), branch: assertBranch(ec.getYearZhi()) },
    { label: '월주', stem: assertStem(ec.getMonthGan()), branch: assertBranch(ec.getMonthZhi()) },
    { label: '일주', stem: assertStem(ec.getDayGan()), branch: assertBranch(ec.getDayZhi()) },
  ];
  if (timeKnown) {
    pillars.push({ label: '시주', stem: assertStem(ec.getTimeGan()), branch: assertBranch(ec.getTimeZhi()) });
  }

  const dayPillar = pillars[2]!;
  const lunarMonth = lunar.getMonth();

  return {
    name: name.trim(),
    pillars,
    dayStem: dayPillar.stem,
    dayBranch: dayPillar.branch,
    timeKnown,
    code: encodeChart(name.trim(), pillars),
    birth: {
      solar: `${solar.getYear()}.${pad(solar.getMonth())}.${pad(solar.getDay())}`,
      lunar: `${lunar.getYear()}.${pad(Math.abs(lunarMonth))}.${pad(lunar.getDay())}${lunarMonth < 0 ? ' (윤달)' : ''}`,
      shiftMinutes,
    },
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 팔자 코드 — 팀원끼리 공유하는 단위.
 *
 * 생년월일 대신 이것만 주고받으면 생일을 알리지 않고도 팀 진단이 된다.
 * 같은 팔자는 60년 주기로 반복되므로 코드만으로 생년월일을 특정할 수 없다.
 *
 *   "지영|庚午辛巳庚辰壬午"
 */
export function encodeChart(name: string, pillars: Pillar[]): string {
  return `${name}|${pillars.map((p) => p.stem + p.branch).join('')}`;
}

/** 팔자 코드를 Chart로 되돌린다. 생년월일 정보는 복원되지 않는다. */
export function decodeChart(code: string): Chart {
  const sep = code.lastIndexOf('|');
  if (sep < 1) throw new BirthInputError('코드 형식이 올바르지 않습니다. 예) 지영|庚午辛巳庚辰壬午');

  const name = code.slice(0, sep).trim();
  const body = code.slice(sep + 1).replace(/\s/g, '');
  if (body.length !== 6 && body.length !== 8) {
    throw new BirthInputError('팔자는 6자(시간 모름) 또는 8자여야 합니다.');
  }

  const labels: PillarLabel[] = ['년주', '월주', '일주', '시주'];
  const pillars: Pillar[] = [];
  for (let i = 0; i < body.length; i += 2) {
    pillars.push({
      label: labels[i / 2]!,
      stem: assertStem(body[i]!),
      branch: assertBranch(body[i + 1]!),
    });
  }

  const dayPillar = pillars[2]!;
  return {
    name,
    pillars,
    dayStem: dayPillar.stem,
    dayBranch: dayPillar.branch,
    timeKnown: pillars.length === 4,
    code: encodeChart(name, pillars),
  };
}

/** 사주를 한글로. '경오 · 신사 · 경진 · 임오' */
export function chartToKorean(chart: Chart): string {
  return chart.pillars.map((p) => toKorean(p.stem, p.branch)).join(' · ');
}

/** 일간의 오행 — 그 사람의 본질을 나타내는 글자 */
export function dayElement(chart: Chart) {
  return STEM[chart.dayStem].element;
}

/** 일지의 본기 지장간 — 겉으로 안 드러나는 속마음 */
export function dayHiddenStem(chart: Chart): Stem {
  return BRANCH[chart.dayBranch].hidden[0];
}
