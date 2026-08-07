import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * **`env` 모듈을 통째로 바꿉니다.**
 *
 * `config/env.ts` 는 `import.meta.env` 를 모듈 로드 시점에 읽어 상수로 굳힙니다.
 * 그래서 `vi.stubEnv` 로는 이미 굳은 값을 못 바꿉니다 — 실 API 분기를 시험하려면
 * 모듈 자체를 대체해야 합니다.
 */
vi.mock('@/config/env', () => ({
    env: {
        apiBaseUrl: '/api/v1/admin',
        appName: '빌리산 관리자',
        isDev: false,
        authBypass: false,
        mockAuth: false,
        useMockData: false,
        demoAdminId: '',
        demoAdminPassword: '',
    },
}));

import { REAL_STATIONS } from '@/features/stations/api/stationSeed';
import { __resetAbsentStations, stationsApi } from '@/features/stations/api/stationsApi';
import { http } from '@/lib/axios';
import { ApiRequestError } from '@/lib/api-error';

/**
 * 실 API 모드의 대여소 조회.
 *
 * **대여소 목록 API 가 없습니다.** 그래서 `stationId` 를 우리가 알아내야 하는데,
 * 예전에는 `stationSeed.ts` 에 UUID 를 박아 두고 그것만 조회했습니다. 문제 둘:
 *
 *   1. DB 가 다시 시드되어 UUID 가 바뀌면 화면이 통째로 404 (V19 픽스처가 그 경우)
 *   2. `Promise.all` 이라 대여소 하나가 실패하면 **목록 전체**가 오류 화면
 *
 * 이 파일은 그 둘이 되돌아오지 않는지 봅니다. 네트워크는 쓰지 않고 `http` 를 가로챕니다.
 */

const SEEDED = '186c47d2-6553-4b36-8d7e-de810f40010d';
/**
 * 서버에는 있지만 우리 명부에 없는 대여소 — 검수 응답으로만 알 수 있습니다.
 *
 * **명부에 없는 값이어야 합니다.** 예전에는 여기에 픽스처 대여소
 * (`22000000…0001`)를 썼는데, 그게 명부에 추가되면서 「이름 없는 대여소」를
 * 검증하던 테스트가 이름을 갖게 돼 통과 의미가 사라졌습니다.
 */
const DISCOVERED = '44000000-0000-4000-8000-0000000000ff';

function inventoryOf(stationId: string) {
    return {
        data: {
            stationId,
            totalSlotCount: 5,
            occupiedSlotCount: 4,
            emptySlotCount: 1,
            unknownOccupancySlotCount: 0,
            availableUmbrellaCount: 1,
            adminReviewSlotCount: 2,
            outOfServiceSlotCount: 1,
            damagedUmbrellaCount: 1,
            asOf: '2026-08-01T14:30:00.000000+09:00',
        },
    };
}

function notFound() {
    return Promise.reject(
        new ApiRequestError({ message: '대여소를 찾을 수 없습니다.', statusCode: 404 }),
    );
}

/** 네트워크 대신 이 함수가 응답합니다. */
function mockRealMode(get: (url: string) => Promise<unknown>) {
    vi.spyOn(http, 'get').mockImplementation(get as never);
}

afterEach(() => {
    vi.restoreAllMocks();
    // 「없는 대여소」 기억은 모듈 전역이라 안 비우면 다음 테스트로 새어 나갑니다.
    __resetAbsentStations();
});

describe('대여소 목록 — 한 곳이 실패해도 나머지는 살린다', () => {
    it('명부의 UUID 가 서버에 없어도 목록이 통째로 죽지 않는다', async () => {
        /*
         * 회귀 테스트. `Promise.all` 이던 시절에는 여기서 목록 전체가 reject 되어
         * 「데이터를 불러오지 못했습니다」 한 장만 떴습니다. 멀쩡한 대여소가 있는데도요.
         */
        mockRealMode((url) => {
            if (url.includes('/inspections')) {
                return Promise.resolve({ data: { items: [{ stationId: DISCOVERED }] } });
            }
            // 명부가 통째로 낡은 상황 — 발견된 대여소만 서버에 실재합니다.
            if (!url.includes(DISCOVERED)) return notFound();
            return Promise.resolve(inventoryOf(DISCOVERED));
        });

        const stations = await stationsApi.list();
        expect(stations.map((s) => s.stationId)).toEqual([DISCOVERED]);
    });

    it('404 를 받은 대여소는 다음 조회에서 다시 묻지 않는다', async () => {
        /*
         * 명부에 시드 출처가 셋이라 후보가 세 개인데 실서버엔 하나뿐입니다(실측).
         * 매번 다 찌르면 목록을 열 때마다 백엔드 로그에 404 가 두 줄씩 쌓입니다.
         * 화면을 몇 번만 오가도 수십 줄이라, 팀 서버 로그를 더럽히지 않게 기억합니다.
         */
        const asked: string[] = [];
        mockRealMode((url) => {
            if (url.includes('/inspections')) {
                return Promise.resolve({ data: { items: [{ stationId: DISCOVERED }] } });
            }
            asked.push(url);
            if (!url.includes(DISCOVERED)) return notFound();
            return Promise.resolve(inventoryOf(DISCOVERED));
        });

        await stationsApi.list();
        const firstRound = asked.length;
        expect(firstRound, '첫 조회는 명부 전체를 찔러 봅니다').toBeGreaterThan(1);

        asked.length = 0;
        await stationsApi.list();

        expect(asked, '404 났던 대여소를 다시 물었습니다').toHaveLength(1);
        expect(asked[0]).toContain(DISCOVERED);
    });

    it('500 은 기억하지 않는다 — 잠깐 죽은 것을 없는 대여소로 굳히지 않는다', async () => {
        /*
         * 404 만 "없다"입니다. 서버가 잠깐 죽었을 때 후보에서 빼 버리면, 복구된 뒤에도
         * 새로고침 전까지 그 대여소가 안 보입니다.
         */
        const asked: string[] = [];
        mockRealMode((url) => {
            if (url.includes('/inspections')) return Promise.resolve({ data: { items: [] } });
            asked.push(url);
            return Promise.reject(new ApiRequestError({ message: '서버 오류', statusCode: 500 }));
        });

        await stationsApi.list();
        const firstRound = asked.length;
        asked.length = 0;
        await stationsApi.list();

        expect(asked, '500 이후에도 같은 수만큼 다시 물어야 합니다').toHaveLength(firstRound);
    });

    it('전부 실패하면 오류가 아니라 빈 목록이다 — 화면이 EmptyState 로 갈립니다', async () => {
        mockRealMode((url) => {
            if (url.includes('/inspections')) return Promise.resolve({ data: { items: [] } });
            return notFound();
        });

        await expect(stationsApi.list()).resolves.toEqual([]);
    });
});

