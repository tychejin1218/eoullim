/**
 * 진태양시 보정
 *
 * 사주의 시주(時柱)는 벽시계가 아니라 태양의 위치로 정해진다.
 * 한국은 벽시계와 실제 태양시가 최대 1시간 32분까지 벌어진 시기가 있었다.
 *
 *   - 1954-03 ~ 1961-08 : 표준자오선 127.5°E (UTC+8:30)
 *   - 1948~1951, 1955~1960, 1987~1988 : 서머타임 시행
 *   - 그 외 : 135°E (UTC+9) → 서울 기준 시계가 약 32분 빠름
 *
 * 이 이력을 직접 표로 관리하면 틀리기 쉬워서, Node/브라우저에 내장된
 * IANA tzdata(Asia/Seoul)에서 실제 오프셋을 조회해 쓴다.
 *
 * 적용하지 않은 것: 균시차(equation of time, ±16분).
 * 국내 만세력 대부분이 평균태양시까지만 보정하므로 기본값을 맞췄다.
 */

/** 서울 중심 경도 (°E) */
export const SEOUL_LONGITUDE = 126.978;

const KST = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** 주어진 UTC 순간에 'Asia/Seoul' 벽시계가 쓰던 오프셋(분) */
function offsetAtInstant(utcMs: number): number {
  const parts = KST.formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };
  // Intl은 24시를 0시가 아니라 24로 줄 때가 있다
  const hour = get('hour') % 24;
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (asIfUtc - utcMs) / 60_000;
}

/**
 * 벽시계 시각(한국 현지 표기)에 적용되던 UTC 오프셋(분).
 * 오프셋을 알아야 UTC를 알고, UTC를 알아야 오프셋을 아는 순환이라 한 번 되짚는다.
 */
export function koreaOffsetMinutes(year: number, month: number, day: number, hour: number, minute: number): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetAtInstant(naive);
  return offsetAtInstant(naive - first * 60_000);
}

/**
 * 벽시계 시각에 더해야 할 보정 분. 보통 음수(시계가 태양보다 빠름).
 * 예) 1990년 서울 → -32분, 1988년 서머타임 → -92분, 1955년 → -2분
 */
export function trueSolarShiftMinutes(year: number, month: number, day: number, hour: number, minute: number, longitude: number = SEOUL_LONGITUDE): number {
  const clockOffset = koreaOffsetMinutes(year, month, day, hour, minute);
  const solarOffset = longitude * 4; // 경도 1° = 4분
  return Math.round(solarOffset - clockOffset);
}
