import { describe, expect, it } from 'vitest';

import spec from '../../docs/api-docs.json';
import { inspectionsApi } from '@/features/inspections/api/inspectionsApi';
import { stationsApi } from '@/features/stations/api/stationsApi';
import {
    SEED_INSPECTIONS,
    SEED_SLOTS,
    SEED_STATION,
    seedSlotOf,
} from '@/features/stations/mocks/ec2Seed';
import type { InspectionDecisionInput } from '@/features/inspections/types';

/**
 * 계약 테스트 — **목업이 서버 OpenAPI 스펙을 지키는지 검사합니다.**
 *
 * 지금까지 "목업이 실 API 와 같은 모양인가" 는 사람이 눈으로 대조했습니다. 그러다
 * `aiResult` 필터에 서버 enum 에 없는 `FAILED` 를 넣어 두고도 목업에서는 통과해서,
 * 실 API 로 갈아탔을 때만 400 이 나는 상태로 오래 있었습니다.
 *
 * 이 파일은 그런 어긋남을 **빌드 때 잡습니다.** `docs/api-docs.json`(2026-08-03 스냅샷)의
 * 스키마로 목업 응답을 직접 검증합니다. 네트워크는 쓰지 않습니다 — 스펙은 파일입니다.
 *
 * 스펙이 낡으면 이 테스트도 낡습니다. 백엔드가 API 를 바꾸면 `docs/README.md` 절차대로
 * 스펙을 다시 받아 덮어쓰세요.
 */

/* ────────────────────────────────────────────── 최소 JSON Schema 검증기 */

interface Schema {
    $ref?: string;
    type?: string;
    format?: string;
    enum?: string[];
    items?: Schema;
    properties?: Record<string, Schema>;
    required?: string[];
}

interface Operation {
    parameters?: Array<{ name: string; required?: boolean; schema?: Schema }>;
}

/*
 * `spec` 은 JSON import 라 TS 가 리터럴 그대로의 아주 좁은 타입을 만듭니다. 경로마다
 * 있는 메서드가 달라서(`get` 만, `post` 만) 구조를 그대로 쓰면 인덱스 시그니처가 안 맞습니다.
 * 검증기가 볼 건 스키마·파라미터뿐이라 필요한 모양으로만 좁혀 읽습니다.
 */
const SCHEMAS = (spec as unknown as { components: { schemas: Record<string, Schema> } }).components
    .schemas;
const PATHS = (spec as unknown as { paths: Record<string, Record<string, Operation>> }).paths;

