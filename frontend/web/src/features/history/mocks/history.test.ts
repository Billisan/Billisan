import { describe, expect, it } from 'vitest';

import {
    MOCK_RENTALS,
    MOCK_RETURNS,
    MOCK_SETTLEMENTS,
    findRental,
    findReturn,
    findSettlement,
} from '@/features/history/mocks/history';
import { findInspection } from '@/features/inspections/mocks/inspections';
import { findStation } from '@/features/stations/mocks/stations';

/**
 * 목업 데이터 정합성.
 *
 * **이게 이 파일의 존재 이유입니다.** 지금까지 이 규칙들을 브라우저로 60개 화면을 돌며
 * 눈으로 확인했고, 실제로 매번 깨진 걸 찾아냈습니다 — 없는 대여를 가리키는 반납 10건,
 * 미처리 검수에 붙은 파손 정산, AI 가 정상이라는데 관리자 검수가 걸린 반납.
 *
 * 목업이지만 규칙 자체는 목업 것이 아닙니다. 계약·ERD 가 정한 불변조건이라 실 API 로
 * 바뀌어도 그대로 남습니다. 그때는 이 파일이 목업 대신 응답 픽스처를 검사하면 됩니다.
 */

const rentalIds = new Set(MOCK_RENTALS.map((item) => item.rentalId));
const returnIds = new Set(MOCK_RETURNS.map((item) => item.returnAttemptId));
const settlementIds = new Set(MOCK_SETTLEMENTS.map((item) => item.settlementId));

describe('참조 무결성 — 화면에서 눌렀을 때 빈 화면이 나오지 않는다', () => {
    it('대여가 가리키는 반납·정산이 모두 존재한다', () => {
        for (const rental of MOCK_RENTALS) {
            if (rental.returnAttemptId) {
                expect(returnIds, `대여 ${rental.rentalId} → 반납`).toContain(
                    rental.returnAttemptId,
                );
            }
            if (rental.settlementId) {
                expect(settlementIds, `대여 ${rental.rentalId} → 정산`).toContain(
                    rental.settlementId,
                );
            }
        }
    });

    it('반납이 가리키는 대여·정산·검수가 모두 존재한다', () => {
        for (const attempt of MOCK_RETURNS) {
            expect(rentalIds, `반납 ${attempt.returnAttemptId} → 대여`).toContain(attempt.rentalId);

            if (attempt.settlementId) {
                expect(settlementIds, `반납 ${attempt.returnAttemptId} → 정산`).toContain(
                    attempt.settlementId,
                );
            }
            if (attempt.inspectionId) {
                expect(
                    findInspection(attempt.inspectionId),
                    `반납 ${attempt.returnAttemptId} → 검수 ${attempt.inspectionId}`,
                ).toBeDefined();
            }
        }
    });

    it('정산이 가리키는 대여·반납이 모두 존재한다', () => {
        for (const item of MOCK_SETTLEMENTS) {
            expect(rentalIds, `정산 ${item.settlementId} → 대여`).toContain(item.rentalId);
            if (item.returnAttemptId) {
                expect(settlementIds.size).toBeGreaterThan(0);
                expect(returnIds, `정산 ${item.settlementId} → 반납`).toContain(
                    item.returnAttemptId,
                );
            }
        }
    });

    it('모든 행이 실재하는 대여소를 가리킨다', () => {
        for (const rental of MOCK_RENTALS) {
            expect(findStation(rental.stationId), `대여 ${rental.rentalId}`).toBeDefined();
        }
        for (const attempt of MOCK_RETURNS) {
            expect(findStation(attempt.stationId), `반납 ${attempt.returnAttemptId}`).toBeDefined();
        }
    });

    it('한 반납이 두 대여에 붙어 있지 않다', () => {
        // 실제로 이런 건이 하나 있었습니다. 대여 두 곳에서 같은 반납으로 가는데
        // 반납은 한쪽만 가리켜서, 다른 쪽은 왕복이 끊겼습니다.
        const owners = new Map<string, string[]>();
        for (const rental of MOCK_RENTALS) {
            if (!rental.returnAttemptId) continue;
            owners.set(rental.returnAttemptId, [
                ...(owners.get(rental.returnAttemptId) ?? []),
                rental.rentalId,
            ]);
        }
        for (const [attemptId, holders] of owners) {
            expect(holders, `반납 ${attemptId} 를 가리키는 대여`).toHaveLength(1);
        }
    });

    it('대여 ↔ 반납 연결이 양방향으로 맞는다', () => {
        for (const rental of MOCK_RENTALS) {
            if (!rental.returnAttemptId) continue;
            const attempt = findReturn(rental.returnAttemptId);
            expect(attempt?.rentalId, `반납 ${rental.returnAttemptId} 의 역방향`).toBe(
                rental.rentalId,
            );
        }
    });

    it('ID 에 중복이 없다', () => {
        expect(rentalIds.size).toBe(MOCK_RENTALS.length);
        expect(returnIds.size).toBe(MOCK_RETURNS.length);
        expect(settlementIds.size).toBe(MOCK_SETTLEMENTS.length);
    });
});

