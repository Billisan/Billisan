import {
    SEED_MODEL_VERSION,
    SEED_RENTALS,
    SEED_SETTLEMENT,
    SEED_STATION,
    SEED_SYNCED_AT,
    seedInspectionOfSlot,
    seedSlotOf,
    seedUserOf,
    type SeedRental,
} from '@/features/stations/mocks/ec2Seed';
import { formatSlotLabel } from '@/features/stations/types';
import {
    SETTLEMENT_REASON_LABEL,
    formatWon,
    type Rental,
    type ReturnAttempt,
    type Settlement,
    type UserTimelineEntry,
} from '@/features/history/types';

/**
 * 이력 화면 목업 — **EC2 시드 그대로입니다** (`stations/mocks/ec2Seed.ts`).
 *
 * ⚠️ **이 화면들에는 실 API 가 없습니다.** 서버 OpenAPI 스펙(`docs/api-docs.json`)의 관리자
 * 경로 8개에 대여·반납·정산·사용자 이력이 하나도 없습니다. 그래서 다른 화면과 달리
 * 여기는 목업 모드를 꺼도 목업이 나옵니다 — 갈아탈 상대가 없습니다.
 *
 * 그래도 시드에 맞춥니다. 대여·정산이 검수·슬롯과 **같은 사건**을 가리키기 때문입니다.
 * 슬롯4 파손 판정 → 정산 7,000원은 한 줄기이고, 목업이 딴 데이터를 들고 있으면 검수
 * 상세에서 정산으로 넘어갔을 때 앞뒤가 안 맞습니다.
 *
 * **예전에는 400줄짜리 가짜 이력을 손으로 적었습니다.** 대여 20여 건에 `R-88102` 같은
 * 표시 코드를 붙이고, 슬롯은 '모양'으로 요청해 절차적 생성기에서 골라 왔습니다. 실제
 * 데이터에는 대여가 4건뿐이라 그 전부가 허구였습니다.
 *
 * 사용자는 `userRef`(ERD v3.0 `USER_ACCOUNT.user_ref` · 가명 UUID)만 담습니다. 학번인
 * `user_id CHAR(9)` 는 어디에도 넣지 않습니다. 이름·연락처·대학 계정 식별자·`password_hash`
 * 도 어떤 형태로도 넣지 않습니다 (화면흐름 §6.3).
 *
 * TODO: 대여·반납·정산·사용자 이력 API 가 확정되면(WEB-API-CAND-002~008) 이 파일을 지우세요.
 */

export const HISTORY_SYNCED_AT = SEED_SYNCED_AT;

/** 시안 하단 안내 문구. 우산 ID 없이 대여 ID 로 추적한다는 원칙을 화면에 남깁니다. */
export const RENTAL_LIST_NOTE =
    '대여 상태: 대여중 · 연체(기한 초과 미반납) · 반납완료 · 분실(장기 미반납) · 개별 우산 ID 없이 대여 ID로 추적합니다';

/* ------------------------------------------------------------------ 공통 도우미 */

/** 시드 대여가 쓴 슬롯의 표시 정보. 슬롯 번호는 대여소 안에서만 유일합니다. */
function slotRefOf(slotNumber: number) {
    const slot = seedSlotOf(slotNumber);
    return {
        slotId: slot?.slotId ?? null,
        slotLabel: slot ? formatSlotLabel(slot.slotNumber) : null,
    };
}

/** 학번 → 가명 UUID. 화면에 나가는 건 이 값뿐입니다 (학번은 절대 아닙니다). */
function userRefOf(studentNo: string): string {
    return seedUserOf(studentNo)?.userRef ?? '';
}

/**
 * 보강 — 반납 시각.
 *
 * 시드 문서에 반납 시도 표가 없습니다. 검수가 그 반납을 보고 돌아간 것이므로 **검수
 * 추론 시각 직전**이어야 앞뒤가 맞습니다. 검수가 없는 슬롯이면 대여 기한을 씁니다.
 */
function attemptedAtOf(rental: SeedRental): string {
    const inspection = seedInspectionOfSlot(rental.slotNumber);
    return inspection?.processedAt ?? rental.dueAt;
}

