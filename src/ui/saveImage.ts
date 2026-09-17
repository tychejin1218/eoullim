import html2canvas from 'html2canvas';

/** 캡처에서 빼고 싶은 요소에 붙이는 표시 */
export const HIDE_ON_CAPTURE = 'data-capture-hide';

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * 화면 일부를 PNG로 저장한다.
 *
 * html2canvas는 2022년 라이브러리라 color-mix()·oklab() 같은 최신 색 함수를
 * 읽지 못한다. 그래서 매트릭스 색은 CSS가 아니라 JS에서 rgba로 만든다
 * (scoreTint 참고). 여기서는 잘림만 풀어주면 된다.
 */
export async function saveElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: cssVar('--bg', '#ffffff'),
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (doc) => {
      doc.querySelectorAll<HTMLElement>(`[${HIDE_ON_CAPTURE}]`).forEach((node) => {
        node.style.display = 'none';
      });
      // 가로 스크롤 영역이 잘리지 않도록
      doc.querySelectorAll<HTMLElement>('.matrix-wrap').forEach((node) => {
        node.style.overflow = 'visible';
      });
    },
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('이미지를 만들지 못했습니다.');

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 어울림-우리 팀-20260917.png */
export function captureFilename(teamName: string): string {
  const now = new Date();
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  const safe = teamName.replace(/[\\/:*?"<>|]/g, '').trim() || '팀';
  return `어울림-${safe}-${stamp}.png`;
}
