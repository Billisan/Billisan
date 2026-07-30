import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

export interface FilterOption<T extends string> {
    value: T;
    label: string;
}

interface FilterSelectProps<T extends string> {
    /** 화면에 안 보이는 라벨 (스크린리더용) */
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: readonly FilterOption<T>[];
    className?: string;
}

/**
 * 검색줄에서 쓰는 드롭다운.
 *
 * **`<select>` 를 쓰지 않습니다.** 네이티브 `<select>` 의 펼침 목록은 운영체제가 그리는
 * 영역이라 CSS 가 닿지 않습니다. 버튼 테두리만 맞춰 놓으면 눌렀을 때 나오는 목록이 앱과
 * 따로 놀아서, 버튼 + `role="listbox"` 조합으로 직접 만듭니다.
 *
 * 직접 만드는 대신 네이티브가 공짜로 주던 것들을 손으로 채워 넣어야 합니다.
 *   - 키보드: `↑`·`↓` 이동, `Enter`·`Space` 선택, `Esc` 닫기, `Home`·`End`
 *   - 바깥 클릭으로 닫기, 닫을 때 포커스를 버튼으로 되돌리기
 *   - 보조기기: `aria-expanded`, `aria-activedescendant`, `aria-selected`
 * 이게 빠지면 마우스 없이는 쓸 수 없는 장식이 됩니다.
 */
export function FilterSelect<T extends string>({
    label,
    value,
    onChange,
    options,
    className,
}: FilterSelectProps<T>) {
    const [open, setOpen] = useState(false);
    /** 키보드로 훑고 있는 항목. 선택과는 다릅니다 — 눌러야 선택입니다. */
    const [activeIndex, setActiveIndex] = useState(0);

    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const listboxId = useId();

    const selectedIndex = Math.max(
        0,
        options.findIndex((option) => option.value === value),
    );
    const selected = options[selectedIndex];

    // 열 때는 지금 선택된 항목에서 시작합니다.
    useEffect(() => {
        if (open) setActiveIndex(selectedIndex);
    }, [open, selectedIndex]);

    // 바깥을 누르면 닫습니다. click 이 아니라 pointerdown 이라야 스크롤바 드래그에도 반응합니다.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    // 키보드로 목록 밖까지 내려가면 스크롤을 따라가게 합니다.
    useEffect(() => {
        if (!open) return;
        listRef.current
            ?.querySelector(`[data-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex]);

    const close = (focusTrigger = true) => {
        setOpen(false);
        if (focusTrigger) triggerRef.current?.focus();
    };

    const pick = (index: number) => {
        const option = options[index];
        if (option) onChange(option.value);
        close();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        // 닫혀 있을 때 아래/위/Enter/Space 는 '열기'입니다.
        if (!open) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                setOpen(true);
            }
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActiveIndex((prev) => Math.max(prev - 1, 0));
                break;
            case 'Home':
                event.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                event.preventDefault();
                setActiveIndex(options.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                pick(activeIndex);
                break;
            case 'Escape':
                event.preventDefault();
                close();
                break;
            case 'Tab':
                // 탭으로 빠져나갈 때는 포커스를 붙잡지 않습니다.
                close(false);
                break;
        }
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                onClick={() => setOpen((prev) => !prev)}
                onKeyDown={handleKeyDown}
                className={cn(
                    'flex h-[38px] items-center gap-2 rounded-lg border bg-white pl-[14px] pr-[12px] text-[12.5px] font-medium text-brand-body outline-none transition-colors',
                    'hover:border-brand-muted focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                    open ? 'border-brand-blue' : 'border-brand-border-soft',
                    className,
                )}
            >
                <span className="min-w-0 flex-1 truncate text-left">{selected?.label}</span>
                <ChevronDown
                    className={cn(
                        'size-4 shrink-0 text-brand-muted transition-transform',
                        open && 'rotate-180',
                    )}
                    aria-hidden
                />
            </button>

            {open && (
                <ul
                    ref={listRef}
                    id={listboxId}
                    role="listbox"
                    aria-label={label}
                    aria-activedescendant={`${listboxId}-${activeIndex}`}
                    tabIndex={-1}
                    className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[264px] w-full min-w-max overflow-y-auto rounded-lg border border-brand-border-soft bg-white p-[5px] shadow-[0_10px_28px_-8px_rgba(16,32,52,0.22)]"
                >
                    {options.map((option, index) => {
                        const isSelected = option.value === value;
                        const isActive = index === activeIndex;

                        return (
                            <li
                                key={option.value}
                                id={`${listboxId}-${index}`}
                                data-index={index}
                                role="option"
                                aria-selected={isSelected}
                                // 마우스로 훑을 때도 키보드와 같은 자리가 활성으로 보이게 합니다.
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => pick(index)}
                                className={cn(
                                    'flex h-[34px] cursor-pointer items-center gap-2 rounded-[7px] px-[10px] text-[12.5px] transition-colors',
                                    isSelected
                                        ? 'font-bold text-brand-blue-ink'
                                        : 'font-medium text-brand-body',
                                    isActive && 'bg-brand-surface',
                                )}
                            >
                                <span className="flex-1 truncate">{option.label}</span>
                                {/* 선택 표시는 색만으로 두지 않습니다 — 체크로도 구분합니다. */}
                                {isSelected && (
                                    <Check
                                        className="size-[14px] shrink-0 text-brand-blue"
                                        aria-hidden
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
