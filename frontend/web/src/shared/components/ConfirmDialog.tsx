import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    /** 제목 아래 한 줄. 무엇을 대상으로 하는 동작인지 밝힙니다. */
    subtitle?: string;
    children: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * 확인 모달. 규격은 시안(06_status_modal)에서 가져왔습니다.
 *
 * 라이브러리 대신 <dialog> 를 씁니다. showModal() 을 쓰면 포커스 가두기,
 * Esc 닫기, 배경 요소 비활성화를 브라우저가 알아서 해 줍니다.
 */
export function ConfirmDialog({
    open,
    title,
    subtitle,
    children,
    confirmLabel = '변경',
    cancelLabel = '취소',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
            // showModal 은 첫 번째 포커스 가능 요소(닫기 X)를 잡습니다.
            // 확인 모달이니 안전한 쪽인 '취소'에 포커스를 둡니다.
            cancelRef.current?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            // Esc 키. 기본 닫기를 막고 부모가 open 을 내리게 해서 상태를 한 곳에서만 관리합니다.
            onCancel={(event) => {
                event.preventDefault();
                onCancel();
            }}
            // 배경(::backdrop) 클릭. 카드 안을 누르면 target 이 카드라서 걸리지 않습니다.
            onClick={(event) => {
                if (event.target === dialogRef.current) onCancel();
            }}
            className="w-[452px] max-w-[calc(100vw-32px)] rounded-[14px] bg-white p-0 text-brand-ink shadow-[0_8px_28px_rgba(11,18,32,0.16)] [&::backdrop]:bg-[#0B1220]/[0.42]"
        >
            <div className="relative p-[30px]">
                <button
                    type="button"
                    onClick={onCancel}
                    className="absolute right-[17px] top-[23px] flex size-8 items-center justify-center rounded-lg text-brand-muted outline-none transition-colors hover:bg-brand-surface focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                >
                    <span className="sr-only">닫기</span>
                    <svg viewBox="-0.9 -0.9 15.8 15.8" width="15.8" height="15.8" aria-hidden>
                        <path
                            d="M0 0 L14 14 M14 0 L0 14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>

                <h2 id={titleId} className="pr-10 text-[18px] font-extrabold leading-[24px]">
                    {title}
                </h2>
                {subtitle && (
                    <p className="mt-[6px] text-[12.5px] font-semibold leading-[18px] text-brand-body">
                        {subtitle}
                    </p>
                )}

                <div className="mt-[10px] h-px bg-brand-line-soft" />

                <div className="mt-[20px]">{children}</div>

                <div className="mt-[28px] flex gap-3">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="h-[42px] flex-1 rounded-[7px] border border-brand-border-soft bg-white text-[13px] font-bold text-brand-body outline-none transition-colors hover:bg-brand-surface focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="h-[42px] flex-1 rounded-[7px] bg-brand-blue text-[13px] font-bold text-white outline-none transition-colors hover:bg-brand-blue/90 focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
