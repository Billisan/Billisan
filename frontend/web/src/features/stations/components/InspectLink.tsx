import { Link } from 'react-router-dom';

/**
 * 미처리 검수가 걸린 행의 '검수' 버튼.
 *
 * 시안은 앰버 솔리드 알약(56x26, r7)입니다.
 * 누르면 검수 상세 **페이지**로 갑니다. 모달이 아니라 페이지인 이유는 판정이 슬롯 상태와
 * 파손 정산을 함께 바꾸는 확정 행위라 주소가 남아야 하기 때문입니다.
 */
export function InspectLink({ to, label = '검수' }: { to: string; label?: string }) {
    return (
        <Link
            to={to}
            className="inline-flex h-[26px] w-[56px] items-center justify-center rounded-[7px] bg-tone-amber-fg text-[11.5px] font-bold text-white transition-opacity hover:opacity-85"
        >
            {label}
        </Link>
    );
}