describe('AI 결과와 관리자 검수는 짝이 맞는다', () => {
    it('AI 가 정상으로 본 반납은 관리자 검수로 넘어오지 않는다', () => {
        /*
         * 검수는 AI 가 정상이 아니라고 본 건만 생깁니다. 정상인데 검수가 걸려 있으면
         * 화면에서 "왜 이게 검수 대기인지" 를 설명할 수 없습니다.
         */
        for (const attempt of MOCK_RETURNS.filter((item) => item.aiResult === 'NORMAL')) {
            expect(attempt.reviewStatus, `반납 ${attempt.returnAttemptId}`).toBeNull();
            expect(attempt.inspectionId, `반납 ${attempt.returnAttemptId}`).toBeNull();
        }
    });

    it('AI 가 정상이 아니라고 본 반납은 관리자가 봐야 한다', () => {
        // ERD §9.2-6: DAMAGED·UNCERTAIN·FAILED 는 ADMIN_REVIEW 로 격리된다.
        for (const attempt of MOCK_RETURNS.filter((item) => item.aiResult !== 'NORMAL')) {
            expect(attempt.reviewStatus, `반납 ${attempt.returnAttemptId}`).not.toBeNull();
        }
    });

    it('슬롯이 있는 검수 대상 반납은 실재하는 검수를 가리킨다', () => {
        /*
         * 슬롯이 없는 반납만 예외입니다. ERD §9.2-2 는 AI 결과를 슬롯 배정보다 먼저
         * `DAMAGE_INSPECTION` 에 저장하므로 실제 서버에는 슬롯 없는 검수 행이 있지만,
         * 이 목업의 검수는 슬롯에서 파생되어 그 경우를 만들 수 없습니다.
         */
        for (const attempt of MOCK_RETURNS.filter(
            (item) => item.aiResult !== 'NORMAL' && item.slotId !== null,
        )) {
            expect(attempt.inspectionId, `반납 ${attempt.returnAttemptId}`).not.toBeNull();
        }
    });

    it('검수 처리 상태가 그 검수의 상태와 같다', () => {
        // 반납 목록의 검수 칸과 검수 상세가 어긋나면 어느 쪽을 믿어야 할지 알 수 없습니다.
        for (const attempt of MOCK_RETURNS.filter((item) => item.inspectionId !== null)) {
            const inspection = findInspection(attempt.inspectionId ?? undefined);
            expect(inspection?.reviewStatus, `반납 ${attempt.returnAttemptId}`).toBe(
                attempt.reviewStatus,
            );
        }
    });

    it('한 검수가 두 반납에 붙어 있지 않다', () => {
        const used = MOCK_RETURNS.map((item) => item.inspectionId).filter(
            (id): id is string => id !== null,
        );
        expect(new Set(used).size).toBe(used.length);
    });

    it('추론이 실패한 건은 점수가 없다', () => {
        // 12-R 이 aiScore 를 Decimal|null 로 정했습니다. 실패했는데 점수가 있으면 모순입니다.
        for (const attempt of MOCK_RETURNS) {
            if (attempt.aiResult === 'FAILED') {
                expect(attempt.aiScore, `반납 ${attempt.returnAttemptId}`).toBeNull();
            } else {
                expect(attempt.aiScore, `반납 ${attempt.returnAttemptId}`).not.toBeNull();
            }
        }
    });
});

describe('자동 과금 금지', () => {
    it('검수가 미처리인 반납에는 정산이 붙지 않는다', () => {
        /*
         * ERD §8.0: "DAMAGED|UNCERTAIN|FAILED 추론은 자동 파손 확정이나 자동 과금이 아니다"
         * EDGE-INSPECT-001: "메타데이터만 저장; 자동 과금 금지"
         * 파손 정산은 ADMIN-INSPECTION-003 이 DAMAGED 로 판정할 때만 생깁니다.
         *
         * 실제로 여기 위반이 하나 있었습니다 — 미처리 검수 건에 ₩7,000 파손 정산이
         * 붙어 있어서, AI 점수만으로 돈을 물린 화면이 됐습니다.
         */
        for (const attempt of MOCK_RETURNS.filter((item) => item.reviewStatus === 'PENDING')) {
            expect(attempt.settlementId, `반납 ${attempt.returnAttemptId}`).toBeNull();
        }
    });

    it('파손 정산은 판정이 끝난 반납에만 붙는다', () => {
        for (const item of MOCK_SETTLEMENTS.filter((s) => s.reason === 'DAMAGE')) {
            if (!item.returnAttemptId) continue;
            const attempt = findReturn(item.returnAttemptId);
            expect(attempt?.reviewStatus, `정산 ${item.settlementId}`).toBe('DECIDED');
        }
    });

    it('파손 정산에는 판정 사유가 있다', () => {
        for (const item of MOCK_SETTLEMENTS.filter((s) => s.reason === 'DAMAGE')) {
            expect(item.decisionReason, `정산 ${item.settlementId}`).not.toBeNull();
        }
    });
});

