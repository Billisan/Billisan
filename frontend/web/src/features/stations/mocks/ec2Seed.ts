import type {
    AiInspectionResult,
    InspectionDecision,
    LockStatus,
    SlotItemCondition,
    SlotOccupancyStatus,
    SlotServiceStatus,
} from '@/features/stations/types';

/**
 * EC2 데모 시드 데이터 — **목업 전체의 단일 출처**.
 *
 * 백엔드 담당자가 2026-08-01 에 EC2 `billisan-db` 에 직접 넣은 더미 데이터를 그대로
 * 옮긴 것입니다. 출처 문서: `EC2-DEMO-SEED-DATA.md`.
 *
 * **왜 목업을 실제 시드에 맞추나**: 예전 목업은 대여소 8곳·슬롯 36개를 절차적으로 지어냈고,
 * 실 API 로 갈아타는 순간 화면이 전혀 다른 모양이 됐습니다. 개수·상태·ID 가 전부 달라서
 * "목업에서 되던 게 실서버에서 안 된다"를 눈으로 확인할 수가 없었습니다. 이제 목업과 실
 * 데이터가 같은 모양이라, 스위치를 내려도 화면이 그대로입니다.
 *
 * ---
 *
 * ⚠️ **두 종류의 값이 섞여 있습니다. 구분해서 읽으세요.**
 *
 * 1. `전사` — 시드 문서에 적힌 값. UUID·상태·이름·금액. **고치지 마세요.**
 * 2. `보강` — 시드 문서에 **없어서** 목업이 채운 값. 화면이 필요로 하는데 문서가 안 다루는
 *    것들입니다: `lockStatus`, `updatedAt`, `aiScore`, `modelVersion`, `returnAttemptId`,
 *    대여 시각, 지도 좌표, 대여소 장치 상태. 실 API 를 붙이면 서버 값으로 대체됩니다.
 *
 * 아래 각 블록에 어느 쪽인지 표시해 뒀습니다.
 *
 * TODO: 실 API 연동이 끝나면 이 파일과 `mocks/` 전체를 지우세요.
 */

/* ═══════════════════════════════════════════════════════════ 기준 시각 (보강) */

/**
 * 시드를 만든 날. 모든 목업 시각의 기준입니다.
 *
 * 시드 문서에 시각이 하나도 없어서 목업이 정합니다. 한 상수에서 파생시켜야 화면끼리
 * 앞뒤가 맞습니다 — 대여가 반납보다 늦거나, 검수가 슬롯 갱신보다 나중인 일이 없게요.
 */
export const SEED_DATE = '2026-08-01';

/** 서버 계약과 같은 `DATETIME(6)` 문자열을 만듭니다. CAS 왕복용이라 파싱하지 마세요. */
export function seedAt(time: string, date: string = SEED_DATE): string {
    return `${date}T${time}:00.000000+09:00`;
}

/**
 * 화면 상단 '기준' 표시용 (`YYYY-MM-DD HH:mm`).
 *
 * **API 응답 필드에 넣지 마세요.** 표시 형식이라 계약의 `date-time` 이 아닙니다.
 * 응답용은 아래 `SEED_ASOF` 입니다 — 둘을 섞어 쓰다 `ADMIN-INVENTORY-001` 의 `asOf` 가
 * 스펙을 어긴 채로 있었고, 계약 테스트(`test/apiContract.test.ts`)가 그걸 잡았습니다.
 */
export const SEED_SYNCED_AT = `${SEED_DATE} 14:30`;

/** `ADMIN-INVENTORY-001` 의 `asOf` — "집계 기준 서버 시각". 계약이 `date-time` 입니다. */
export const SEED_ASOF = seedAt('14:30');

/* ═══════════════════════════════════════════════════════════════ 대여소 (전사) */

