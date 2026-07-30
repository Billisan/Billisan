import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * 목록 → 상세 → 뒤로 왔을 때 보던 자리로 되돌립니다.
 *
 * 브라우저가 알아서 해 주지 않습니다. 이 앱은 창 전체가 아니라 **`<main>` 안쪽만**
 * 스크롤하는 구조(AppShell)라, 브라우저의 기본 스크롤 복원은 창 스크롤(항상 0)만 봅니다.
 * React Router 의 `<ScrollRestoration>` 도 window 전용이어서 쓸 수 없습니다.
 *
 * 동작은 셋입니다.
 *   - 이동해 나갈 때: 그 히스토리 항목의 스크롤 위치를 적어 둡니다.
 *   - 뒤로/앞으로(`POP`) 들어올 때: 적어 둔 위치로 되돌립니다.
 *   - 새로 들어올 때(`PUSH`·`REPLACE`): 맨 위에서 시작합니다. 조회 조건을 바꿨거나
 *     다른 화면으로 온 것이라, 이전 위치를 물려주면 엉뚱한 데서 시작합니다.
 *
 * 키는 `location.key` 입니다. 경로가 아니라 **히스토리 항목**이라, 같은 목록을 두 번
 * 거쳐 왔을 때 각자의 위치를 따로 기억합니다.
 */

/** 히스토리 항목별 스크롤 위치. 새로고침하면 사라집니다 — 그때는 맨 위가 맞습니다. */
const positions = new Map<string, number>();

/**
 * 복원을 몇 프레임까지 다시 시도할지.
 *
 * 목록은 조회가 끝난 뒤에 그려집니다. 돌아온 직후에는 내용이 비어 있어 컨테이너 높이가
 * 0 이고, 그 상태로 `scrollTop` 을 넣으면 그냥 무시됩니다. 그래서 내용이 그만큼
 * 자랄 때까지 프레임마다 다시 시도합니다. 30프레임(약 0.5초)이면 목업·실서버 모두 넉넉하고,
 * 그 안에 안 자라면 포기합니다 — 계속 붙잡고 있으면 사용자가 스크롤한 걸 덮어씁니다.
 */
const MAX_FRAMES = 30;

export function useScrollRestoration(ref: RefObject<HTMLElement>) {
    const { key } = useLocation();
    const navigationType = useNavigationType();

    /*
     * 사용자가 마지막으로 스크롤한 위치.
     *
     * **떠나는 순간 `element.scrollTop` 을 읽으면 안 됩니다.** 화면이 바뀔 때 React 가
     * 새 내용을 DOM 에 먼저 꽂는데, 상세 화면은 목록보다 짧아서 브라우저가 그 자리에서
     * `scrollTop` 을 0 으로 깎아 버립니다. 그 다음에 정리 함수가 돌기 때문에 읽히는 값은
     * 늘 0 입니다. 실제로 그래서 복원이 한 번도 안 됐습니다.
     *
     * 그래서 스크롤 이벤트로 값을 따로 들고 있습니다. 이 값은 DOM 이 바뀌어도 안 깎입니다.
     */
    const scrollTopRef = useRef(0);

    // 스크롤 추적. 컨테이너는 계속 같은 요소라 한 번만 걸어 둡니다.
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const onScroll = () => {
            scrollTopRef.current = element.scrollTop;
        };
        element.addEventListener('scroll', onScroll, { passive: true });
        return () => element.removeEventListener('scroll', onScroll);
    }, [ref]);

    /*
     * 나갈 때 저장.
     *
     * `<main>` 은 화면이 바뀌어도 그대로 붙어 있는 레이아웃 요소입니다. 그래서 이 정리
     * 함수는 "컴포넌트가 사라질 때"가 아니라 **`key` 가 바뀔 때** 돕니다.
     */
    useLayoutEffect(() => {
        const currentKey = key;
        return () => {
            positions.set(currentKey, scrollTopRef.current);
        };
    }, [key]);

    /*
     * 들어올 때 복원.
     *
     * `useLayoutEffect` 입니다. 그려진 뒤 한 프레임이라도 늦으면 맨 위가 한 번 보이고
     * 나서 툭 내려가는 게 눈에 띕니다.
     */
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const settle = (top: number) => {
            element.scrollTop = top;
            // 추적값도 같이 맞춥니다. 안 그러면 복원 직후 다른 화면으로 갈 때
            // 예전 위치가 저장됩니다.
            scrollTopRef.current = top;
        };

        const target = navigationType === 'POP' ? positions.get(key) : undefined;
        if (!target) {
            settle(0);
            return;
        }

        let frame = 0;
        let raf = 0;

        const attempt = () => {
            const reachable = element.scrollHeight - element.clientHeight;
            if (reachable >= target) {
                settle(target);
                return;
            }
            if (frame < MAX_FRAMES) {
                frame += 1;
                raf = requestAnimationFrame(attempt);
                return;
            }
            // 끝까지 안 자랐으면 갈 수 있는 만큼만 갑니다.
            settle(Math.max(0, reachable));
        };

        attempt();
        return () => cancelAnimationFrame(raf);
    }, [key, navigationType, ref]);
}
