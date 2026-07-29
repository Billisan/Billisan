import type { DeviceStatus } from '@/features/stations/types';
import { Badge, type BadgeTone } from '@/shared/components/Badge';
import { DEVICE_STATUS_LABEL } from '@/shared/constants/statusLabels';

/**
 * 대여소 장치 연결 상태 — ERD `STATION.device_status`.
 *
 * 값이 셋입니다. 예전에는 `ON`/`OFF` 두 글자로 접어 놨는데, 그러면 `ERROR`(장치 오류)가
 * 화면에서 `OFF` 와 구분되지 않습니다. 통신이 끊긴 것과 장치가 고장 난 것은 대응이 다릅니다.
 *
 * 여기만 코드 병기(`장치 연결(ONLINE)`)를 하지 않습니다. 열 폭이 좁고, 열 제목이 이미
 * '온라인'이라 코드가 정보를 더하지 않습니다. 다른 상태 배지는 ERD §2.4.1 대로 병기합니다.
 */
const TONE: Record<DeviceStatus, BadgeTone> = {
    ONLINE: 'green',
    OFFLINE: 'red',
    ERROR: 'amber',
};

export function DeviceBadge({ status }: { status: DeviceStatus }) {
    return (
        <Badge tone={TONE[status]} className="whitespace-nowrap">
            {DEVICE_STATUS_LABEL[status]}
        </Badge>
    );
}