/* ---------------------------------------------------------------------- 대여 */

/** 시드 문서 「대여(Rental) 4건」 표. */
export const MOCK_RENTALS: Rental[] = SEED_RENTALS.map((rental) => ({
    rentalId: rental.rentalId,
    userRef: userRefOf(rental.studentNo),
    stationName: SEED_STATION.name,
    stationId: SEED_STATION.stationId,
    ...slotRefOf(rental.slotNumber),
    rentedAt: rental.rentedAt,
    dueAt: rental.dueAt,
    status: rental.status,
    returnAttemptId: rental.returnAttemptId,
    settlementId: rental.rentalId === SEED_SETTLEMENT.rentalId ? SEED_SETTLEMENT.settlementId : null,
})) as Rental[];

/* ---------------------------------------------------------------------- 반납 */

/**
 * 반납 시도.
 *
 * **반납이 있는 대여만 행이 생깁니다.** 시드의 김학생 대여는 `ACTIVE`(아직 안 돌아옴)라
 * 반납 시도가 없습니다 — 4건 중 3건입니다.
 *
 * `status` 를 `COMPLETED` 로 박지 않습니다. 시드 문서 「참고」가 짚은 대로 반납 상태
 * 머신이 이 시드에서 완주하지 않아 화면에는 `PHYSICAL_DONE`(물리 완료·서버 반영 전)
 * 으로 뜹니다. 오류가 아니라 시드가 그 지점까지만 만들어져 있는 것입니다.
 *
 * 검수(`inspectionId`·`reviewStatus`)는 손으로 적지 않고 슬롯에 걸린 시드 검수에서
 * 가져옵니다. 그래야 반납 상세에서 검수로 넘어갔을 때 실재하는 검수가 나옵니다.
 */
export const MOCK_RETURNS: ReturnAttempt[] = SEED_RENTALS.filter(
    (rental) => rental.returnAttemptId !== null,
).map((rental) => {
    const inspection = seedInspectionOfSlot(rental.slotNumber);

    return {
        returnAttemptId: rental.returnAttemptId!,
        rentalId: rental.rentalId,
        userRef: userRefOf(rental.studentNo),
        stationName: SEED_STATION.name,
        stationId: SEED_STATION.stationId,
        ...slotRefOf(rental.slotNumber),
        attemptedAt: attemptedAtOf(rental),
        status: rental.status === 'COMPLETED' ? 'COMPLETED' : 'PHYSICAL_DONE',
        aiResult: inspection?.aiResult ?? 'NORMAL',
        aiScore: inspection?.aiScore ?? null,
        modelVersion: SEED_MODEL_VERSION,
        /** 보강 — 추론 지연. 시드 문서에 없습니다. */
        latencyMs: 820,
        inspectionId: inspection?.inspectionId ?? null,
        reviewStatus: inspection?.reviewStatus ?? null,
        settlementId:
            rental.rentalId === SEED_SETTLEMENT.rentalId ? SEED_SETTLEMENT.settlementId : null,
    };
}) as ReturnAttempt[];

/* ---------------------------------------------------------------------- 정산 */

/**
 * 시드 문서 「정산(Settlement) 1건」 표.
 *
 * 슬롯은 **연결된 반납에서 가져옵니다.** 파손 정산의 슬롯은 파손이 발견된 자리, 즉 그
 * 반납이 들어간 슬롯입니다. 따로 적으면 같은 사건의 슬롯이 화면마다 달라집니다.
 */
export const MOCK_SETTLEMENTS: Settlement[] = (() => {
    const rental = SEED_RENTALS.find((row) => row.rentalId === SEED_SETTLEMENT.rentalId);
    if (!rental) return [];

    return [
        {
            settlementId: SEED_SETTLEMENT.settlementId,
            userRef: userRefOf(rental.studentNo),
            reason: SEED_SETTLEMENT.reason,
            amount: SEED_SETTLEMENT.amount,
            paidAmount: SEED_SETTLEMENT.paidAmount,
            status: SEED_SETTLEMENT.status,
            createdAt: SEED_SETTLEMENT.createdAt,
            paidAt: null,
            rentalId: rental.rentalId,
            returnAttemptId: rental.returnAttemptId,
            ...slotRefOf(rental.slotNumber),
            /** 보강 — 관리자 판정 사유. 시드 문서에 없습니다. */
            decisionReason: '캐노피 파손',
        },
    ];
})() as Settlement[];

