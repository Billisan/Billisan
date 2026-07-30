import type { AiInspectionResult, SlotSummary } from '@/features/stations/types';

/**
 * 슬롯 하나의 AI 보조 결과를 되짚는 순수 함수.
 *
 * 검수 목록·검수 상세·슬롯 상세가 **같은 슬롯에 같은 값**을 보여야 합니다.
 * 화면마다 따로 상수를 박아 두면 "AI 는 0.92 라는데 검수 화면은 0.87" 같은 어긋남이 생깁니다.
 *
 * 여기서 만드는 건 AI 결과(`InspectionResult`)일 뿐, 슬롯 상태도 관리자 판정도 아닙니다.
 * `DAMAGED` 가 나와도 파손이 확정되지 않습니다.
 *
 * TODO: 실 API 연동 시 이 파일을 지우세요. 값은 서버가 줍니다.
 */

/**
 * 미처리 검수의 AI 결과 분포.
 *
 * `NORMAL` 은 넣지 않습니다. AI 가 정상으로 본 반납은 관리자 검수로 넘어오지 않습니다.
 */
const PENDING_RESULTS: AiInspectionResult[] = ['DAMAGED', 'UNCERTAIN', 'UNCERTAIN', 'FAILED'];

/** slotId 글자에서 만든 고정 씨앗. 새로고침해도 값이 흔들리지 않습니다. */
function seedOf(slotId: string): number {
    return [...slotId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

/** AI 모델 버전. `EDGE-INSPECT-001` 예시의 값입니다. */
export const MODEL_VERSION = 'damage-model-v1';

export function aiResultOf(slot: SlotSummary, decided: boolean): AiInspectionResult {
    // 파손으로 확정된 슬롯은 AI 도 파손을 의심했던 건입니다.
    if (slot.itemCondition === 'DAMAGED' || slot.itemCondition === 'REPAIRABLE') return 'DAMAGED';
    // 검수가 끝났는데 슬롯이 멀쩡하면 AI 오탐이었다는 뜻입니다.
    if (decided) return 'DAMAGED';

    return PENDING_RESULTS[seedOf(slot.slotId) % PENDING_RESULTS.length];
}

/** 추론 점수. `FAILED` 는 추론이 끝나지 않아 점수 자체가 없습니다. */
export function aiScoreOf(slot: SlotSummary, decided: boolean): number | null {
    if (aiResultOf(slot, decided) === 'FAILED') return null;

    const base = aiResultOf(slot, decided) === 'DAMAGED' ? 0.84 : 0.52;
    return Math.round((base + (seedOf(slot.slotId) % 12) / 100) * 100) / 100;
}

/** 점수 표시. 없는 값을 0.00 으로 채우지 않습니다. */
export function formatScore(score: number | null): string {
    return score === null ? '—' : score.toFixed(2);
}

/** 이력 줄의 회색 보조 문구. 같은 슬롯이면 어느 화면에서든 같은 문장이 나옵니다. */
export function aiNoteOf(result: AiInspectionResult, score: number | null): string {
    return `AI 참고 결과 ${result} ${formatScore(score)} · 자동 확정 아님`;
}
