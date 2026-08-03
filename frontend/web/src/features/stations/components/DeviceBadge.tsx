import type { DeviceStatus } from '@/features/stations/types';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { DEVICE_STATUS_LABEL } from '@/shared/constants/statusLabels';

/**
 * 대여소 장치 연결 상태 — ERD `STATION.device_status`.
 *
 * 표시는 `ON` / `OFF` / `ERR` 입니다. 코드 병기(`장치 연결(ONLINE)`)도 하지 않습니다 —
 * 열 제목이 이미 '온라인'이라 글자를 더 붙여도 정보가 늘지 않습니다.
 * 업무 상태 배지(슬롯·검수)는 ERD §2.4.1 대로 `한글(CODE)` 를 그대로 씁니다.
 *
 * 세 글자뿐이라 화면에서는 색이 실제 구분자입니다. 그래서 `title` 로 전체 뜻을 남기고,
 * 스크린리더에는 `sr-only` 로 읽어 줍니다. 색만으로 정보를 전달하지 않기 위해서입니다.
 */
const TONE: Record<DeviceStatus, BadgeTone> = {
    ONLINE: 'green',
    OFFLINE: 'red',
    ERROR: 'amber',
};

/** 배지에는 안 보이지만 툴팁·보조기기용으로 남기는 뜻풀이 */
const DESCRIPTION: Record<DeviceStatus, string> = {
    ONLINE: '장치 연결됨',
    OFFLINE: '장치 연결 끊김',
    ERROR: '장치 오류',
};

export function DeviceBadge({ status }: { status: DeviceStatus | null }) {
    /*
     * **모르면 모른다고 합니다.**
     *
     * `STATION.device_status` 를 내려 주는 관리자 API 가 없어서 실 모드에서는 `null` 이
     * 옵니다. 예전에는 그 자리에 `ONLINE` 을 넣어 「연결됨」이라고 그렸는데, 함이 꺼져
     * 있어도 서버는 슬롯 행을 돌려주므로 화면만 거짓말하는 상태였습니다.
     * 초록 배지 대신 회색 「확인 불가」를 두어, 관리자가 이 값을 근거로 삼지 않게 합니다.
     */
    if (status === null) {
        return (
            <Badge
                tone="slate"
                className="whitespace-nowrap"
                title="장치 상태를 제공하는 API가 없습니다"
            >
                확인 불가
                <span className="sr-only"> — 장치 상태 정보 없음</span>
            </Badge>
        );
    }

    return (
        <Badge tone={TONE[status]} className="whitespace-nowrap" title={DESCRIPTION[status]}>
            {DEVICE_STATUS_LABEL[status]}
            <span className="sr-only"> — {DESCRIPTION[status]}</span>
        </Badge>
    );
}