/** 시드 문서 「대여소」 표 — 딱 한 곳입니다. */
export const SEED_STATION = {
    /** 전사 */
    stationId: '186c47d2-6553-4b36-8d7e-de810f40010d',
    /** 전사 */
    name: '정문 대여소',

    /**
     * 장치 연결 상태 — **`null`(알 수 없음)입니다. 지어내지 않습니다.**
     *
     * `STATION.device_status` 는 DB 에 있지만 **그걸 내려 주는 관리자 API 가 없습니다**
     * (스펙 8개 경로 전수 확인). 그래서 실 모드는 `stationsApi.composeStation` 에서
     * `null` 을 넣고, 화면은 회색 「확인 불가」 배지를 그립니다.
     *
     * 예전 목업은 여기 `'ONLINE'` 이 박혀 있었습니다. 그러면 **목업에서는 초록 「ON ·
     * 장치 연결됨」, 실 API 로 바꾸면 「확인 불가」** 로 배지가 달라집니다. 게다가 함이
     * 꺼져 있어도 서버는 DB 슬롯 행을 돌려주므로, 초록 배지는 근거 없는 안심입니다.
     * `StationTable` 이 「온라인」 열을 통째로 뺀 이유가 바로 이것이었는데, 목업 쪽에는
     * 같은 거짓말이 남아 있었습니다.
     */
    deviceStatus: null,

    /**
     * 서비스 상태. 이 값도 API 가 안 주지만 `AVAILABLE` 로 둡니다 — 실 모드도 같은 값을
     * 넣고(`composeStation`), 화면이 이걸로 판단하지 않습니다(표시는 슬롯 4축과 재고 비율).
     * 두 모드가 같으니 갈아탈 때 화면이 안 바뀝니다.
     */
    serviceStatus: 'AVAILABLE',

    /** 보강 — 분포도 좌표. ERD 에 좌표 컬럼이 없어 화면 배치용으로 정한 값입니다. */
    position: { x: 20.1, y: 86.0 },
} as const;

/* ═════════════════════════════════════════════════════════════════ 슬롯 (전사) */

export interface SeedSlot {
    slotNumber: number;
    /** 전사 */
    slotId: string;
    /** 전사 */
    occupancyStatus: SlotOccupancyStatus;
    /** 전사 */
    serviceStatus: SlotServiceStatus;
    /** 전사 — 점유가 EMPTY 면 null 입니다 */
    itemCondition: SlotItemCondition | null;
    /**
     * 보강 — 시드 문서에 잠금 축이 없어 **전부 `LOCKED` 로 추측한 값**입니다.
     *
     * `deviceStatus` 와 달리 이 값은 **서버가 줍니다** (`SlotSummaryResponse.lockStatus`).
     * 실 API 로 갈아타면 진짜 값으로 대체되므로, 목업이 틀려도 그때 저절로 바로잡힙니다.
     * 그래서 `null` 로 비우지 않고 가장 흔한 상태를 넣어 둡니다 — 물리 사물함의 기본은
     * 잠겨 있는 것이고, 비워 두면 5칸 전부 「확인 불가」라 표가 읽히지 않습니다.
     *
     * **다만 화면이 "다 잠겨 있다"고 단정하는 근거로 쓰면 안 됩니다.** 시연 전에 실제
     * 값을 확인하거나 백엔드에 시드 값을 물어보세요.
     */
    lockStatus: LockStatus;
    /** 보강 — 갱신 시각 */
    updatedAt: string;
    /** 시드 문서의 「화면상 의미」 칸. 주석용이고 화면에 나가지 않습니다. */
    meaning: string;
}

/**
 * 시드 문서 「슬롯 5개」 표.
 *
 * 화면별 테스트 상태를 하나씩 대표하도록 백엔드가 일부러 구성한 것입니다. 순서를 바꾸거나
 * 상태를 손보면 그 의도가 깨집니다.
 */
export const SEED_SLOTS: readonly SeedSlot[] = [
    {
        slotNumber: 1,
        slotId: 'c23e468e-f94e-442a-afd4-00a44d002f1a',
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'AVAILABLE',
        itemCondition: 'NORMAL',
        lockStatus: 'LOCKED',
        updatedAt: seedAt('09:19'),
        meaning: '정상, 대여 가능 — 이력에 「정상 반납 이력」 1건 연결',
    },
    {
        slotNumber: 2,
        slotId: 'b656932f-dcaf-4c94-b291-18bd2b23c68e',
        occupancyStatus: 'EMPTY',
        serviceStatus: 'AVAILABLE',
        itemCondition: null,
        lockStatus: 'LOCKED',
        updatedAt: seedAt('08:52'),
        meaning: '대여 중 — 김학생이 빌려가서 슬롯이 빈 상태',
    },
    {
        slotNumber: 3,
        slotId: '9fba2735-24e0-4626-af8b-dfef47ef2455',
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'ADMIN_REVIEW',
        itemCondition: 'UNKNOWN',
        lockStatus: 'LOCKED',
        updatedAt: seedAt('09:12'),
        meaning: '검수 대기중 — AI가 파손 의심(DAMAGED) 판정, 관리자 미결정',
    },
    {
        slotNumber: 4,
        slotId: 'a451cec4-39b1-48aa-9207-ac513ea96b5b',
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'OUT_OF_SERVICE',
        itemCondition: 'DAMAGED',
        lockStatus: 'LOCKED',
        updatedAt: seedAt('08:40'),
        meaning: '파손 확정 — 관리자가 DAMAGED로 판정, 정산 7,000원 생성됨',
    },
    {
        slotNumber: 5,
        slotId: 'd616208a-1d28-4bcd-9e55-8b1ea1daa755',
        occupancyStatus: 'OCCUPIED',
        serviceStatus: 'ADMIN_REVIEW',
        itemCondition: 'REPAIRABLE',
        lockStatus: 'LOCKED',
        updatedAt: seedAt('09:05'),
        meaning: '수리 필요 — 관리자가 수동 지정한 「수리 가능」 상태 (검수 이력 없음)',
    },
];