export function findRental(id: string | undefined) {
    return MOCK_RENTALS.find((item) => item.rentalId === id);
}

export function findReturn(id: string | undefined) {
    return MOCK_RETURNS.find((item) => item.returnAttemptId === id);
}

export function findSettlement(id: string | undefined) {
    return MOCK_SETTLEMENTS.find((item) => item.settlementId === id);
}

/* ------------------------------------------- 사용자 통합 이력 (§12) */

export interface UserSummary {
    userRef: string;
    /** 각 집계의 기간을 함께 밝힙니다 (§12). */
    period: string;
    totalRentals: number;
    normalReturns: number;
    damagedOrLost: number;
    outstandingAmount: number;
    timeline: UserTimelineEntry[];
}

/**
 * 사용자 통합 이력.
 *
 * 시드에서 **미납 정산이 걸린 사용자**를 고릅니다 — 화면이 보여 줘야 하는 게 그 상태이고,
 * 아무 일도 없는 사용자를 띄우면 집계·타임라인이 전부 0 이라 아무것도 확인할 수 없습니다.
 * 시드에서는 최학생(202400004)입니다.
 *
 * 집계도 손으로 적지 않고 위 목업에서 셉니다. 예전에는 숫자를 따로 적어 둬서 타임라인과
 * 어긋났습니다.
 */
const FOCUS_RENTAL = SEED_RENTALS.find((row) => row.rentalId === SEED_SETTLEMENT.rentalId);

function buildUserSummary(): UserSummary {
    const userRef = FOCUS_RENTAL ? userRefOf(FOCUS_RENTAL.studentNo) : '';
    const rentals = MOCK_RENTALS.filter((row) => row.userRef === userRef);
    const returns = MOCK_RETURNS.filter((row) => row.userRef === userRef);
    const settlements = MOCK_SETTLEMENTS.filter((row) => row.userRef === userRef);

    const timeline: UserTimelineEntry[] = [
        ...rentals.map(
            (row): UserTimelineEntry => ({
                at: row.rentedAt,
                kind: '대여',
                linkId: row.rentalId,
                to: `/history/rentals/${row.rentalId}`,
                target: `${row.stationName} ${row.slotLabel ?? ''}`.trim(),
                statusLabel: '대여',
                statusTone: 'slate',
            }),
        ),
        ...returns.map(
            (row): UserTimelineEntry => ({
                at: row.attemptedAt,
                kind: '반납',
                linkId: row.returnAttemptId,
                to: `/history/returns/${row.returnAttemptId}`,
                target: `${row.stationName} ${row.slotLabel ?? ''}`.trim(),
                statusLabel: '물리 완료',
                statusTone: 'amber',
            }),
        ),
        ...settlements.map(
            (row): UserTimelineEntry => ({
                at: row.createdAt,
                kind: '정산',
                linkId: row.settlementId,
                to: `/history/settlements/${row.settlementId}`,
                target: `${SETTLEMENT_REASON_LABEL[row.reason]} · ${formatWon(row.amount)}`,
                statusLabel: '미납',
                statusTone: 'red',
            }),
        ),
        // 최신순. 같은 시각이면 대여 → 반납 → 정산 순서가 자연스럽습니다.
    ].sort((a, b) => b.at.localeCompare(a.at));

    return {
        userRef,
        period: '최근 30일',
        totalRentals: rentals.length,
        // 파손·분실로 끝나지 않은 반납.
        normalReturns: returns.filter((row) => row.aiResult === 'NORMAL').length,
        damagedOrLost: returns.filter((row) => row.aiResult === 'DAMAGED').length,
        outstandingAmount: settlements.reduce(
            (sum, row) => sum + (row.amount - row.paidAmount),
            0,
        ),
        timeline,
    };
}

export const MOCK_USER: UserSummary = buildUserSummary();
