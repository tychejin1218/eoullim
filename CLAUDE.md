# CLAUDE.md

어울림(eoullim) — 팀원 사주로 협업 성향·역할을 진단하는 사내 도구
Vite + React 19 + TypeScript 6

배경·근거 설명은 @README.md, 사용자 관점 설명은 @docs/GUIDE.md 에 있다.
이 문서는 **코드를 고칠 때 지켜야 할 규칙만** 담는다.

## Commands

```bash
npm run dev         # 개발 서버 (5173)
npm run check       # tsc + eslint + vitest — 커밋 전 이것만 돌리면 된다
npm test            # Vitest (report.txt / report-team.txt 갱신)
npm run lint:fix    # ESLint 자동 수정
npm run build       # tsc -b && vite build
```

## Architecture

```
src/core/   순수 계산. DOM 의존 금지.        @.claude/rules/core-rules.md
src/data/   상수 테이블 + 해석 문장 corpus   @.claude/rules/corpus-rules.md
src/ui/     React 컴포넌트
test/       core/ 와 1:1 대응 + 분포 가드
```

`BirthInput → buildChart → Chart → compatibility / diagnoseTeam → UI`

## IMPORTANT

- **사람을 평가하는 표현을 만들지 않는다.** 아이스브레이킹 도구이며, 업무 배정·평가 근거로 읽히면 안 된다.
- **생년월일시를 브라우저 밖으로 내보내지 않는다.** 공유 단위는 팔자 코드뿐이고, `decodeChart()`로 복원한 Chart에는 `birth`가 없어야 한다. 서버·로그·분석 도구 어디에도 보내지 않는다.
- **시각을 12시진으로 묶지 않는다.** `hour`/`minute`를 그대로 받는다.
- **진태양시 보정 표를 하드코딩하지 않는다.** IANA tzdata에서 조회한다.
- **점수 바닥 30점(`SCORE_WEIGHT.floor`)을 없애지 않는다.**
- 가중치·임계값을 바꾸면 `test/distribution.test.ts`를 돌린다. 깨지면 실제 표본으로 재튜닝한다.
- **직무(`Job`)는 사용자가 고르는 입력이다. 사주로 직무를 추천하지 않는다.**
  "당신은 PM 체질" 같은 출력은 직무 적합성 판정이 되어 사람 평가로 읽힌다.
  십성은 "어떻게 일하는가", 직무는 "무엇을 하는가"로 두 축을 겹쳐 보기만 한다.
- 팔자 코드에 직무는 **선택적 꼬리표**다. 직무 없는 옛 코드도 계속 읽혀야 한다.
- 계산 로직은 `src/core/`에만 둔다. UI에서 점수·오행을 직접 계산하지 않는다.
- 사용자에게 보일 명리 용어는 `ELEMENT_MEANING` 등 corpus의 설명을 쓴다. 화면과 문서가 같은 원본을 본다.
- **Path alias `@/` → `src/`.** 디렉토리를 넘어가면 `@/`, 같은 디렉토리 안은 상대경로(`./X`).
  `tsconfig.json`의 `paths`와 `vite.config.ts`의 `resolve.alias`를 **항상 같이** 고친다 (한쪽만 고치면 타입은 통과하고 런타임에서 깨진다).
- `typescript-eslint`가 TS 7을 지원하지 않는다. **TypeScript는 6.x 고정.**
- 한국어 주석. 주석은 "무엇"이 아니라 "왜"를 적는다.

## Git

- **커밋 메시지에 `Co-Authored-By: Claude ...` 등 AI 공동작성자 표기를 넣지 않는다.**
  PR 본문의 생성 표기도 마찬가지로 넣지 않는다.