/* ═══════════════════════════════════════════════════════════════ 검수 (전사) */

export interface SeedInspection {
    /** 전사 */
    inspectionId: string;
    /** 전사 — 어느 슬롯의 검수인지 */
    slotNumber: number;
    /** 전사 */
    aiResult: AiInspectionResult;
    /** 전사 */
    reviewStatus: 'PENDING' | 'DECIDED';
    /** 전사 — 미처리면 null */
    decision: InspectionDecision | null;
    /**
     * 보강 — **AI 신뢰도**. 시드 문서에 없어 목업이 채운 값입니다.
     *
     * ⚠️ **파손 확률이 아니라 「그 판정을 얼마나 확신하는가」입니다.** 화면 라벨도
     * 「신뢰도」이고 계약(12-R)도 같은 말을 씁니다. 그래서 `NORMAL` 이든 `DAMAGED` 든
     * **판정이 확실하면 높은 값**입니다.
     *
     * 처음에는 정상 판정에 `0.12` 를 넣었었습니다 — 파손 확률로 착각해 "정상이니까 낮게"
     * 채운 값인데, 화면에는 「정상 판정 · 신뢰도 0.12」로 떠서 "확신도 없이 통과시켰다"로
     * 읽혔습니다.
     *
     * TODO: EC2 DB 의 실제 `ai_score` 값을 백엔드에 확인하세요. 이 숫자는 추정입니다.
     */
    aiScore: number;
    /** 보강 — 추론 시각. 슬롯이 갱신되기 전에 끝나 있어야 앞뒤가 맞습니다. */
    processedAt: string;
    /** 시드 문서의 「비고」 칸 */
    note: string;
}

/**
 * 시드 문서 「검수(Inspection) 3건」 표.
 *
 * **슬롯 5는 검수가 없습니다.** `ADMIN_REVIEW` 인데도요 — 관리자가 검수를 거치지 않고
 * 슬롯 상태만 수동으로 「수리 가능」으로 지정한 경우입니다. 예전 목업은 `ADMIN_REVIEW`
 * 슬롯이면 검수를 자동으로 만들어 붙였는데, 실제 데이터에는 그런 규칙이 없습니다.
 */
export const SEED_INSPECTIONS: readonly SeedInspection[] = [
    {
        inspectionId: '50d05540-3f51-4c8f-80cb-b78d1cd70888',
        slotNumber: 3,
        aiResult: 'DAMAGED',
        reviewStatus: 'PENDING',
        decision: null,
        aiScore: 0.87,
        processedAt: seedAt('09:03'),
        note: '검수 대기 목록에서 판정 테스트용',
    },
    {
        inspectionId: '964496a7-6ca0-42a3-8246-d1d8fa059057',
        slotNumber: 4,
        aiResult: 'DAMAGED',
        reviewStatus: 'DECIDED',
        decision: 'DAMAGED',
        aiScore: 0.94,
        processedAt: seedAt('08:31'),
        note: '정산 연결됨',
    },
    {
        inspectionId: '7aa9f1b8-104e-4eb5-b0b0-a330429c577c',
        slotNumber: 1,
        aiResult: 'NORMAL',
        reviewStatus: 'DECIDED',
        decision: 'NORMAL',
        // 정상이라고 확신한 건입니다. 파손 건들과 마찬가지로 높은 값이어야 맞습니다.
        aiScore: 0.93,
        processedAt: seedAt('09:10'),
        note: '정산 없음',
    },
];

/** 보강 — 추론 모델 버전. 시드 문서에 없습니다. */
export const SEED_MODEL_VERSION = 'v1.2.0';

