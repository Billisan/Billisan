import { Navigate, useParams } from 'react-router-dom';

/**
 * 옛 슬롯 주소(`/stations/:stationId/slots/:slotId`) → 새 주소(`/slots/:slotId`).
 *
 * 슬롯 상세를 대여소 아래 중첩해 뒀다가 평면 경로로 바꾸면서, 열어 둔 탭·북마크·주고받은
 * 링크가 갑자기 404 로 죽지 않게 두는 장치입니다.
 *
 * 주소에 실려 온 대여소 ID 는 **버립니다.** 권위값은 `ADMIN-SLOT-DETAIL-001` 응답의
 * `stationId` 이고, 주소 값과 어긋나면 다른 대여소 이름·코드로 표시되는 문제가 생깁니다.
 *
 * `replace` 라 뒤로가기 기록에 옛 주소가 남지 않습니다.
 */
export function LegacySlotRedirect() {
    const { slotId } = useParams();
    return <Navigate to={`/slots/${slotId}`} replace />;
}
