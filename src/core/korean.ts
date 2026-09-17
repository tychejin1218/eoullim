/**
 * 한국어 조사 처리
 *
 * 문장 템플릿에 이름을 끼워 넣으면 "지영가 달린다" 같은 게 나온다.
 * 앞 글자의 받침에 따라 조사를 골라준다.
 */

/** 짝이 되는 조사. [받침 있을 때, 받침 없을 때] */
const PARTICLE_PAIRS: Record<string, readonly [string, string]> = {
  이: ['이', '가'],
  가: ['이', '가'],
  은: ['은', '는'],
  는: ['은', '는'],
  을: ['을', '를'],
  를: ['을', '를'],
  과: ['과', '와'],
  와: ['과', '와'],
  아: ['아', '야'],
  야: ['아', '야'],
  으로: ['으로', '로'],
  로: ['으로', '로'],
};

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
/** ㄹ 받침은 '으로'가 아니라 '로'를 쓴다 */
const JONGSEONG_RIEUL = 8;

function jongseongOf(word: string): number | null {
  const code = word.charCodeAt(word.length - 1);
  if (code < HANGUL_START || code > HANGUL_END) return null;
  return (code - HANGUL_START) % 28;
}

/** 마지막 글자에 받침이 있는가. 한글이 아니면 영문 자음/숫자로 어림잡는다. */
export function hasFinalConsonant(word: string): boolean {
  const jong = jongseongOf(word);
  if (jong !== null) return jong !== 0;

  const last = word.slice(-1).toLowerCase();
  if (/[0-9]/.test(last)) return !'2459'.includes(last); // 이·사·오·구는 받침 없음
  if (/[a-z]/.test(last)) return !'aeiou'.includes(last);
  return false;
}

/** '지영' + '가' → '지영이' */
export function withParticle(word: string, particle: string): string {
  const pair = PARTICLE_PAIRS[particle];
  if (!pair) return word + particle;

  // '로/으로'만 ㄹ 받침을 예외로 둔다
  if (particle === '로' || particle === '으로') {
    const jong = jongseongOf(word);
    if (jong === JONGSEONG_RIEUL) return `${word}로`;
  }
  return word + (hasFinalConsonant(word) ? pair[0] : pair[1]);
}

const PARTICLE_PATTERN = /\{([AB])\}(으로|[이가은는을를과와아야로])?/g;

/** 템플릿의 {A}·{B}를 이름으로 바꾸고, 뒤에 붙은 조사를 받침에 맞춰 고친다. */
export function fillNames(template: string, a: string, b: string): string {
  return template.replace(PARTICLE_PATTERN, (_match, who: string, particle?: string) => {
    const name = who === 'A' ? a : b;
    return particle ? withParticle(name, particle) : name;
  });
}
