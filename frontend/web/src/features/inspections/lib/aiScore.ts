import type { AiInspectionResult } from '@/features/stations/types';

/**
 * AI 추론 결과 표시 도우미.
 *
 * **목업이 아닙니다.** 예전에는 `mocks/aiVerdict.ts` 안에 값 생성기와 함께 있었는데,
 * 그 파일은 "실 API 연동 시 지우세요" 대상이라 지우는 순간 검수 상세·슬롯 상세가
 * 깨집니다. 값은 서버가 주더라도 **표시 방식은 우리 것**이라 여기 남깁니다.
 */

/** 점수 표시. 없는 값을 `0.00` 으로 채우지 않습니다 — 추론 실패와 0점은 다릅니다. */
export function formatScore(score: number | null): string {
    return score === null ? '—' : score.toFixed(2);
}

/** 이력 줄의 회색 보조 문구. 같은 검수면 어느 화면에서든 같은 문장이 나옵니다. */
export function aiNoteOf(result: AiInspectionResult, score: number | null): string {
    return `AI 참고 결과 ${result} ${formatScore(score)} · 자동 확정 아님`;
}
