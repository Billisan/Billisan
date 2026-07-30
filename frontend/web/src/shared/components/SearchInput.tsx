import { Search, X } from 'lucide-react';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * 목록 화면의 검색 입력칸.
 *
 * 대여소 관리·대여소 상세·우산 재고·이력 3종이 **같은 마크업을 각자 베껴 쓰고 있었습니다.**
 * 지우기 버튼처럼 뭘 하나 붙일 때마다 네 곳을 똑같이 고쳐야 하고, 한 곳을 빠뜨리면
 * 화면끼리 어긋납니다. 한 군데로 모았습니다.
 *
 * 폭만 화면마다 달라서(`320px` / `280px`) `className` 으로 받습니다.
 */
interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    /**
     * 지우기 버튼을 눌렀을 때.
     *
     * `onChange('')` 와 따로 두는 이유: 이 화면들은 확정된 조회 조건을 URL Query 에
     * 들고 있습니다(화면흐름 §6.2). 입력칸만 비우면 주소에는 검색어가 남아 목록이
     * 그대로여서, 지운 것처럼 보이는데 결과가 안 바뀝니다. **입력과 조회를 함께**
     * 비우려면 화면이 자기 방식으로 처리해야 합니다.
     */
    onClear: () => void;
    placeholder: string;
    /** 스크린리더용 이름. 화면에 라벨 글자가 없어서 이걸로 대신합니다. */
    label: string;
    className?: string;
}

export function SearchInput({
    value,
    onChange,
    onClear,
    placeholder,
    label,
    className,
}: SearchInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const clear = () => {
        onClear();
        // 지운 뒤 다시 입력칸으로 돌려보냅니다. 안 그러면 버튼이 사라지면서
        // 포커스가 body 로 떨어져 키보드 사용자는 처음부터 Tab 을 다시 밟아야 합니다.
        inputRef.current?.focus();
    };

    return (
        <label className={cn('relative block', className)}>
            <span className="sr-only">{label}</span>
            <Search
                className="pointer-events-none absolute left-[14px] top-1/2 size-[13px] -translate-y-1/2 text-brand-muted"
                aria-hidden
            />
            <input
                ref={inputRef}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                // Esc 로도 지웁니다. 검색칸에서 관용적인 동작입니다.
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && value) {
                        // 폼 안이라 기본 동작(입력 되돌리기)이 겹치지 않게 막습니다.
                        event.preventDefault();
                        clear();
                    }
                }}
                placeholder={placeholder}
                className={cn(
                    'h-[38px] w-full rounded-lg bg-brand-surface pl-[38px] text-[12.5px] font-medium text-brand-ink outline-none transition-shadow placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                    // 글자가 있을 때만 버튼 자리를 비웁니다. 늘 비워 두면 빈 칸에서
                    // placeholder 가 괜히 짧아 보입니다.
                    value ? 'pr-[34px]' : 'pr-3',
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={clear}
                    className="absolute right-[8px] top-1/2 flex size-[20px] -translate-y-1/2 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-line-soft hover:text-brand-body focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                >
                    <span className="sr-only">검색어 지우기</span>
                    <X className="size-[12px]" strokeWidth={2.4} aria-hidden />
                </button>
            )}
        </label>
    );
}
