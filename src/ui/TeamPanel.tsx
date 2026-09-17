import { useEffect, useMemo, useRef, useState } from 'react';

import type { Compatibility } from '@/core/compat';
import { BirthInputError, type Chart, chartToKorean, decodeChart } from '@/core/pillars';
import { diagnoseTeam, type TeamDiagnosis } from '@/core/team';
import { ELEMENT_MEANING, ROLE_BY_FAMILY, SCORE_WEIGHT } from '@/data/corpus';
import { type Element, ELEMENT_COLOR, ELEMENTS, GOD_FAMILIES } from '@/data/tables';

import { captureFilename, saveElementAsPng } from './saveImage';

/** --accent 를 'r, g, b' 로. 테마가 바뀌면 값도 바뀐다. */
function readAccentRgb(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const hex = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(raw);
  if (rgb)
    return rgb[1]!
      .split(',')
      .slice(0, 3)
      .map((v) => v.trim())
      .join(', ');
  return '47, 125, 109';
}

function useAccentRgb(): string {
  const [rgb, setRgb] = useState(readAccentRgb);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setRgb(readAccentRgb());
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return rgb;
}

/**
 * 점수를 강조 색 농도로. 낮은 점수를 붉게 칠하지 않는다 — 낙인이 되지 않도록.
 * CSS color-mix() 대신 rgba를 쓰는 이유는 html2canvas가 최신 색 함수를 못 읽기 때문이다.
 */
function scoreTint(score: number, rgb: string): string {
  const t = Math.max(0, Math.min(1, (score - 30) / 70));
  return `rgba(${rgb}, ${(0.06 + t * 0.36).toFixed(3)})`;
}