describe('금액 규칙', () => {
    it('대여 건당 상한 7,000원을 넘지 않는다', () => {
        // 화면흐름 §11.1
        for (const item of MOCK_SETTLEMENTS) {
            expect(item.amount, `정산 ${item.settlementId}`).toBeLessThanOrEqual(7000);
        }
    });

    it('낸 금액이 청구액을 넘지 않는다', () => {
        for (const item of MOCK_SETTLEMENTS) {
            expect(item.paidAmount, `정산 ${item.settlementId}`).toBeLessThanOrEqual(item.amount);
            expect(item.paidAmount).toBeGreaterThanOrEqual(0);
        }
    });

    it('정산 완료면 낸 금액이 청구액과 같고 납부 시각이 있다', () => {
        for (const item of MOCK_SETTLEMENTS.filter((s) => s.status === 'PAID')) {
            expect(item.paidAmount, `정산 ${item.settlementId}`).toBe(item.amount);
            expect(item.paidAt, `정산 ${item.settlementId}`).not.toBeNull();
        }
    });

    it('미정산이면 납부 시각이 없다', () => {
        for (const item of MOCK_SETTLEMENTS.filter((s) => s.status === 'PENDING')) {
            expect(item.paidAt, `정산 ${item.settlementId}`).toBeNull();
        }
    });
});

describe('반납 상태 자체의 정합성', () => {
    it('반납 완료가 아닌 건에는 정산이 붙지 않는다', () => {
        // 복구 필요·실패·물리 완료는 아직 끝난 반납이 아닙니다. 정산은 그 뒤 단계입니다.
        for (const attempt of MOCK_RETURNS.filter((item) => item.status !== 'COMPLETED')) {
            expect(attempt.settlementId, `반납 ${attempt.returnAttemptId}`).toBeNull();
        }
    });

    it('슬롯을 못 고른 반납은 실패한 반납뿐이다', () => {
        for (const attempt of MOCK_RETURNS.filter((item) => item.slotId === null)) {
            expect(attempt.status, `반납 ${attempt.returnAttemptId}`).toBe('FAILED');
        }
    });

    it('슬롯 UUID 와 표시 라벨은 함께 있거나 함께 없다', () => {
        for (const attempt of MOCK_RETURNS) {
            expect(
                attempt.slotId === null,
                `반납 ${attempt.returnAttemptId} 의 slotId/slotLabel 짝`,
            ).toBe(attempt.slotLabel === null);
        }
    });

    it('반납 상태가 다섯 값을 골고루 쓴다 — 상수 열이면 화면을 검증할 수 없다', () => {
        /*
         * 예전에 14건 전부 COMPLETED 였습니다. 그러면 반납 상태 열이 상수라서 그 열이
         * 제대로 그려지는지, 필터가 도는지 화면으로 확인할 방법이 없습니다.
         */
        const used = new Set(MOCK_RETURNS.map((item) => item.status));
        expect(used.size).toBeGreaterThanOrEqual(3);
        expect(used).toContain('COMPLETED');
    });
});

describe('사용자 식별자', () => {
    it('학번(9자리 숫자)이 아니라 가명 UUID 를 쓴다', () => {
        /*
         * ERD v3.0 이 USER_ACCOUNT 를 둘로 갈랐습니다.
         *   user_id  CHAR(9)  학번 — 직접 식별 정보
         *   user_ref CHAR(36) 가명 UUID — 학번에서 유도 금지
         * 여기에 학번이 들어오면 관리자 화면에 학번이 그대로 올라갑니다.
         */
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        for (const rental of MOCK_RENTALS) {
            expect(rental.userRef, `대여 ${rental.rentalId}`).toMatch(uuid);
            expect(rental.userRef).not.toMatch(/^\d{9}$/);
        }
        for (const attempt of MOCK_RETURNS) {
            expect(attempt.userRef, `반납 ${attempt.returnAttemptId}`).toMatch(uuid);
        }
    });

    it('한 대여와 그 반납·정산은 같은 사용자다', () => {
        for (const rental of MOCK_RENTALS) {
            if (rental.returnAttemptId) {
                expect(findReturn(rental.returnAttemptId)?.userRef).toBe(rental.userRef);
            }
            if (rental.settlementId) {
                expect(findSettlement(rental.settlementId)?.userRef).toBe(rental.userRef);
            }
        }
    });
});

describe('시간 순서', () => {
    it('반납 기한은 대여 시각보다 뒤다', () => {
        for (const rental of MOCK_RENTALS) {
            expect(rental.dueAt > rental.rentedAt, `대여 ${rental.rentalId}`).toBe(true);
        }
    });

    it('반납 시도는 대여 시각보다 뒤다', () => {
        for (const attempt of MOCK_RETURNS) {
            const rental = findRental(attempt.rentalId);
            expect(
                attempt.attemptedAt >= (rental?.rentedAt ?? ''),
                `반납 ${attempt.returnAttemptId}`,
            ).toBe(true);
        }
    });
});
