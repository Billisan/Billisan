import { describe, expect, it } from 'vitest';

import {
    MOCK_RENTALS,
    MOCK_RETURNS,
    MOCK_SETTLEMENTS,
    MOCK_USER,
    findRental,
    findReturn,
    findSettlement,
} from '@/features/history/mocks/history';
import { findInspection } from '@/features/inspections/mocks/inspections';
import { formatDateTime, formatDayTime, formatTimeOnly } from '@/shared/lib/datetime';
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
    it('AI 가 정상으로 본 반납은 검수 대기로 남지 않는다', () => {
        /*
         * **예전 단언은 틀렸습니다.** "AI 가 정상이면 검수 자체가 없다" 로 적혀 있었는데,
         * EC2 시드가 반증합니다 — 검수 `7aa9f1b8…` 는 `aiResult=NORMAL` 인데 레코드가
         * 있고 `DECIDED` 입니다.
         *
         * 실제 규칙은 "검수가 안 생긴다" 가 아니라 **"사람 손을 안 탄다"** 입니다.
         * 검수 레코드는 반납 시도마다 남고(DB 유니크 제약 `uk_damage_inspection_
         * return_attempt_id`), AI 가 정상으로 본 건은 `DECIDED` 로 바로 닫힙니다.
         * 그래서 「검수 대기」 목록에 올라오지 않습니다.
         */
        for (const attempt of MOCK_RETURNS.filter((item) => item.aiResult === 'NORMAL')) {
            expect(attempt.reviewStatus, `반납 ${attempt.returnAttemptId}`).not.toBe('PENDING');
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
    it('정산이 붙은 반납은 파손 검수가 끝난 건이다', () => {
        /*
         * **예전 단언은 틀렸습니다.** "반납이 `COMPLETED` 가 아니면 정산이 없다" 로
         * 적혀 있었는데, EC2 시드가 반증합니다 — 최학생의 반납은 `PHYSICAL_DONE`
         * (물리 완료·서버 반영 전)인데 파손 정산 `da4f6574…` 가 이미 붙어 있습니다.
         *
         * 정산을 만드는 건 반납 완료가 아니라 **관리자의 파손 판정**입니다
         * (`ADMIN-INSPECTION-003`: 검수·슬롯·정산이 한 트랜잭션). 반납 상태 머신이
         * 완주하기 전에 판정이 먼저 날 수 있고, 시드가 정확히 그 상태입니다.
         */
        for (const attempt of MOCK_RETURNS.filter((item) => item.settlementId !== null)) {
            expect(attempt.aiResult, `반납 ${attempt.returnAttemptId}`).toBe('DAMAGED');
            expect(attempt.reviewStatus, `반납 ${attempt.returnAttemptId}`).toBe('DECIDED');
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

    /*
     * ⚠️ **삭제한 테스트: `반납 상태가 다섯 값을 골고루 쓴다`**
     *
     * 목업이 이력을 지어내던 시절, 반납 상태 열이 상수가 되지 않도록 `PROCESSING`·
     * `COMPLETED`·`RECOVERY_REQUIRED`… 를 골고루 섞어 뒀는지 검사하던 테스트입니다.
     *
     * EC2 시드에는 반납이 3건뿐이고 전부 `PHYSICAL_DONE` 입니다. 지어낼 수 없습니다 —
     * 목업을 실제 데이터에 맞추기로 한 이상 다양성은 서버가 만들어야 합니다.
     *
     * **잃은 것을 분명히 적어 둡니다**: 반납 상태 배지·필터가 다섯 값에서 제대로 그려지는지
     * **목업만으로는 더 이상 확인할 수 없습니다.** 그 검증이 필요하면 컴포넌트 테스트에서
     * 값을 직접 주입하거나(`RETURN_STATUS_LABEL` 전수), 백엔드에 시드 추가를 요청하세요.
     */
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

describe('사용자 통합 이력 타임라인', () => {
    it('가리키는 대여·반납·정산이 모두 존재한다', () => {
        for (const entry of MOCK_USER.timeline) {
            const found =
                entry.kind === '대여'
                    ? findRental(entry.linkId)
                    : entry.kind === '반납'
                      ? findReturn(entry.linkId)
                      : findSettlement(entry.linkId);
            expect(found, `${entry.kind} ${entry.linkId}`).toBeDefined();
        }
    });

    it('대상 글자가 연결된 기록과 일치한다', () => {
        /*
         * 같은 사건을 타임라인과 상세에 따로 적어 두면 갈라집니다. 실제로
         * 타임라인만 `제1공학관 · SL-03-07` 로 남아 있었습니다 — 앱 전체가
         * `N번 슬롯` 으로 바뀐 뒤에도, 그리고 07 번은 그 대여소에 없는 슬롯입니다.
         */
        for (const entry of MOCK_USER.timeline) {
            if (entry.kind === '정산') continue;
            const record =
                entry.kind === '대여' ? findRental(entry.linkId) : findReturn(entry.linkId);
            expect(record, `${entry.kind} ${entry.linkId}`).toBeDefined();
            expect(entry.target, `${entry.kind} ${entry.linkId}`).toContain(record!.stationName);
            if (record!.slotLabel) {
                expect(entry.target).toContain(record!.slotLabel);
            }
        }
    });

    it('걷어낸 옛 슬롯 표기가 남아 있지 않다', () => {
        // ERD v3.0 이 station_code 를 P0 필수에서 뺐습니다. 'SL-03-07' 은 그 컬럼에
        // 기대는 표기라 서버가 안 주면 만들 수 없습니다.
        for (const entry of MOCK_USER.timeline) {
            expect(entry.target, `${entry.kind} ${entry.linkId}`).not.toMatch(/SL-\d/);
        }
    });

    it('시각이 최신순으로 내려간다', () => {
        const times = MOCK_USER.timeline.map((entry) => entry.at);
        expect([...times].sort().reverse()).toEqual(times);
    });
});

describe('대여와 반납의 개수·매칭 관계', () => {
    /** 대여가 `returnAttemptId` 로 가리키는 것은 **완료된 반납** 하나뿐입니다. */
    const completed = MOCK_RETURNS.filter((item) => item.status === 'COMPLETED');

    it('대여 수가 완료된 반납 수 이상이다', () => {
        /*
         * 반납은 대여 없이 생길 수 없고, 대여 중·분실은 반납이 없습니다.
         *
         * 주의: **전체 반납 수와 비교하면 안 됩니다.** ERD 가 `RENTAL 1:N RETURN_ATTEMPT`
         * 라 실패 후 재시도가 쌓이면 반납 행이 대여보다 많아질 수 있습니다. 대여와
         * 일대일로 맞는 것은 완료 시도뿐입니다.
         */
        expect(MOCK_RENTALS.length).toBeGreaterThanOrEqual(completed.length);
    });

    it('완료된 반납 수와 반납완료 대여 수가 같다', () => {
        const done = MOCK_RENTALS.filter((item) => item.status === 'COMPLETED');
        expect(done.length).toBe(completed.length);
    });

    it('모든 반납이 실재하는 대여에 매달린다', () => {
        const ids = new Set(MOCK_RENTALS.map((item) => item.rentalId));
        for (const attempt of MOCK_RETURNS) {
            expect(ids, `반납 ${attempt.returnAttemptId}`).toContain(attempt.rentalId);
        }
    });

    it('한 대여에 완료된 반납은 최대 1건이다', () => {
        // 화면 안내 문구: "완료 시도는 최대 1건입니다 (§8.2)"
        const perRental = new Map<string, number>();
        for (const attempt of completed) {
            perRental.set(attempt.rentalId, (perRental.get(attempt.rentalId) ?? 0) + 1);
        }
        for (const [rentalId, count] of perRental) {
            expect(count, `대여 ${rentalId} 의 완료 반납`).toBe(1);
        }
    });

    it('반납완료 대여는 완료된 반납을 가리킨다', () => {
        for (const rental of MOCK_RENTALS.filter((item) => item.status === 'COMPLETED')) {
            expect(rental.returnAttemptId, `대여 ${rental.rentalId}`).not.toBeNull();
            expect(findReturn(rental.returnAttemptId ?? undefined)?.status).toBe('COMPLETED');
        }
    });

    it('대여중·분실 대여에는 반납 시도가 없다', () => {
        /*
         * **예전 단언은 범위가 넓었습니다.** `status !== 'COMPLETED'` 전부를 잡아서
         * `RETURNING` 까지 "반납 시도가 없어야 한다" 고 했는데, `RETURNING` 은 말 그대로
         * **반납이 진행 중**이라 시도가 반드시 있습니다. 시드의 대여 4건 중 3건이 그렇습니다.
         *
         * 아직 안 돌아왔거나(ACTIVE) 잃어버린(LOST) 건에만 시도가 없습니다.
         */
        for (const rental of MOCK_RENTALS.filter(
            (item) => item.status === 'ACTIVE' || item.status === 'LOST',
        )) {
            expect(rental.returnAttemptId, `대여 ${rental.rentalId}`).toBeNull();
        }
    });

    it('반납중 대여는 반납 시도를 가리킨다', () => {
        for (const rental of MOCK_RENTALS.filter((item) => item.status === 'RETURNING')) {
            expect(rental.returnAttemptId, `대여 ${rental.rentalId}`).not.toBeNull();
        }
    });

    it('대여가 되짚지 않는 반납은 아직 안 끝난 시도뿐이다', () => {
        /*
         * 완료 반납은 반드시 대여 쪽에서도 가리킵니다. 역참조가 없는 반납은
         * 처리 중·물리 완료·복구 필요·실패 — 즉 아직 완료가 아닌 것들입니다.
         */
        const pointed = new Set(MOCK_RENTALS.map((item) => item.returnAttemptId).filter(Boolean));
        for (const attempt of MOCK_RETURNS) {
            if (pointed.has(attempt.returnAttemptId)) continue;
            expect(attempt.status, `반납 ${attempt.returnAttemptId}`).not.toBe('COMPLETED');
        }
    });

    /*
     * ⚠️ **삭제한 테스트: `한 대여에 시도가 여러 건인 사례가 실제로 있다`**
     *
     * 반납 화면이 "한 대여에 여러 건일 수 있습니다" 라고 안내하는데 데이터에 그 사례가
     * 있는지 보던 테스트입니다. EC2 시드는 대여 4건에 반납 3건, 전부 1:1 이라 재시도
     * 사례가 없습니다. 지어내면 다시 실제와 어긋납니다.
     *
     * **잃은 것**: 그 안내 문구가 가리키는 상황을 목업으로 재현할 수 없습니다.
     * 실패 후 재시도 시드가 필요하면 백엔드에 요청하세요.
     */

    it('한 대여가 가리키는 반납은 실재한다', () => {
        // 여러 건이든 한 건이든, 가리키는 대상이 없는 건 언제나 오류입니다.
        const ids = new Set(MOCK_RETURNS.map((item) => item.returnAttemptId));
        for (const rental of MOCK_RENTALS.filter((item) => item.returnAttemptId !== null)) {
            expect(ids.has(rental.returnAttemptId!), `대여 ${rental.rentalId}`).toBe(true);
        }
    });
});

describe('조회 기간', () => {
    /*
     * ⚠️ **삭제한 테스트: `세 프리셋이 각각 다른 건수를 낸다`**
     *
     * 예전 목업은 `최근 일주일`·`한 달`·`세 달` 이 서로 다른 결과를 내도록 14일 전·49일
     * 전 대여를 일부러 심어 뒀습니다. EC2 시드의 대여 4건은 전부 07-31 ~ 08-01 이틀에
     * 몰려 있어서 세 프리셋이 같은 결과를 냅니다.
     *
     * **잃은 것**: 기간 필터가 실제로 거르는지 목업만으로는 확인할 수 없습니다.
     * 필터 로직 자체는 `lib/dateRange.test.ts` 가 순수 함수로 검증하고 있어서,
     * 없어진 건 "화면에서 눈으로 보는" 경로뿐입니다.
     */
    const days = MOCK_RENTALS.map((item) => item.rentedAt.slice(0, 10)).sort();
    /** 시드 기준일. `ec2Seed.ts` 의 `SEED_DATE` 와 같아야 합니다. */
    const ASOF = '2026-08-01';

    it('모든 대여가 세 달 안에 있다 — 기본 조회에서 사라지는 건이 없다', () => {
        const quarterAgo = '2026-05-03';
        expect(days[0] >= quarterAgo, `가장 오래된 대여 ${days[0]}`).toBe(true);
        expect(days[days.length - 1] <= ASOF, `가장 최근 대여 ${days.at(-1)}`).toBe(true);
    });
});

describe('화면 표시용 불변식', () => {
    it('사용자 축약 표시(앞 8자)가 사람마다 다르다', () => {
        /*
         * 회귀 테스트. 화면은 `userRef` 를 앞 8자 + `…` 로 줄여 보여 줍니다 (화면흐름 §12).
         * 처음 시드에서 네 사람을 뒷자리만 다르게 두는 바람에 대여 목록의 「사용자」 열이
         * 넷 다 `b1f6e0c4…` 로 똑같이 나왔습니다. 누가 누구인지 알 수 없는 표였습니다.
         */
        const refs = MOCK_RENTALS.map((item) => item.userRef.slice(0, 8));
        expect(new Set(refs).size, `축약 표시: ${refs.join(', ')}`).toBe(refs.length);
    });

    it('시각 필드가 서버 형식이고, 표시 도우미가 자를 수 있다', () => {
        /*
         * 회귀 테스트. 목업을 시드에 맞추며 시각이 서버 `DATETIME(6)` 이 됐는데 화면은
         * `value.slice(5)` 로 자르고 있어서, 표에 `08-01T08:52:00.000000+09:00` 이
         * 그대로 찍혔습니다. 이제 `shared/lib/datetime` 이 두 형식을 다 자릅니다.
         */
        for (const rental of MOCK_RENTALS) {
            expect(formatDayTime(rental.rentedAt), rental.rentalId).toMatch(
                /^\d{2}-\d{2} \d{2}:\d{2}$/,
            );
            expect(formatDateTime(rental.dueAt), rental.rentalId).toMatch(
                /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
            );
        }
        for (const attempt of MOCK_RETURNS) {
            expect(formatTimeOnly(attempt.attemptedAt), attempt.returnAttemptId).toMatch(
                /^\d{2}:\d{2}$/,
            );
        }
    });
});

describe('EC2 시드와 일치한다', () => {
    /*
     * 이 블록이 새 안전망입니다. 목업이 시드 문서에서 벗어나면 여기서 걸립니다 —
     * 예전처럼 "화면은 그려지는데 실서버와 다른 데이터" 로 흘러가지 않게요.
     * 출처: `EC2-DEMO-SEED-DATA.md` (2026-08-01), 전사본은 `mocks/ec2Seed.ts`.
     */
    it('대여 4건 · 반납 3건 · 정산 1건', () => {
        expect(MOCK_RENTALS).toHaveLength(4);
        // 반납은 ACTIVE 대여 1건을 뺀 나머지입니다.
        expect(MOCK_RETURNS).toHaveLength(3);
        expect(MOCK_SETTLEMENTS).toHaveLength(1);
    });

    it('정산 1건이 시드의 그 정산이다 — 파손 · 7,000원 · 미납', () => {
        const [settlement] = MOCK_SETTLEMENTS;
        expect(settlement.settlementId).toBe('da4f6574-1adc-41dc-9585-f6d47ef1e8f6');
        expect(settlement.rentalId).toBe('48b931c4-9367-4f3f-98d3-41c37a11b3aa');
        expect(settlement.reason).toBe('DAMAGE');
        expect(settlement.amount).toBe(7000);
        expect(settlement.status).toBe('PENDING');
    });

    it('대여 ID 가 시드 문서의 네 건 그대로다', () => {
        expect(MOCK_RENTALS.map((item) => item.rentalId).sort()).toEqual(
            [
                '8c1e78f4-cc39-4b36-a671-78fa8a14f7e7',
                '683578ad-f5bd-48e3-90ba-dd041645d2f3',
                '53986655-6b48-4af2-9893-dee0f58fd828',
                '48b931c4-9367-4f3f-98d3-41c37a11b3aa',
            ].sort(),
        );
    });

    it('모든 이력이 대여소 한 곳(정문 대여소)에 속한다', () => {
        for (const row of [...MOCK_RENTALS, ...MOCK_RETURNS]) {
            expect(row.stationId, row.stationName).toBe('186c47d2-6553-4b36-8d7e-de810f40010d');
        }
    });
});
