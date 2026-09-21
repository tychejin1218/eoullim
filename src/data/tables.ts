/**
 * 명리 기본 상수 테이블 — 천간 · 지지 · 오행 · 십성
 *
 * 전부 닫힌 집합이라 유니온 타입 + Record 로 묶는다.
 * 키가 하나라도 빠지면 컴파일 단계에서 걸린다.
 */

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type Element = '목' | '화' | '토' | '금' | '수';
export type Polarity = '양' | '음';
/**
 * 십성(十星). 일간(나)에서 본 상대 천간의 관계를 열 가지로 나눈 것.
 * 다섯 그룹(GodFamily)이 각각 음양으로 갈려 5 × 2 = 10이 된다.
 */
export type TenGod = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

/**
 * 십성을 다섯으로 묶은 그룹. **일간(나)을 기준으로 상대가 어느 방향에 있느냐**가 전부다.
 * 오행이 다섯이라 방향도 다섯이다.
 *
 * | 그룹 | 나와의 관계   | 화면에 보이는 이름 (ROLE_BY_FAMILY) |
 * |------|---------------|--------------------------------------|
 * | 비겁 | 나와 같은 오행 | 직접 끌고 가는 쪽                    |
 * | 식상 | 내가 낳는 것   | 꺼내고 알리는 쪽                     |
 * | 재성 | 내가 이기는 것 | 굴러가게 만드는 쪽                   |
 * | 관성 | 나를 이기는 것 | 기준을 지키는 쪽                     |
 * | 인성 | 나를 낳는 것   | 깊이 파는 쪽                         |
 *
 * 예) 일간이 庚(금)이면 — 금=비겁, 수=식상(금생수), 목=재성(금극목),
 *     화=관성(화극금), 토=인성(토생금)
 *
 * 이 한자어는 **사용자 화면에 노출하지 않는다.** 항상 ROLE_BY_FAMILY 의 라벨로 바꿔 보여준다.
 * 판정 로직은 core/tenGods.ts 의 tenGod(), 묶는 표는 아래 GOD_FAMILY.
 */
export type GodFamily = '비겁' | '식상' | '재성' | '관성' | '인성';
export type PillarLabel = '년주' | '월주' | '일주' | '시주';

/**
 * 직무. 사주로 추천하는 게 아니라 **사용자가 직접 고르는 입력**이다.
 * 십성이 "어떻게 일하는가"라면 직무는 "무엇을 하는가"로, 두 축을 겹쳐 본다.
 *
 * 값이 곧 팔자 코드에 실리는 약어이므로 한 번 정하면 바꾸지 않는다.
 */
export type Job = 'PM' | 'PL' | 'DS' | 'FE' | 'BE' | 'QA' | 'ET';

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const ELEMENTS = ['목', '화', '토', '금', '수'] as const;
export const GOD_FAMILIES = ['비겁', '식상', '재성', '관성', '인성'] as const;
export const JOBS = ['PM', 'PL', 'DS', 'FE', 'BE', 'QA', 'ET'] as const;

export interface StemInfo {
  ko: string;
  element: Element;
  polarity: Polarity;
}

export const STEM: Record<Stem, StemInfo> = {
  甲: { ko: '갑', element: '목', polarity: '양' },
  乙: { ko: '을', element: '목', polarity: '음' },
  丙: { ko: '병', element: '화', polarity: '양' },
  丁: { ko: '정', element: '화', polarity: '음' },
  戊: { ko: '무', element: '토', polarity: '양' },
  己: { ko: '기', element: '토', polarity: '음' },
  庚: { ko: '경', element: '금', polarity: '양' },
  辛: { ko: '신', element: '금', polarity: '음' },
  壬: { ko: '임', element: '수', polarity: '양' },
  癸: { ko: '계', element: '수', polarity: '음' },
};

export interface BranchInfo {
  ko: string;
  element: Element;
  /** 지장간. [0]이 본기(本氣) — 가장 강한 기운 */
  hidden: readonly [Stem, ...Stem[]];
}

export const BRANCH: Record<Branch, BranchInfo> = {
  子: { ko: '자', element: '수', hidden: ['癸'] },
  丑: { ko: '축', element: '토', hidden: ['己', '癸', '辛'] },
  寅: { ko: '인', element: '목', hidden: ['甲', '丙', '戊'] },
  卯: { ko: '묘', element: '목', hidden: ['乙'] },
  辰: { ko: '진', element: '토', hidden: ['戊', '乙', '癸'] },
  巳: { ko: '사', element: '화', hidden: ['丙', '戊', '庚'] },
  午: { ko: '오', element: '화', hidden: ['丁', '己'] },
  未: { ko: '미', element: '토', hidden: ['己', '丁', '乙'] },
  申: { ko: '신', element: '금', hidden: ['庚', '壬', '戊'] },
  酉: { ko: '유', element: '금', hidden: ['辛'] },
  戌: { ko: '술', element: '토', hidden: ['戊', '辛', '丁'] },
  亥: { ko: '해', element: '수', hidden: ['壬', '甲'] },
};

/** 상생: 이 오행이 낳는 오행 (목生화) */
export const GENERATES: Record<Element, Element> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목',
};

/** 상극: 이 오행이 누르는 오행 (목剋토) */
export const CONTROLS: Record<Element, Element> = {
  목: '토',
  화: '금',
  토: '수',
  금: '목',
  수: '화',
};

/** 역상생: 이 오행을 낳아주는 오행 (화 ← 목) */
export const GENERATED_BY: Record<Element, Element> = {
  화: '목',
  토: '화',
  금: '토',
  수: '금',
  목: '수',
};

/** 십성 → 그룹. 각 그룹은 음양이 같을 때와 다를 때로 갈린다 (비견/겁재, 식신/상관 …) */
export const GOD_FAMILY: Record<TenGod, GodFamily> = {
  비견: '비겁',
  겁재: '비겁',
  식신: '식상',
  상관: '식상',
  편재: '재성',
  정재: '재성',
  편관: '관성',
  정관: '관성',
  편인: '인성',
  정인: '인성',
};

export const ELEMENT_COLOR: Record<Element, string> = {
  목: '#7db68a',
  화: '#ed806f',
  토: '#d8ab64',
  금: '#989da8',
  수: '#69a5cc',
};

export function isStem(v: string): v is Stem {
  return (STEMS as readonly string[]).includes(v);
}

export function isBranch(v: string): v is Branch {
  return (BRANCHES as readonly string[]).includes(v);
}

export function isJob(v: string): v is Job {
  return (JOBS as readonly string[]).includes(v);
}

/** 甲子 → '갑자' */
export function toKorean(stem: Stem, branch: Branch): string {
  return `${STEM[stem].ko}${BRANCH[branch].ko}`;
}
