import { useEffect, useRef } from 'react';

/**
 * 모달이 열려 있는 동안 지켜야 할 세 가지.
 *
 * 모달은 "지금은 이것만 만지세요"라고 말하는 장치인데, 브라우저는 그렇게 취급해 주지
 * 않습니다. 아래 셋을 직접 채워야 마우스 없이도 쓸 수 있고 배경으로 새지 않습니다.
 *
 * 1. **포커스 트랩** — Tab 이 모달 밖으로 나가지 않게 가둡니다. 안 막으면 몇 번 누르는
 *    것만으로 뒤쪽 사이드바에 닿고, 보이지도 않는 곳에 포커스가 가 있게 됩니다.
 * 2. **배경 스크롤 잠금** — 모달 위에서 굴린 휠이 뒤 페이지를 움직이면 모달이 화면 밖으로
 *    밀려납니다.
 * 3. **포커스 복원** — 닫은 뒤 열기 전 자리로 돌려놓습니다. 안 하면 `<body>` 로 떨어져서
 *    다음 Tab 이 문서 맨 처음부터 시작합니다.
 *
 * @param open  모달이 열려 있는지
 * @returns 모달 컨테이너에 달 ref
 */
export function useModalA11y<T extends HTMLElement>(open: boolean) {
    const containerRef = useRef<T>(null);
    /** 열기 직전에 포커스가 있던 자리. 닫을 때 여기로 돌려줍니다. */
    const restoreRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) return;

        restoreRef.current = document.activeElement as HTMLElement | null;

        /*
         * 배경 스크롤 잠금.
         *
         * `overflow: hidden` 만 주면 스크롤바가 사라지면서 페이지 폭이 넓어져 화면이
         * 덜컥 움직입니다. 사라진 스크롤바 폭만큼 padding 으로 메꿔 둡니다.
         */
        const { overflow, paddingRight } = document.body.style;
        const gap = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (gap > 0) document.body.style.paddingRight = `${gap}px`;

        /** 지금 모달 안에서 실제로 포커스를 받을 수 있는 것들. 매번 새로 셉니다. */
        const focusables = () => {
            const nodes = containerRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            // 조건에 따라 숨겨지는 칸이 있어서 화면에 실제로 그려진 것만 남깁니다.
            return Array.from(nodes ?? []).filter((el) => el.offsetParent !== null);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            const items = focusables();
            if (items.length === 0) return;

            const first = items[0];
            const last = items[items.length - 1];
            const active = document.activeElement;

            // 끝에서 한 번 더 누르면 반대쪽 끝으로 돌립니다 — 밖으로 내보내지 않습니다.
            if (event.shiftKey && (active === first || !containerRef.current?.contains(active))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = overflow;
            document.body.style.paddingRight = paddingRight;
            // 닫히면서 사라진 요소에 포커스를 주지 않도록 아직 문서에 있는지 확인합니다.
            const target = restoreRef.current;
            if (target?.isConnected) target.focus();
        };
    }, [open]);

    return containerRef;
}
