import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 상세 화면의 '뒤로'.
 *
 * `navigate(-1)` 하나로 끝내면 안 됩니다. 링크를 받아서 열었거나, 새 탭으로 띄웠거나,
 * 주소를 직접 친 경우엔 **앱 안에 돌아갈 자리가 없어서** 뒤로가기가 관리자 콘솔 자체를
 * 벗어나 버립니다. 어제 보던 다른 사이트로 튀는 식이죠.
 *
 * 그래서 두 갈래로 나눕니다.
 *   - 앱 안에서 이동해 온 경우 → 진짜 뒤로. 검수 상세 → 슬롯 상세로 왔으면 검수 상세로
 *     돌아가야지, 대여소 목록으로 보내면 사람이 밟아 온 길과 어긋납니다.
 *   - 밖에서 바로 들어온 경우 → 상위 화면(`fallback`)으로. 이때는 `replace` 입니다.
 *     뒤로 갈 자리가 없어서 온 건데 기록을 또 쌓을 이유가 없습니다.
 *
 * 판별에는 React Router 가 history state 에 심어 두는 `idx` 를 씁니다. 앱이 처음 뜬
 * 항목이 0 이고, 앱 안에서 한 번이라도 이동하면 1 이상이 됩니다. 새로고침해도 이 값은
 * 살아 있어서, F5 를 눌렀다고 뒤로가기가 망가지지 않습니다.
 */
export function useGoBack(fallback: string) {
    const navigate = useNavigate();

    return useCallback(() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx;

        if (typeof idx === 'number' && idx > 0) {
            navigate(-1);
            return;
        }

        navigate(fallback, { replace: true });
    }, [navigate, fallback]);
}
