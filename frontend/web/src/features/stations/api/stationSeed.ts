import { SEED_STATION } from '@/features/stations/mocks/ec2Seed';
import type { Station } from '@/features/stations/types';

/**
 * 실 API 모드의 대여소 명부.
 *
 * **대여소 목록 API 가 아직 없습니다** (EC2 스웨거 실측: admin 경로 8개 중 목록 없음).
 * 그런데 재고·슬롯 API 는 전부 `stationId` 를 요구해서, 어딘가에는 실제 UUID 명부가
 * 있어야 화면이 시작됩니다. 백엔드가 DB 에 시드한 대여소를 그대로 적습니다.
 *
 * **근거가 둘이고 서로 다릅니다.** 어느 쪽으로 시드됐는지 확실하지 않아 둘 다 둡니다 —
 * 없는 쪽은 `inventory` 가 404 를 내고 `Promise.allSettled` 가 걸러 내므로, 있는 쪽만
 * 이름을 갖고 살아남습니다. 하나만 적었다가 그게 틀리면 대여소 이름이 UUID 조각
 * (`22000000…`)으로 뜹니다 — `fallbackSeedOf` 가 이름을 지어낼 수 없어서입니다.
 *
 * UUID·이름은 비밀값이 아닙니다 — 계정·비밀번호는 여기 두지 않습니다.
 *
 * `position` 은 분포도 좌표(0~100)입니다. ERD 에 좌표 컬럼이 없어서 화면 배치값을
 * 여기서 정합니다.
 *
 * **값을 두 번 적지 않습니다.** 목업도 같은 시드를 쓰므로 `mocks/ec2Seed.ts` 한 곳에서
 * 가져옵니다. 예전에는 여기와 목업에 따로 적혀 있어서, 한쪽만 고치면 목업 모드와
 * 실 모드가 서로 다른 대여소를 가리켰습니다.
 *
 * TODO: 대여소 목록 API 가 계약에 들어오면 이 파일을 지우고 http 호출로 바꾸세요.
 */

export interface StationSeedEntry {
    stationId: string;
    name: string;
    position: Station['position'];
}

export const REAL_STATIONS: StationSeedEntry[] = [
    /*
     * ① 팀 공유 문서(EC2-DEMO-SEED-DATA.md, 2026-08-01)로 전사한 대여소.
     *    그 문서는 이 리포지토리에 없습니다 — 대화로 받은 값이라 교차 검증이 안 됩니다.
     */
    {
        stationId: SEED_STATION.stationId,
        name: SEED_STATION.name,
        position: SEED_STATION.position,
    },

    /*
     * ② 리포지토리 픽스처가 실제로 INSERT 하는 대여소. 근거 두 곳:
     *      backend/src/main/resources/db/demo-fixtures/00-reference-data.sql
     *      docs/backend2-setup/V19-FIXTURE-CATALOG.md §3 (Station 행)
     *    이름은 DB 값을 그대로 씁니다 — 한글로 바꿔 부르면 DB 를 직접 보는 사람과
     *    말이 갈립니다. 슬롯은 이 대여소 아래 5개(`33000000…0001`~`0005`)입니다.
     */
    {
        stationId: '22000000-0000-4000-8000-000000000001',
        name: 'Fixture Station 01',
        position: { x: 62, y: 38 },
    },

    /*
     * ③ **실 시연용 대여소.** `db/live-demo/00-prepare-station-and-slots.sql` 이
     *    만듭니다 — 파일 머리말이 "Live-demo operational seed"라고 못 박고 있고,
     *    Pi 설정에 슬롯 id 를 복사해 넣으라는 지시가 붙어 있습니다. 즉 **실제 장비가
     *    붙는 대여소**라 시연 당일 화면에 나올 곳은 여기일 가능성이 큽니다.
     *
     *    슬롯은 2개(1번 대여용 · 2번 반납용)뿐이고, 슬롯 id 는 `UUID()` 로 그때그때
     *    생성돼 고정값이 없습니다 — 그래서 여기 적을 수 없습니다. 대여소 id 만
     *    고정이라 이름표를 붙일 수 있습니다.
     */
    {
        stationId: 'd2e2d6d6-eade-5ec7-8e3a-b7856a921d47',
        name: 'Billisan Live Demo Station',
        position: { x: 38, y: 62 },
    },
];
