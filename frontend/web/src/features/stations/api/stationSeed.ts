import type { Station } from '@/features/stations/types';

/**
 * 실 API 모드의 대여소 명부.
 *
 * **대여소 목록 API 가 아직 없습니다** (EC2 스웨거 실측: admin 경로 8개 중 목록 없음).
 * 그런데 재고·슬롯 API 는 전부 `stationId` 를 요구해서, 어딘가에는 실제 UUID 명부가
 * 있어야 화면이 시작됩니다. 백엔드가 EC2 DB 에 시드한 대여소를 그대로 적습니다
 * (근거: 팀 공유 문서 EC2-DEMO-SEED-DATA.md, 2026-08-01).
 *
 * UUID·이름은 비밀값이 아닙니다 — 계정·비밀번호는 여기 두지 않습니다.
 *
 * `position` 은 분포도 좌표(0~100)입니다. ERD 에 좌표 컬럼이 없어서 화면 배치값을
 * 여기서 정합니다. 목업 '정문 광장'과 같은 자리를 씁니다.
 *
 * TODO: 대여소 목록 API 가 계약에 들어오면 이 파일을 지우고 http 호출로 바꾸세요.
 */

export interface StationSeedEntry {
    stationId: string;
    name: string;
    position: Station['position'];
}

export const REAL_STATIONS: StationSeedEntry[] = [
    {
        stationId: '186c47d2-6553-4b36-8d7e-de810f40010d',
        name: '정문 대여소',
        position: { x: 20.1, y: 86.0 },
    },
];
