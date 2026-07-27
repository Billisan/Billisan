import { Link } from 'react-router-dom';

/**
 * 표 오른쪽 끝의 '상세 ›' 링크.
 *
 * lucide 아이콘은 24 유닛 박스 안에 여백이 크게 잡혀 있어서, 같은 gap 을 줘도
 * 시안보다 화살표가 훨씬 멀어 보입니다. 그래서 시안 벡터를 그대로 그립니다.
 */
export function DetailLink({ to, label = '상세' }: { to: string; label?: string }) {
    return (
        <Link
            to={to}
            className="inline-flex items-center gap-[7px] text-[12.5px] font-bold text-tone-blue-fg transition-opacity hover:opacity-70"
        >
            {label}
            {/* viewBox 는 선 굵기(1.7)의 바깥쪽까지 포함한 범위 */}
            <svg viewBox="-0.85 -0.85 5.1 8.9" width="5.1" height="8.9" aria-hidden>
                <path
                    d="M0 0 L3.4 3.6 L0 7.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </Link>
    );
}
