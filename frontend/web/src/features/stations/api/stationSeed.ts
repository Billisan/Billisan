import type { Station } from '@/features/stations/types';

/**
 * 실 API 모드의 대여소 명부.
 *
 * **대여소 목록 API 가 아직 없습니다** (EC2 스웨거 실측: admin 경로 8개 중 목록 없음).
 * 그런데 재고·슬롯 API 는 전부 `stationId` 를 요구해서, 어딘가에는 실제 UUID 명부가
 * 있어야 화면이 시작됩니다. 백엔드가 DB 에 시드한 대여소를 그대로 적습니다.
 *
 * **실서버에 실재하는 것만 적습니다.** 예전에는 시드 출처가 여럿이라 후보 셋을 다
 * 넣어 두고 `Promise.allSettled` 로 걸러 냈는데, 없는 대여소에도 매번 요청이 나가
 * 브라우저 콘솔과 백엔드 로그에 404 가 쌓였습니다. 화면은 멀쩡했지만 요청은 진짜였습니다.
 *
 * 여기 없는 대여소도 화면에는 나옵니다 — `discoverStationIds` 가 검수 응답의
 * `stationId` 로 찾아냅니다. 이름만 UUID 조각으로 뜨고 기능은 그대로입니다.
 * 그래서 이 파일은 **이름표일 뿐 접근 목록이 아닙니다.**
 *
 * UUID·이름은 비밀값이 아닙니다 — 계정·비밀번호는 여기 두지 않습니다.
 *
 * `position` 은 분포도 좌표(0~100)입니다. ERD 에 좌표 컬럼이 없어서 화면 배치값을
 * 여기서 정합니다.
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
     * **실 시연용 대여소.** `db/live-demo/00-prepare-station-and-slots.sql` 이 만듭니다 —
     * 파일 머리말이 "Live-demo operational seed"라고 못 박고 있고, Pi 설정에 슬롯 id 를
     * 복사해 넣으라는 지시가 붙어 있습니다. 실제 장비가 붙는 대여소입니다.
     *
     * 실서버에 이것만 존재하는 것을 실측으로 확인했습니다(나머지 후보는 404).
     */
    {
        stationId: 'd2e2d6d6-eade-5ec7-8e3a-b7856a921d47',
        name: 'Billisan Live Demo Station',
        position: { x: 38, y: 62 },
    },

    /*
     * **후보 둘을 뺐습니다.**
     *
     *   186c47d2…  팀 공유 문서(EC2-DEMO-SEED-DATA.md)로 전사 — 그 문서는 이
     *              리포지토리에 없고, 실서버에도 없습니다
     *   22000000…  V19 픽스처(`db/demo-fixtures/00-reference-data.sql`) — 그 SQL 은
     *              Flyway 대상이 아니라 수동 적재인데, 실서버에 적재되지 않았습니다
     *
     * 둘 다 실서버에서 `404 STATION_NOT_FOUND` 입니다. 명부에 두면 대여소 목록을 열
     * 때마다 없는 곳에 요청을 보내 브라우저 콘솔과 백엔드 로그에 404 가 쌓입니다.
     * `Promise.allSettled` 가 걸러 줘서 화면은 멀쩡하지만, 실제로 나가는 요청은 남습니다.
     *
     * DB 가 다시 시드돼 다른 UUID 가 되면 `discoverStationIds` 가 검수 응답에서 찾아
     * 냅니다 — 이름만 UUID 조각으로 뜨고 기능은 그대로입니다. 그때 여기에 다시
     * 적어 주세요.
     */
];