/** `GET /inspections` 의 query 파라미터. 필터 값이 계약 enum 인지 볼 때 씁니다. */
function inspectionListParams(): NonNullable<Operation['parameters']> {
    return PATHS['/api/v1/admin/inspections'].get.parameters ?? [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 서버 `DATETIME(6)`. 오프셋 있는 ISO-8601 이면 됩니다. */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)?$/;

function resolve(schema: Schema): Schema {
    return schema.$ref ? SCHEMAS[schema.$ref.split('/').pop()!] : schema;
}

/**
 * 값이 스키마를 지키는지. 어긋난 곳을 `필드 경로: 이유` 로 모아 돌려줍니다.
 *
 * **`null` 은 통과시킵니다.** 스펙이 OpenAPI 3.1 인데 springdoc 이 nullable 을 표기하지
 * 않아서, `null` 을 오류로 잡으면 정상인 필드(미판정 검수의 `decision` 등)가 전부 걸립니다.
 * 대신 아래 별도 테스트가 "필수 필드는 `undefined` 가 아니다" 를 따로 봅니다.
 */
function violations(value: unknown, schema: Schema, path = ''): string[] {
    const s = resolve(schema);
    const at = path || '(root)';

    if (value === null || value === undefined) return [];

    if (s.enum && !s.enum.includes(value as string)) {
        return [`${at}: '${String(value)}' 는 허용값(${s.enum.join('|')})이 아님`];
    }

    switch (s.type) {
        case 'array': {
            if (!Array.isArray(value)) return [`${at}: 배열이어야 함 (실제 ${typeof value})`];
            return s.items
                ? value.flatMap((item, i) => violations(item, s.items!, `${at}[${i}]`))
                : [];
        }
        case 'integer':
        case 'number':
            if (typeof value !== 'number') return [`${at}: 숫자여야 함 (실제 ${typeof value})`];
            if (s.type === 'integer' && !Number.isInteger(value))
                return [`${at}: 정수여야 함 (실제 ${value})`];
            return [];
        case 'boolean':
            return typeof value === 'boolean' ? [] : [`${at}: boolean 이어야 함`];
        case 'string': {
            if (typeof value !== 'string') return [`${at}: 문자열이어야 함 (실제 ${typeof value})`];
            if (s.format === 'uuid' && !UUID.test(value)) return [`${at}: UUID 형식이 아님 — ${value}`];
            if (s.format === 'date-time' && !DATE_TIME.test(value))
                return [`${at}: date-time 형식이 아님 — ${value}`];
            return [];
        }
        case 'object':
        default: {
            if (!s.properties) return [];
            if (typeof value !== 'object') return [`${at}: 객체여야 함 (실제 ${typeof value})`];
            const obj = value as Record<string, unknown>;
            return [
                ...(s.required ?? [])
                    .filter((key) => obj[key] === undefined)
                    .map((key) => `${at}.${key}: 필수인데 없음`),
                ...Object.entries(s.properties).flatMap(([key, sub]) =>
                    key in obj ? violations(obj[key], sub, `${at}.${key}`) : [],
                ),
            ];
        }
    }
}

/** 스펙에 없는데 목업이 덧붙인 필드. 오류는 아니지만 알고 있어야 합니다. */
function extraKeys(value: unknown, schema: Schema): string[] {
    const s = resolve(schema);
    if (!s.properties || typeof value !== 'object' || value === null) return [];
    return Object.keys(value as object).filter((key) => !(key in s.properties!));
}

function check(value: unknown, schemaName: string) {
    expect(SCHEMAS[schemaName], `스펙에 ${schemaName} 스키마가 없습니다`).toBeDefined();
    expect(violations(value, { $ref: `#/components/schemas/${schemaName}` }), schemaName).toEqual(
        [],
    );
}

/* ────────────────────────────────────────────────────── 스펙 자체 확인 */

describe('스펙 스냅샷', () => {
    it('관리자 경로 8개가 그대로다', () => {
        const admin = Object.entries(PATHS)
            .filter(([p]) => p.startsWith('/api/v1/admin/'))
            .flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`))
            .sort();

        expect(admin).toEqual(
            [
                'POST /api/v1/admin/auth/login',
                'GET /api/v1/admin/stations/{stationId}/inventory',
                'GET /api/v1/admin/stations/{stationId}/slots',
                'GET /api/v1/admin/slots/{slotId}',
                'PATCH /api/v1/admin/slots/{slotId}/status',
                'GET /api/v1/admin/inspections',
                'GET /api/v1/admin/inspections/{inspectionId}',
                'PATCH /api/v1/admin/inspections/{inspectionId}/decision',
            ].sort(),
        );
    });

    it('이 스냅샷엔 아직 없다 — 갱신되면 이 테스트가 알려 준다', () => {
        /*
         * `/auth/logout` 은 백엔드에 이미 구현됐지만(`AdminAuthController`), 이 파일은
         * 2026-08-03 스냅샷이라 아직 반영이 안 됐습니다(`docs/README.md` — 갱신은 수동).
         * `/auth/me` 는 세션 복원용이라 아직 백엔드에도 없습니다. 스냅샷을 다시 받았을 때
         * 여기가 깨지면 각 경로의 실 구현 여부를 다시 확인하라는 신호입니다.
         */
        const paths = Object.keys(PATHS);
        expect(paths).not.toContain('/api/v1/admin/auth/me');
        expect(paths).not.toContain('/api/v1/admin/auth/logout');
    });
});

describe('스펙이 안 주는 값을 목업이 지어내지 않는다', () => {
    /*
     * 목업이 실 API 보다 **더 많이 아는 척**하면, 목업에서만 초록불이고 실 API 로
     * 갈아탄 순간 회색이 됩니다. 화면이 모드에 따라 달라지면 목업으로 확인한 게
     * 아무 보증이 안 됩니다.
     */
    it('장치 상태를 주는 응답 필드가 스펙에 없다', () => {
        const fields = Object.values(SCHEMAS).flatMap((s) => Object.keys(s.properties ?? {}));
        expect(fields).not.toContain('deviceStatus');
        expect(fields).not.toContain('device_status');
        expect(fields).not.toContain('lastSeenAt');
    });

    it('그래서 목업 대여소의 deviceStatus 도 null 이다 — 실 모드와 같은 값', () => {
        /*
         * 회귀 테스트. 예전 목업은 `'ONLINE'` 을 박아 두어 「ON · 장치 연결됨」 초록 배지가
         * 떴습니다. 실 모드(`composeStation`)는 같은 자리에 `null` 을 넣어 「확인 불가」를
         * 그립니다. 함이 꺼져 있어도 서버는 DB 슬롯 행을 돌려주므로, 초록 배지는 근거 없는
         * 안심이었습니다.
         */
        expect(SEED_STATION.deviceStatus).toBeNull();
    });

    it('lockStatus 는 반대다 — 서버가 주므로 목업이 값을 들고 있어야 한다', () => {
        // 스펙에 있는 필드라 실 API 가 진짜 값으로 덮어씁니다. 목업 값은 추측이어도 됩니다.
        expect(Object.keys(SCHEMAS.SlotSummaryResponse.properties!)).toContain('lockStatus');
        for (const slot of SEED_SLOTS) {
            expect(slot.lockStatus, `슬롯 ${slot.slotNumber}`).toBeTruthy();
        }
    });
});

/* ───────────────────────────────────────── 목업 응답 vs 서버 스키마 */

describe('ADMIN-INVENTORY-001 — GET /stations/{id}/inventory', () => {
    it('목업 응답이 SlotInventoryResponse 를 지킨다', async () => {
        check(await stationsApi.inventory(SEED_STATION.stationId), 'SlotInventoryResponse');
    });

    it('집계가 시드 슬롯 5개와 맞는다', async () => {
        const inv = await stationsApi.inventory(SEED_STATION.stationId);
        expect(inv.totalSlotCount).toBe(SEED_SLOTS.length);
        // 집계 항목은 서로 겹칠 수 있어 단순 합산하지 않습니다 (명세 주석).
        expect(inv.occupiedSlotCount + inv.emptySlotCount).toBeLessThanOrEqual(inv.totalSlotCount);
        expect(inv.availableUmbrellaCount).toBeLessThanOrEqual(inv.occupiedSlotCount);
    });
});

describe('ADMIN-SLOT-001 — GET /stations/{id}/slots', () => {
    it('목업 응답이 SlotListResponse 를 지킨다', async () => {
        check(await stationsApi.slots(SEED_STATION.stationId), 'SlotListResponse');
    });

    it('시드 슬롯 5개가 ID 까지 그대로 나온다', async () => {
        const { items } = await stationsApi.slots(SEED_STATION.stationId);
        expect(items.map((s) => s.slotId)).toEqual(SEED_SLOTS.map((s) => s.slotId));
    });
});

describe('ADMIN-SLOT-DETAIL-001 — GET /slots/{slotId}', () => {
    it('시드 슬롯 5개 전부 SlotDetailResponse 를 지킨다', async () => {
        for (const seed of SEED_SLOTS) {
            const detail = await stationsApi.slotDetail(seed.slotId);
            expect(detail, `슬롯 ${seed.slotNumber}`).not.toBeNull();
            check(detail, 'SlotDetailResponse');
        }
    });

    it('검수가 없는 슬롯은 latestInspection 이 null 이다', async () => {
        // 시드 슬롯5 — ADMIN_REVIEW 인데 관리자가 상태만 수동 지정해 검수가 없습니다.
        const detail = await stationsApi.slotDetail(seedSlotOf(5)!.slotId);
        expect(detail?.latestInspection).toBeNull();
    });
});

describe('ADMIN-INSPECTION-001 — GET /inspections', () => {
    it('목업 응답이 InspectionPageResponse 를 지킨다', async () => {
        check(await inspectionsApi.list({ size: 100 }), 'InspectionPageResponse');
    });

    it('시드 검수 3건이 그대로 나온다', async () => {
        const page = await inspectionsApi.list({ size: 100 });
        expect(page.items.map((i) => i.inspectionId).sort()).toEqual(
            SEED_INSPECTIONS.map((i) => i.inspectionId).sort(),
        );
    });

    it('미처리 우선 · 같은 상태에서는 processedAt 내림차순', async () => {
        const { items } = await inspectionsApi.list({ size: 100 });
        const rank = (s: string) => (s === 'PENDING' ? 0 : 1);
        for (let i = 1; i < items.length; i += 1) {
            const [prev, cur] = [items[i - 1], items[i]];
            if (rank(prev.reviewStatus) !== rank(cur.reviewStatus)) {
                expect(rank(prev.reviewStatus)).toBeLessThan(rank(cur.reviewStatus));
            } else {
                expect(prev.processedAt >= cur.processedAt).toBe(true);
            }
        }
    });

    it('필터 값이 서버 query enum 안에 있다', () => {
        /*
         * 이 테스트가 `FAILED` 버그를 잡습니다. 화면 드롭다운이 보낼 수 있는 값은
         * 반드시 스펙의 enum 이어야 합니다 — 아니면 실 API 에서 400 입니다.
         */
        const params = inspectionListParams();
        const aiEnum = params.find((p) => p.name === 'aiResult')!.schema!.enum!;
        const reviewEnum = params.find((p) => p.name === 'reviewStatus')!.schema!.enum!;

        expect(aiEnum).toEqual(['NORMAL', 'DAMAGED', 'UNCERTAIN']);
        expect(reviewEnum).toEqual(['PENDING', 'DECIDED']);
        // 목업 검수의 aiResult 도 서버가 필터로 받는 값 안에 있어야 짝이 맞습니다.
        for (const seed of SEED_INSPECTIONS) {
            expect(aiEnum, `검수 ${seed.inspectionId}`).toContain(seed.aiResult);
        }
    });

    it('X-Request-Id 가 필수 파라미터다 — 인터셉터가 붙이고 있다', () => {
        expect(inspectionListParams().find((p) => p.name === 'X-Request-Id')?.required).toBe(true);
    });
});

describe('ADMIN-INSPECTION-002 — GET /inspections/{id}', () => {
    it('시드 검수 3건 전부 InspectionDetailResponse 를 지킨다', async () => {
        for (const seed of SEED_INSPECTIONS) {
            const detail = await inspectionsApi.detail(seed.inspectionId);
            expect(detail, `검수 ${seed.inspectionId}`).not.toBeNull();
            check(detail, 'InspectionDetailResponse');
        }
    });

    it('없는 ID 는 null 이다 — 오류 화면이 아니라 NotFound 로 가린다', async () => {
        expect(await inspectionsApi.detail('00000000-0000-4000-8000-000000000000')).toBeNull();
    });

    it('목업이 덧붙인 필드는 stationName·slotNumber 둘뿐이다', async () => {
        /*
         * 실 응답에 없는 값이라 api 모듈이 다른 계약 API 로 짜 맞춰 채웁니다.
         * 셋 이상이 되면 "서버가 준 값" 과 "우리가 만든 값" 의 경계가 흐려집니다.
         */
        const detail = await inspectionsApi.detail(SEED_INSPECTIONS[0].inspectionId);
        expect(extraKeys(detail, { $ref: '#/components/schemas/InspectionDetailResponse' }).sort())
            .toEqual(['slotNumber', 'stationName']);
    });
});

describe('ADMIN-INSPECTION-003 — PATCH /inspections/{id}/decision', () => {
    it('화면이 만드는 요청 본문이 InspectionDecisionRequest 를 지킨다', () => {
        const input: InspectionDecisionInput = {
            decision: 'DAMAGED',
            reasonCode: 'CANOPY_TORN',
            note: '캐노피 파손',
            physicalStateConfirmed: true,
            expectedUpdatedAt: seedSlotOf(3)!.updatedAt,
        };
        check(input, 'InspectionDecisionRequest');
    });

    it('판정 세 값이 서버 enum 그대로다', () => {
        expect(SCHEMAS.InspectionDecisionRequest.properties!.decision.enum).toEqual([
            'NORMAL',
            'DAMAGED',
            'KEEP_ADMIN_REVIEW',
        ]);
    });

    it('스펙상 필수는 decision·expectedUpdatedAt 둘뿐이다 — reasonCode 는 optional', () => {
        /*
         * ⚠️ 우리 코드는 `reasonCode` 를 **필수**로 다룹니다 (없으면 422
         * `ADMIN_REASON_REQUIRED` 라는 주석 근거). 스펙과 어긋나는 자리라 기록해 둡니다.
         * 서버가 조건부로 검증하는 것으로 보이고, 우리는 항상 보내므로 당장 문제는 없습니다.
         * TODO: 백엔드에 확인하고, 서버가 required 로 바꾸면 이 테스트를 뒤집으세요.
         */
        expect(SCHEMAS.InspectionDecisionRequest.required).toEqual([
            'decision',
            'expectedUpdatedAt',
        ]);
    });
});

describe('ADMIN-SLOT-STATUS-001 — PATCH /slots/{id}/status', () => {
    it('허용 조합 enum 이 우리 타입과 같다', () => {
        const props = SCHEMAS.SlotStatusUpdateRequest.properties!;
        expect(props.targetServiceStatus.enum).toEqual([
            'AVAILABLE',
            'ADMIN_REVIEW',
            'OUT_OF_SERVICE',
        ]);
        expect(props.targetItemCondition.enum).toEqual([
            'EMPTY',
            'NORMAL',
            'DAMAGED',
            'REPAIRABLE',
            'UNKNOWN',
        ]);
    });

    it('시드 슬롯 5개의 4축이 전부 허용 enum 안에 있다', () => {
        const props = SCHEMAS.SlotStatusUpdateRequest.properties!;
        for (const slot of SEED_SLOTS) {
            expect(props.targetServiceStatus.enum, `슬롯 ${slot.slotNumber}`).toContain(
                slot.serviceStatus,
            );
            if (slot.itemCondition !== null) {
                expect(props.targetItemCondition.enum, `슬롯 ${slot.slotNumber}`).toContain(
                    slot.itemCondition,
                );
            }
        }
    });
});

/* ─────────────────────────────────────────────────────── 로그인 (참고) */

describe('ADMIN-AUTH-001 — POST /auth/login', () => {
    it('요청 필드가 loginId · password 두 개다', () => {
        expect(SCHEMAS.AdminLoginRequest.required).toEqual(['loginId', 'password']);
    });

    it('응답에 세션 만료 두 축이 있다 — 유휴 30분 · 절대 8시간', () => {
        const props = Object.keys(SCHEMAS.AdminLoginResponse.properties!);
        expect(props).toContain('idleExpiresAt');
        expect(props).toContain('absoluteExpiresAt');
        expect(props).toContain('accessToken');
    });
});