/* ═══════════════════════════════════════════════════════════════ 관리자 (전사) */

/**
 * 시드 문서 「로그인 계정」 표의 관리자.
 *
 * 비밀번호는 여기 적지 않습니다 — 실행 환경(`.env.development` 의 `VITE_DEMO_ADMIN_*`)에
 * 둡니다 (상위 기획 §4: "시연 비밀번호 원문을 저장소·소스 코드에 고정하지 않는다").
 */
export const SEED_ADMIN = {
    /** 전사 */
    loginId: 'admin@billisan.demo',
    /** 보강 — 판정 이력의 `decidedBy` 가 필요로 합니다. 시드 문서에 UUID 가 없습니다. */
    adminId: 'a0d5c31e-7b42-4f88-9e16-3c7f0a5d9001',
} as const;

/* ═══════════════════════════════════════════════════════════ 사용자 (전사) */

export interface SeedUser {
    /** 전사 — 로그인 ID */
    loginId: string;
    /** 전사 — 이름 */
    name: string;
    /** 전사 — 학번 */
    studentNo: string;
    /** 보강 — ERD `USER_ACCOUNT.user_ref` 가명 UUID. 시드 문서에 없습니다. */
    userRef: string;
}

/**
 * 시드 문서 「로그인 계정」 표의 사용자 4명. 관리자 계정은 `.env.development` 에 있습니다.
 *
 * ⚠️ **`userRef` 는 앞 8자가 서로 달라야 합니다.**
 * 화면은 내부 식별자를 **앞 8자 + `…`** 로 축약해 보여 줍니다 (화면흐름 §12). 처음에는
 * 네 사람을 `b1f6e0c4-…-2001`~`2004` 로 뒷자리만 다르게 뒀는데, 표에서 넷 다
 * `b1f6e0c4…` 로 똑같이 나와 **누가 누구인지 구분이 안 됐습니다.** 실제 서버 UUID 는
 * 전 구간이 무작위라 이런 일이 없습니다 — 목업이 규칙적인 값을 쓰다 만든 함정입니다.
 */
export const SEED_USERS: readonly SeedUser[] = [
    {
        loginId: 'student1@billisan.demo',
        name: '김학생',
        studentNo: '202400001',
        userRef: '3f8a21c7-4d1e-4a62-9c05-7b2e4f8a1001',
    },
    {
        loginId: 'student2@billisan.demo',
        name: '이학생',
        studentNo: '202400002',
        userRef: '9b45e0d2-7c31-4f08-a51d-2e6b9d4c1002',
    },
    {
        loginId: 'student3@billisan.demo',
        name: '박학생',
        studentNo: '202400003',
        userRef: 'c72d6f14-8b90-4e35-b7a2-4f1c8e5d1003',
    },
    {
        loginId: 'student4@billisan.demo',
        name: '최학생',
        studentNo: '202400004',
        userRef: '5e19b8a3-2a67-4c94-8d3f-6b0a7e2f1004',
    },
];

/* ═══════════════════════════════════════════════════════════════ 대여 (전사) */

export interface SeedRental {
    /** 전사 */
    rentalId: string;
    /** 전사 — 학번으로 사용자를 가립니다 */
    studentNo: string;
    /** 전사 — 인출 슬롯 */
    slotNumber: number;
    /** 전사 */
    status: 'ACTIVE' | 'RETURNING' | 'COMPLETED' | 'LOST';
    /** 보강 — 대여 시각 */
    rentedAt: string;
    /** 보강 — 반납 기한 */
    dueAt: string;
    /**
     * 보강 — 이 대여에 딸린 반납 시도 ID.
     *
     * **시드 문서에 반납 시도(RETURN_ATTEMPT) 표가 없습니다.** 그런데 검수 응답의
     * `returnAttemptId` 는 필수 필드고 반납 이력 화면도 이 단위로 돕니다. 그래서
     * 목업이 만들어 채웁니다. `status: ACTIVE` 인 대여는 아직 반납이 없어 null 입니다.
     */
    returnAttemptId: string | null;
}

