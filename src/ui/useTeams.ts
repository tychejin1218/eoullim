import { useCallback, useEffect, useState } from 'react';

export interface Team {
  id: string;
  name: string;
  /** 팔자 코드 목록. 생년월일은 저장하지 않는다 */
  codes: string[];
}

const STORAGE_KEY = 'eoullim.teams.v1';

const newId = () => Math.random().toString(36).slice(2, 10);

function load(): Team[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is Team =>
        !!t && typeof t === 'object' && typeof (t as Team).id === 'string' && typeof (t as Team).name === 'string' && Array.isArray((t as Team).codes),
    );
  } catch {
    // 저장소가 막혀 있거나 값이 깨졌으면 빈 상태로 시작한다
    return [];
  }
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>(load);
  const [activeId, setActiveId] = useState<string | null>(() => load()[0]?.id ?? null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
    } catch {
      // 저장 실패해도 화면은 계속 동작한다
    }
  }, [teams]);

  const active = teams.find((t) => t.id === activeId) ?? null;

  const createTeam = useCallback((name: string) => {
    const team: Team = { id: newId(), name: name.trim() || '새 팀', codes: [] };
    setTeams((prev) => [...prev, team]);
    setActiveId(team.id);
    return team;
  }, []);

  const removeTeam = useCallback((id: string) => {
    setTeams((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveId((current) => (current === id ? (next[0]?.id ?? null) : current));
      return next;
    });
  }, []);

  const renameTeam = useCallback((id: string, name: string) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const setCodes = useCallback((id: string, codes: string[]) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, codes } : t)));
  }, []);

  return { teams, active, activeId, setActiveId, createTeam, removeTeam, renameTeam, setCodes };
}
