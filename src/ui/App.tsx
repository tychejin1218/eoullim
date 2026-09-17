import { useState } from 'react';

import { BirthForm } from './BirthForm';
import { TeamPanel } from './TeamPanel';
import { useTeams } from './useTeams';

type Tab = 'me' | 'team';

export function App() {
  const [tab, setTab] = useState<Tab>('me');
  const { teams, active, activeId, setActiveId, createTeam, removeTeam, renameTeam, setCodes } = useTeams();

  function addToTeam(code: string) {
    const team = active ?? createTeam('우리 팀');
    if (!team.codes.includes(code)) setCodes(team.id, [...team.codes, code]);
    setTab('team');
  }

  return (
    <div className="app">
      <header className="masthead">
        <h1>어울림</h1>
        <p>팀원들의 사주로 협업 성향과 역할을 살펴봅니다.</p>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'me'} onClick={() => setTab('me')}>
          내 코드 만들기
        </button>
        <button role="tab" aria-selected={tab === 'team'} onClick={() => setTab('team')}>
          팀 보기{active ? ` (${active.codes.length})` : ''}
        </button>
      </div>

      {tab === 'me' && <BirthForm onAdd={addToTeam} />}

      {tab === 'team' && (
        <>
          <div className="card">
            <h2>팀</h2>
            <p className="sub">이 브라우저에만 저장됩니다. 팀을 여러 개 만들어 비교할 수 있습니다.</p>
            <div className="row">
              {teams.length > 0 && (
                <select value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value)} style={{ width: 'auto', minWidth: 180 }} aria-label="팀 선택">
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.codes.length}명)
                    </option>
                  ))}
                </select>
              )}
              <button className="btn small ghost" type="button" onClick={() => createTeam(`팀 ${teams.length + 1}`)}>
                새 팀
              </button>
              {active && (
                <>
                  <button
                    className="btn small ghost"
                    type="button"
                    onClick={() => {
                      const name = prompt('팀 이름', active.name);
                      if (name?.trim()) renameTeam(active.id, name.trim());
                    }}
                  >
                    이름 바꾸기
                  </button>
                  <button
                    className="btn small ghost"
                    type="button"
                    onClick={() => {
                      if (confirm(`'${active.name}' 팀을 지울까요?`)) removeTeam(active.id);
                    }}
                  >
                    팀 삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {active ? (
            <TeamPanel teamName={active.name} codes={active.codes} onChange={(codes) => setCodes(active.id, codes)} />
          ) : (
            <div className="card">
              <p className="muted">새 팀을 만들어 시작하세요.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