/**
 * 시드 문서 「대여(Rental) 4건」 표.
 *
 * ⚠️ **시드 문서는 이 셋을 `RETURNING` 으로 적었지만 `COMPLETED` 로 둡니다.**
 *
 * 문서 「참고」 항목이 밝힌 대로, 그 값은 반납 상태 머신(Backend 2/3 영역)이 아직
 * 완주하지 않아 중간에 멈춘 것입니다 — `PHYSICAL_DONE`(우산은 들어갔는데 서버가 대여를
 * 못 닫음)에 해당합니다. **완성되면 몇 초 만에 `COMPLETED` 가 됩니다.**
 *
 * 관리자가 반납 이력을 여는 시점에 그 몇 초를 볼 일은 없고, 봐도 할 일이 없습니다.
 * 미완성 중간 상태를 화면의 기본값처럼 보여 주면 시연에서 「물리 완료」 세 건이
 * 정상인 것처럼 읽힙니다. 그래서 **완성된 시스템의 모습**으로 맞춥니다.
 *
 * 오래 멈춰 있는 반납은 `RECOVERY_REQUIRED` 가 표현합니다 — 그건 지어내지 않습니다.
 */
export const SEED_RENTALS: readonly SeedRental[] = [
    {
        rentalId: '8c1e78f4-cc39-4b36-a671-78fa8a14f7e7',
        studentNo: '202400001',
        slotNumber: 2,
        status: 'ACTIVE',
        rentedAt: seedAt('08:52'),
        dueAt: seedAt('08:52', '2026-08-02'),
        returnAttemptId: null,
    },
    {
        rentalId: '683578ad-f5bd-48e3-90ba-dd041645d2f3',
        studentNo: '202400002',
        slotNumber: 1,
        status: 'COMPLETED',
        rentedAt: seedAt('07:40', '2026-07-31'),
        dueAt: seedAt('07:40'),
        returnAttemptId: 'e1a70d55-3c48-4b19-8f21-0d5a9c3b7001',
    },
    {
        rentalId: '53986655-6b48-4af2-9893-dee0f58fd828',
        studentNo: '202400003',
        slotNumber: 3,
        status: 'COMPLETED',
        rentedAt: seedAt('07:12', '2026-07-31'),
        dueAt: seedAt('07:12'),
        returnAttemptId: 'e1a70d55-3c48-4b19-8f21-0d5a9c3b7002',
    },
    {
        rentalId: '48b931c4-9367-4f3f-98d3-41c37a11b3aa',
        studentNo: '202400004',
        slotNumber: 4,
        status: 'COMPLETED',
        rentedAt: seedAt('06:55', '2026-07-31'),
        dueAt: seedAt('06:55'),
        returnAttemptId: 'e1a70d55-3c48-4b19-8f21-0d5a9c3b7003',
    },
];

/* ═══════════════════════════════════════════════════════════════ 정산 (전사) */

/**
 * 시드 문서 「정산(Settlement) 1건」 표.
 *
 * 슬롯4 파손 판정(`964496a7…`)에서 나온 정산입니다. 최학생의 대여에 붙습니다.
 */
export const SEED_SETTLEMENT = {
    /** 전사 */
    settlementId: 'da4f6574-1adc-41dc-9585-f6d47ef1e8f6',
    /** 전사 — 최학생의 대여 */
    rentalId: '48b931c4-9367-4f3f-98d3-41c37a11b3aa',
    /** 전사 */
    reason: 'DAMAGE',
    /** 전사 */
    amount: 7000,
    /** 전사 */
    status: 'PENDING',
    /* ↓ 보강 */
    paidAmount: 0,
    createdAt: seedAt('08:41'),
} as const;

/* ═════════════════════════════════════════════════════════════════ 조회 도우미 */

/** 슬롯 번호 → 시드 슬롯. 없는 번호면 `undefined`. */
export function seedSlotOf(slotNumber: number): SeedSlot | undefined {
    return SEED_SLOTS.find((slot) => slot.slotNumber === slotNumber);
}

/** 슬롯 ID → 시드 슬롯. */
export function seedSlotById(slotId: string): SeedSlot | undefined {
    return SEED_SLOTS.find((slot) => slot.slotId === slotId);
}

/** 그 슬롯에 걸린 검수. 슬롯5처럼 검수가 없는 슬롯이면 `undefined`. */
export function seedInspectionOfSlot(slotNumber: number): SeedInspection | undefined {
    return SEED_INSPECTIONS.find((inspection) => inspection.slotNumber === slotNumber);
}

/** 학번 → 시드 사용자. */
export function seedUserOf(studentNo: string): SeedUser | undefined {
    return SEED_USERS.find((user) => user.studentNo === studentNo);
}

/** 그 슬롯에서 나간 대여. */
export function seedRentalOfSlot(slotNumber: number): SeedRental | undefined {
    return SEED_RENTALS.find((rental) => rental.slotNumber === slotNumber);
}