describe('대여소 발견 — 하드코딩에 매이지 않는다', () => {
    it('명부에 없는 대여소도 검수 응답에서 찾아낸다', async () => {
        /*
         * 명부는 **이름표일 뿐 접근 목록이 아닙니다.** 여기 없는 대여소도 검수 응답의
         * `stationId` 로 발견되어 목록에 나옵니다 — 이름만 축약 ID 로 뜹니다.
         *
         * 그래서 명부를 실서버에 실재하는 한 곳으로 줄여도(없는 곳에 404 를 반복해
         * 보내지 않으려고) 화면이 좁아지지 않습니다. 이 테스트가 그걸 지킵니다.
         */
        mockRealMode((url) => {
            if (url.includes('/inspections')) {
                return Promise.resolve({ data: { items: [{ stationId: DISCOVERED }] } });
            }
            return Promise.resolve(inventoryOf(DISCOVERED));
        });

        const ids = (await stationsApi.list()).map((s) => s.stationId);
        expect(ids, '검수에서 발견한 대여소가 빠졌습니다').toContain(DISCOVERED);
        expect(ids, '명부 대여소가 빠졌습니다').toEqual(
            expect.arrayContaining(REAL_STATIONS.map((entry) => entry.stationId)),
        );
    });

    it('이름이 없는 대여소는 축약 ID 로 보여 준다 — 지어내지 않는다', async () => {
        mockRealMode((url) => {
            if (url.includes('/inspections')) {
                return Promise.resolve({ data: { items: [{ stationId: DISCOVERED }] } });
            }
            // 명부 대여소는 전부 404 — 발견된 한 곳만 남겨 이름을 봅니다.
            if (!url.includes(DISCOVERED)) return notFound();
            return Promise.resolve(inventoryOf(DISCOVERED));
        });

        const [station] = await stationsApi.list();
        expect(station.name).toBe(`${DISCOVERED.slice(0, 8)}…`);
    });

    it('검수 조회가 실패해도 명부만으로 진행한다', async () => {
        mockRealMode((url) => {
            if (url.includes('/inspections')) return Promise.reject(new Error('검수 조회 실패'));
            return Promise.resolve(inventoryOf(SEEDED));
        });

        /*
         * 명부 길이를 박아 두지 않습니다 — 어느 UUID 로 시드됐는지 확실하지 않아
         * 명부에 후보를 더 넣을 수 있고, 그때마다 이 테스트가 깨지면 안 됩니다.
         * 여기서 볼 것은 「검수 조회가 죽어도 명부만으로 목록이 선다」입니다.
         */
        const ids = (await stationsApi.list()).map((s) => s.stationId);
        expect(ids).toEqual(REAL_STATIONS.map((entry) => entry.stationId));
    });
});

describe('대여소 상세 — 404 를 오류로 만들지 않는다', () => {
    it('서버에 없으면 null 이다 (NotFound 화면으로 갈립니다)', async () => {
        mockRealMode(() => notFound());
        await expect(stationsApi.detail(SEEDED)).resolves.toBeNull();
    });

    it('404 가 아닌 오류는 그대로 던진다 — 조용히 삼키지 않습니다', async () => {
        mockRealMode(() =>
            Promise.reject(new ApiRequestError({ message: '서버 오류', statusCode: 500 })),
        );
        await expect(stationsApi.detail(SEEDED)).rejects.toBeInstanceOf(ApiRequestError);
    });

    it('명부에 없는 대여소도 서버에 물어본다', async () => {
        // 예전에는 명부에 없으면 물어보지도 않고 null 이라, 발견한 대여소의 상세를 못 열었습니다.
        mockRealMode(() => Promise.resolve(inventoryOf(DISCOVERED)));
        const station = await stationsApi.detail(DISCOVERED);
        expect(station?.stationId).toBe(DISCOVERED);
    });
});
