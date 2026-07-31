import { useEffect, useRef } from 'react';

/**
 * 모달이 열려 있는 동안 지켜야 할 네 가지.
 *
 * 모달은 "지금은 이것만 만지세요"라고 말하는 장치인데, 브라우저는 그렇게 취급해 주지
 * 않습니다. 아래 넷을 직접 채워야 마우스 없이도 쓸 수 있고 배경으로 새지 않습니다.
 *
 * 1. **초기 포커스** — 열자마자 포커스를 모달 안으로 옮깁니다. 이게 빠져 있었습니다.
 *    Tab 가둠·복원은 되는데 처음 포커스만 안 옮겨서, 키보드·화면낭독기 사용자는 **모달이
 *    열린 줄 모른 채** 뒤쪽 버튼에 포커스를 둔 상태였습니다. 낭독기는 새로 뜬 내용을 읽지
 *    않고, Tab 을 눌러야 그제서야 모달로 들어갑니다.
 * 2. **포커스 트랩** — Tab 이 모달 밖으로 나가지 않게 가둡니다. 안 막으면 몇 번 누르는
 *    것만으로 뒤쪽 사이드바에 닿고, 보이지도 않는 곳에 포커스가 가 있게 됩니다.
 * 3. **배경 스크롤 잠금** — 모달 위에서 굴린 휠이 뒤 페이지를 움직이면 모달이 화면 밖으로
 *    밀려납니다.
 * 4. **포커스 복원** — 닫은 뒤 열기 전 자리로 돌려놓습니다. 안 하면 `<body>` 로 떨어져서
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

        /*
         * 포커스를 모달 안으로 옮깁니다.
         *
         * 첫 대화형 요소가 아니라 **컨테이너**에 겁니다. 상태 변경 모달의 첫 요소는 라디오
         * 버튼인데, 거기에 포커스를 주면 낭독기가 제목·설명을 건너뛰고 "정상 · 라디오
         * 버튼"부터 읽습니다. 무엇을 바꾸려는 모달인지 모른 채 선택지부터 듣게 됩니다.
         * 컨테이너(`tabindex="-1"` + `aria-labelledby`)에 걸면 제목부터 읽고 Tab 이
         * 자연스럽게 첫 선택지로 이어집니다.
         *
         * 컨테이너에 `tabIndex={-1}` 이 없으면 `focus()` 가 조용히 실패하므로, 없을 때는
         * 첫 대화형 요소로 물러섭니다.
         */
        const container = containerRef.current;
        if (container?.hasAttribute('tabindex')) container.focus();
        else focusables()[0]?.focus();

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
