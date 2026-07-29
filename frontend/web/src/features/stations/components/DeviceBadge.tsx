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

export function DeviceBadge({ status }: { status: DeviceStatus }) {
    return (
        <Badge tone={TONE[status]} className="whitespace-nowrap" title={DESCRIPTION[status]}>
            {DEVICE_STATUS_LABEL[status]}
            <span className="sr-only"> — {DESCRIPTION[status]}</span>
        </Badge>
    );
}