/** 명리를 모르는 사람을 위한 접이식 설명. 이미지 저장에는 넣지 않는다 */
function ElementHelp() {
  return (
    <details className="help" data-capture-hide>
      <summary>오행이 뭔가요?</summary>
      <table className="roles">
        <tbody>
          {ELEMENTS.map((e) => (
            <tr key={e}>
              <td>
                <b style={{ color: ELEMENT_COLOR[e] }}>{e}</b> <span className="tiny">{ELEMENT_MEANING[e].hanja}</span>
              </td>
              <td>
                {ELEMENT_MEANING[e].power}
                <div className="tip muted">{ELEMENT_MEANING[e].atWork}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tip muted">다섯 힘이 고르면 각 20%입니다. 한쪽이 지나치게 얇거나 두꺼우면 아래에 따로 짚어줍니다.</p>
    </details>
  );
}

function ScoreHelp() {
  return (
    <details className="help" data-capture-hide>
      <summary>점수는 어떻게 나오나요?</summary>
      <p>세 가지를 더해 100점으로 봅니다.</p>
      <table className="roles">
        <tbody>
          <tr>
            <td>일간 {SCORE_WEIGHT.dayStem}점</td>
            <td>태어난 날의 기운끼리 얼마나 결이 맞는가</td>
          </tr>
          <tr>
            <td>일지 {SCORE_WEIGHT.dayBranch}점</td>
            <td>같이 있을 때 편한가</td>
          </tr>
          <tr>
            <td>오행 보완 {SCORE_WEIGHT.complement}점</td>
            <td>서로의 빈 곳을 채워주는가</td>
          </tr>
        </tbody>
      </table>
      <p className="tip muted">
        낮은 점수가 &quot;안 맞는 사람&quot;을 뜻하지 않습니다. 방식이 다를수록 낮게 나오고, 그래서 서로 보완이 되기도 합니다. 최저는 {SCORE_WEIGHT.floor}
        점입니다.
      </p>
    </details>
  );
}

function ElementBars({ scores }: { scores: Record<Element, number> }) {
  const max = Math.max(...ELEMENTS.map((e) => scores[e]), 1);
  return (
    <div className="bars">
      {ELEMENTS.map((e) => (
        <div className="bar-col" key={e}>
          <em>{scores[e]}%</em>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(scores[e] / max) * 100}%`, background: ELEMENT_COLOR[e] }} />
          </div>
          <b>{e}</b>
        </div>
      ))}
    </div>
  );
}

function Finding({ kind, f }: { kind: '가장 약한 축' | '가장 두꺼운 축'; f: TeamDiagnosis['lack'] }) {
  return (
    <div className={`finding${f.notable ? ' notable' : ''}`}>
      <h4>
        {kind} · {f.element} {f.percent}% — {f.label}
        {f.notable && <span className="badge">주목</span>}
      </h4>
      <p>{f.text}</p>
      <p className="tip">팁: {f.tip}</p>
    </div>
  );
}

function PairDetail({ pair }: { pair: Compatibility }) {
  return (
    <div className="pair-detail stack">
      <div>
        <span className="pair-score">{pair.score}</span>
        <span className="muted"> / 100 · {pair.band}</span>
        <h3 style={{ marginTop: 2 }}>
          {pair.a} ↔ {pair.b}
        </h3>
      </div>
      {[pair.stem, pair.branch].map((part) => (
        <div className="finding" key={part.key}>
          <h4>{part.label}</h4>
          <p>{part.text}</p>
          <p className="tip">팁: {part.tip}</p>
        </div>
      ))}
      {pair.complement.notes.length > 0 && (
        <div className="finding">
          <h4>서로 채워주는 것</h4>
          {pair.complement.notes.map((n) => (
            <p key={n.element + n.filler}>{n.text}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamPanel({ teamName, codes, onChange }: { teamName: string; codes: string[]; onChange: (codes: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const accentRgb = useAccentRgb();

  async function saveImage() {
    if (!captureRef.current) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveElementAsPng(captureRef.current, captureFilename(teamName));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '이미지를 만들지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const parsed = useMemo(() => {
    const charts: Chart[] = [];
    const broken: { code: string; message: string }[] = [];
    for (const code of codes) {
      try {
        charts.push(decodeChart(code));
      } catch (e) {
        broken.push({ code, message: e instanceof BirthInputError ? e.message : '알 수 없는 코드' });
      }
    }
    return { charts, broken };
  }, [codes]);

  const diagnosis = useMemo(() => (parsed.charts.length ? diagnoseTeam(parsed.charts) : null), [parsed.charts]);

  function addDraft() {
    const added = draft
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!added.length) return;
    onChange([...codes, ...added.filter((c) => !codes.includes(c))]);
    setDraft('');
    setSelected(null);
  }

  function removeAt(index: number) {
    onChange(codes.filter((_, i) => i !== index));
    setSelected(null);
  }

  const selectedPair =
    diagnosis && selected
      ? (diagnosis.pairs.find((p) => p.a === diagnosis.members[selected[0]]?.name && p.b === diagnosis.members[selected[1]]?.name) ??
        diagnosis.pairs.find((p) => p.a === diagnosis.members[selected[1]]?.name && p.b === diagnosis.members[selected[0]]?.name))
      : null;

  return (
    <>
      <div className="card">
        <h2>팀원</h2>
        <p className="sub">각자 만든 팔자 코드를 붙여넣으세요. 여러 줄을 한 번에 넣을 수 있습니다.</p>

        {diagnosis && (
          <div className="member-list" style={{ marginBottom: 14 }}>
            {diagnosis.members.map((m, i) => (
              <div className="member" key={`${m.name}-${i}`}>
                <span className="name">{m.name}</span>
                {m.jobLabel && <span className="job-tag">{m.jobLabel}</span>}
                <span className="gz">{chartToKorean(m.chart)}</span>
                <span className="role">{m.role.role}</span>
                <button className="btn danger" type="button" onClick={() => removeAt(i)} aria-label={`${m.name} 삭제`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {parsed.broken.map((b) => (
          <div className="error" key={b.code} style={{ marginBottom: 8 }}>
            읽을 수 없는 코드: <b>{b.code}</b> — {b.message}
          </div>
        ))}

        <label className="field">
          코드 붙여넣기
          <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={'지영|庚午辛巳庚辰壬午\n현우|癸酉壬戌戊子丁巳'} />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" type="button" onClick={addDraft} disabled={!draft.trim()}>
            팀원 추가
          </button>
          {codes.length > 0 && (
            <button
              className="btn ghost small"
              type="button"
              onClick={() => {
                onChange([]);
                setSelected(null);
              }}
            >
              전체 비우기
            </button>
          )}
        </div>
      </div>

      {!diagnosis && (
        <div className="card">
          <p className="muted">팀원을 한 명 이상 추가하면 진단이 나옵니다.</p>
        </div>
      )}

      {diagnosis && (
        <>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn small ghost" type="button" onClick={saveImage} disabled={saving}>
              {saving ? '만드는 중…' : '이미지로 저장'}
            </button>
          </div>
          {saveError && (
            <div className="error" style={{ marginTop: 10 }}>
              {saveError}
            </div>
          )}

          <div ref={captureRef}>
            <div className="card capture-head">
              <h2>{teamName}</h2>
              <p className="sub" style={{ marginBottom: 0 }}>
                {diagnosis.members.map((m) => m.name).join(' · ')} · {new Date().toLocaleDateString('ko-KR')}
              </p>
            </div>

            <div className="card">
              <h2>팀 오행</h2>
              <p className="sub">팀원 각자의 비율을 평균낸 값입니다. 1인 1표로 계산합니다.</p>
              <ElementBars scores={diagnosis.elements} />
              <ElementHelp />
              <div className="stack" style={{ marginTop: 18 }}>
                <Finding kind="가장 약한 축" f={diagnosis.lack} />
                <Finding kind="가장 두꺼운 축" f={diagnosis.excess} />
              </div>
            </div>

            {diagnosis.pairs.length > 0 && (
              <div className="card">
                <h2>페어 매트릭스</h2>
                <p className="sub">평균 {diagnosis.averageScore}점. 칸을 누르면 그 조합의 상세가 나옵니다.</p>
                <div className="matrix-wrap">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th className="corner" />
                        {diagnosis.members.map((m) => (
                          <th key={m.index} scope="col">
                            {m.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diagnosis.matrix.map((row, i) => (
                        <tr key={i}>
                          <th scope="row">{diagnosis.members[i]!.name}</th>
                          {row.map((score, j) => (
                            <td key={j} className={score === null ? 'self' : ''}>
                              {score === null ? (
                                '·'
                              ) : (
                                <button
                                  type="button"
                                  style={{ background: scoreTint(score, accentRgb) }}
                                  aria-pressed={!!selected && selected[0] === i && selected[1] === j}
                                  onClick={() => setSelected([i, j])}
                                >
                                  {score}
                                </button>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="legend">
                  <span className="tiny">30</span>
                  {[30, 47, 64, 81, 100].map((s) => (
                    <i key={s} style={{ background: scoreTint(s, accentRgb) }} />
                  ))}
                  <span className="tiny">100</span>
                </div>

                <ScoreHelp />
                <div className="stack" style={{ marginTop: 18 }}>
                  {selectedPair ? (
                    <PairDetail pair={selectedPair} />
                  ) : (
                    <>
                      <PairDetail pair={diagnosis.bestPair!} />
                      {diagnosis.hardestPair && diagnosis.hardestPair !== diagnosis.bestPair && <PairDetail pair={diagnosis.hardestPair} />}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="card">
              <h2>역할</h2>
              <p className="sub">각자 가장 두꺼운 십성 그룹에서 나온 추천입니다.</p>
              <table className="roles">
                <tbody>
                  {GOD_FAMILIES.map((f) => {
                    const who = diagnosis.roleCoverage[f];
                    return (
                      <tr key={f}>
                        <td>{ROLE_BY_FAMILY[f].role}</td>
                        <td className={who.length ? '' : 'empty'}>
                          {who.length ? <b>{who.join(', ')}</b> : '—'}
                          <div className="tip muted">{ROLE_BY_FAMILY[f].text}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {diagnosis.roleGaps.length > 0 && (
                <div className="stack" style={{ marginTop: 18 }}>
                  {diagnosis.roleGaps.map((g) => (
                    <div className="finding notable" key={g.family}>
                      <h4>비어 있음 · {g.role}</h4>
                      <p>{g.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {diagnosis.jobGroups.length > 0 && (
              <div className="card">
                <h2>직무</h2>
                <p className="sub">직무는 각자 고른 값입니다. 사주로 직무를 추천하지 않습니다.</p>

                <table className="roles">
                  <tbody>
                    {diagnosis.jobGroups.map((g) => (
                      <tr key={g.job}>
                        <td>{g.label}</td>
                        <td>
                          <b>{g.members.join(', ')}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="stack" style={{ marginTop: 18 }}>
                  {diagnosis.members
                    .filter((m) => m.jobStyle)
                    .map((m) => (
                      <div className="finding" key={m.index}>
                        <h4>
                          {m.name}{' '}
                          <span className="tiny">
                            {m.jobLabel} · {m.role.role}
                          </span>
                        </h4>
                        <p>{m.jobStyle}</p>
                      </div>
                    ))}

                  {diagnosis.jobOverlaps.map((o) => (
                    <div className="finding notable" key={`${o.job}-${o.family}`}>
                      <h4>
                        겹침 · {o.label}에 {ROLE_BY_FAMILY[o.family].role} 성향이 둘 이상
                        <span className="badge">주목</span>
                      </h4>
                      <p className="tip">
                        {o.members.join(', ')} — {o.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="disclaimer">{diagnosis.disclaimer}</p>
          </div>
        </>
      )}
    </>
  );
}
