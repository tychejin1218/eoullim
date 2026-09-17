/**
 * 점수 분포 가드
 *
 * 가중치를 손대면 분포가 무너지기 쉽다. 실제 생년월일로 만든 사주들로
 * 전 쌍의 점수를 뽑아, 도구로서 쓸 만한 분포인지 확인한다.
 * 부수적으로 report.txt를 남겨 눈으로도 볼 수 있게 한다.
 */

import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { compatibility } from '@/core/compat';
import { elementPercent } from '@/core/elements';
import { buildChart, type Chart, chartToKorean } from '@/core/pillars';

/** 재현 가능한 난수 */
function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function samplePeople(count: number): Chart[] {
  const rnd = makeRandom(42);
  const people: Chart[] = [];
  for (let i = 0; i < count; i++) {
    people.push(
      buildChart({
        name: `P${i}`,
        calendar: 'solar',
        year: 1970 + Math.floor(rnd() * 36),
        month: 1 + Math.floor(rnd() * 12),
        day: 1 + Math.floor(rnd() * 28),
        hour: Math.floor(rnd() * 24),
        minute: Math.floor(rnd() * 60),
      }),
    );
  }
  return people;
}

const people = samplePeople(200);
const pairs = people.flatMap((a, i) => people.slice(i + 1).map((b) => compatibility(a, b)));
const scores = [...pairs.map((p) => p.score)].sort((x, y) => x - y);
const at = (p: number) => scores[Math.floor(scores.length * p)]!;
const mean = scores.reduce((s, v) => s + v, 0) / scores.length;

describe('점수 분포', () => {
  it(`표본 ${pairs.length}쌍이 생성된다`, () => {
    expect(pairs.length).toBe((200 * 199) / 2);
  });

  it('중앙값이 45~60 사이 — 한쪽으로 쏠리지 않는다', () => {
    expect(at(0.5)).toBeGreaterThanOrEqual(45);
    expect(at(0.5)).toBeLessThanOrEqual(60);
  });

  it('상·하위 구간이 실제로 쓰인다', () => {
    expect(scores.filter((s) => s >= 70).length / scores.length).toBeGreaterThan(0.03);
    expect(scores.filter((s) => s <= 40).length / scores.length).toBeGreaterThan(0.03);
  });

  it('보완 점수가 25점 만점을 제대로 쓴다', () => {
    const comp = pairs.map((p) => p.complement.score);
    const compMean = comp.reduce((s, v) => s + v, 0) / comp.length;
    expect(compMean).toBeGreaterThan(8);
    expect(Math.max(...comp)).toBeGreaterThan(20);
  });

  it('조사가 이름 받침에 맞게 붙는다', () => {
    const a = buildChart({ name: '지영', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 14 });
    const b = buildChart({ name: '현우', calendar: 'solar', year: 1993, month: 11, day: 3, hour: 9 });
    const joined = [a, b]
      .flatMap((x) => [compatibility(x, x === a ? b : a)])
      .flatMap((c) => [c.stem.label, c.stem.text, c.stem.tip])
      .join(' ');
    expect(joined).not.toMatch(/지영가|현우이/);
  });

  it('리포트를 남긴다', () => {
    const L: string[] = [];
    L.push(`══ 점수 분포 (실제 생년월일 200명, ${pairs.length}쌍) ══`);
    L.push(`최저 ${scores[0]}  25% ${at(0.25)}  중앙 ${at(0.5)}  75% ${at(0.75)}  최고 ${scores.at(-1)}  평균 ${mean.toFixed(1)}`);
    L.push('');
    for (let lo = 30; lo < 100; lo += 10) {
      const n = scores.filter((s) => s >= lo && s < lo + 10).length;
      L.push(`  ${lo}~${lo + 9}점 ${String(n).padStart(6)}쌍 ${'█'.repeat(Math.round((n / scores.length) * 70))}`);
    }
    const comp = pairs.map((p) => p.complement.score);
    L.push('');
    L.push(`보완 점수(25점 만점) 평균 ${(comp.reduce((s, v) => s + v, 0) / comp.length).toFixed(1)}  최대 ${Math.max(...comp)}`);
    L.push('');
    L.push('══ 샘플 ══');
    const a = buildChart({ name: '지영', calendar: 'solar', year: 1990, month: 5, day: 15, hour: 14, minute: 20 });
    const b = buildChart({ name: '현우', calendar: 'solar', year: 1993, month: 11, day: 3, hour: 9, minute: 40 });
    for (const p of [a, b]) {
      const pct = elementPercent(p.pillars);
      L.push(`${p.name}  ${chartToKorean(p)}  |  목${pct['목']} 화${pct['화']} 토${pct['토']} 금${pct['금']} 수${pct['수']}`);
    }
    const c = compatibility(a, b);
    L.push('');
    L.push(`${c.a} ↔ ${c.b}   ${c.score}점 — ${c.band}`);
    L.push(`[일간 ${c.stem.key}] ${c.stem.label}`);
    L.push(`  ${c.stem.text}`);
    L.push(`  팁: ${c.stem.tip}`);
    L.push(`[일지 ${c.branch.key}] ${c.branch.label}`);
    L.push(`  ${c.branch.text}`);
    L.push(`  팁: ${c.branch.tip}`);
    L.push(`[보완 ${c.complement.score}점]`);
    c.complement.notes.forEach((n) => L.push(`  ${n.text}`));
    writeFileSync('report.txt', L.join('\n'));
    expect(L.length).toBeGreaterThan(10);
  });
});
