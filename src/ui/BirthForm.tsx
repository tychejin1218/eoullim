import { useMemo, useState } from 'react';

import { BirthInputError, buildChart, type CalendarType, type Chart, chartToKorean, leapMonthOf, lunarMonthDayCount, type Sect } from '@/core/pillars';
import { BRANCH, STEM } from '@/data/tables';

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1919 }, (_, i) => THIS_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysInMonth(calendar: CalendarType, year: number, month: number, leap: boolean): number {
  if (calendar === 'solar') return new Date(year, month, 0).getDate();
  // 음력은 달마다 29일 또는 30일이라 실제 일수를 조회한다
  return lunarMonthDayCount(year, month, leap) || 29;
}

export function BirthForm({ onAdd }: { onAdd?: (code: string) => void }) {
  const [name, setName] = useState('');
  const [calendar, setCalendar] = useState<CalendarType>('solar');
  const [leap, setLeap] = useState(false);
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [timeKnown, setTimeKnown] = useState(true);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [trueSolar, setTrueSolar] = useState(true);
  const [sect, setSect] = useState<Sect>(2);

  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const leapMonth = useMemo(() => (calendar === 'lunar' ? leapMonthOf(year) : 0), [calendar, year]);
  const maxDay = daysInMonth(calendar, year, month, leap);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  // 달이 바뀌어 일수가 줄면 화면에서도 계산에서도 당겨서 쓴다
  const safeDay = Math.min(day, maxDay);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setCopied(false);
    try {
      setChart(
        buildChart({
          name,
          calendar,
          year,
          month,
          day,
          leap: calendar === 'lunar' && leap,
          hour: timeKnown ? hour : null,
          minute: timeKnown ? minute : 0,
          trueSolar,
          sect,
        }),
      );
      setError(null);
    } catch (e) {
      setChart(null);
      setError(e instanceof BirthInputError ? e.message : '입력을 다시 확인해주세요.');
    }
  }

  async function copy() {
    if (!chart) return;
    try {
      await navigator.clipboard.writeText(chart.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>내 코드 만들기</h2>
        <p className="sub">
          생년월일시는 이 브라우저 밖으로 나가지 않습니다. 팀에는 아래 <b>팔자 코드</b>만 공유하세요.
        </p>

        <div className="stack">
          <label className="field">
            이름 또는 닉네임
            <input type="text" maxLength={12} value={name} autoComplete="off" placeholder="최대 12자" onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="field">
            <span>생일 기준</span>
            <div className="row">
              <label className="check">
                <input
                  type="radio"
                  name="cal"
                  checked={calendar === 'solar'}
                  onChange={() => {
                    setCalendar('solar');
                    setLeap(false);
                  }}
                />
                양력
              </label>
              <label className="check">
                <input type="radio" name="cal" checked={calendar === 'lunar'} onChange={() => setCalendar('lunar')} />
                음력
              </label>
              {calendar === 'lunar' && leapMonth > 0 && (
                <label className="check">
                  <input type="checkbox" checked={leap} disabled={month !== leapMonth} onChange={(e) => setLeap(e.target.checked)} />
                  윤달
                </label>
              )}
            </div>
            {calendar === 'lunar' && (
              <span className="tiny">{leapMonth > 0 ? `${year}년 윤달은 ${leapMonth}월입니다.` : `${year}년에는 윤달이 없습니다.`}</span>
            )}
          </div>

          <div className="field">
            <span>생년월일</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="연도">
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                  setLeap(false);
                }}
                aria-label="월"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
              <select value={safeDay} onChange={(e) => setDay(Number(e.target.value))} aria-label="일">
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}일
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <span>태어난 시각</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <select value={timeKnown ? hour : ''} disabled={!timeKnown} onChange={(e) => setHour(Number(e.target.value))} aria-label="시">
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}시
                  </option>
                ))}
              </select>
              <select value={timeKnown ? minute : ''} disabled={!timeKnown} onChange={(e) => setMinute(Number(e.target.value))} aria-label="분">
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}분
                  </option>
                ))}
              </select>
              <label className="check" style={{ whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!timeKnown} onChange={(e) => setTimeKnown(!e.target.checked)} />
                모름
              </label>
            </div>
            <span className="tiny">시각을 모르면 시주를 뺀 3주로 계산합니다. 23시대 출생은 시:분을 정확히 넣어야 야자시가 맞습니다.</span>
          </div>

          <details>
            <summary className="muted" style={{ cursor: 'pointer' }}>
              계산 방식
            </summary>
            <div className="stack" style={{ marginTop: 10 }}>
              <label className="check">
                <input type="checkbox" checked={trueSolar} onChange={(e) => setTrueSolar(e.target.checked)} />
                진태양시 보정 (경도 · 표준시 이력 · 서머타임)
              </label>
              <label className="field">
                자시 기준
                <select value={sect} onChange={(e) => setSect(Number(e.target.value) as Sect)}>
                  <option value={2}>야자시설 — 23시 이후 일주는 당일 유지</option>
                  <option value={1}>조자시설 — 23시 이후 일주를 다음날로</option>
                </select>
              </label>
            </div>
          </details>

          {error && <div className="error">{error}</div>}
          <div>
            <button className="btn" type="submit">
              사주 계산하기
            </button>
          </div>
        </div>
      </form>

      {chart && (
        <div className="card">
          <h2>{chart.name}님의 사주</h2>
          <p className="sub">{chartToKorean(chart)}</p>

          <div className="pillars">
            {chart.pillars.map((p) => (
              <div className="pillar" key={p.label}>
                <b>
                  {p.stem}
                  {p.branch}
                </b>
                <span>
                  {STEM[p.stem].ko}
                  {BRANCH[p.branch].ko}
                </span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>

          {chart.birth && (
            <p className="tiny">
              양력 {chart.birth.solar} · 음력 {chart.birth.lunar}
              {chart.birth.shiftMinutes !== 0 && ` · 진태양시 ${chart.birth.shiftMinutes}분 보정`}
            </p>
          )}

          <div className="code-out" style={{ marginTop: 14 }}>
            <p className="tiny" style={{ marginBottom: 6 }}>
              팀에 공유할 코드 — 생년월일은 들어 있지 않습니다
            </p>
            <p className="code-value">{chart.code}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn small" type="button" onClick={copy}>
                {copied ? '복사됨' : '코드 복사'}
              </button>
              {onAdd && (
                <button className="btn small ghost" type="button" onClick={() => onAdd(chart.code)}>
                  내 팀에 추가
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
