import { Link } from 'react-router-dom';

/**
 * 검수가 필요한 슬롯 행의 '검수 ✓' 링크.
 * 시안은 채워진 버튼이 아니라 앰버 텍스트 + 방패 아이콘입니다.
 */
export function InspectLink({ to, label = '검수' }: { to: string; label?: string }) {
    return (
        <Link
            to={to}
            className="inline-flex items-center gap-2 text-[12.5px] font-bold text-tone-amber-fg transition-opacity hover:opacity-70"
        >
            {label}
            {/* viewBox 는 방패 외곽선 범위. 안쪽 체크 표시는 이 안에 들어옵니다. */}
            <svg viewBox="3.4 1.9 17.2 20.5" width="10.03" height="11.96" aria-hidden>
                <path
                    d="M12 1.9 L20.6 5.0 V11.6 C20.6 16.7 17.1 21.0 12 22.4 C6.9 21.0 3.4 16.7 3.4 11.6 V5.0 Z"
                    fill="currentColor"
                />
                <path
                    d="M8.4 11.7 L11.0 14.4 L15.9 9.4"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </Link>
    );
}
