import { create } from 'zustand';

/**
 * 화면 알림(토스트) 상태.
 *
 * 관리자 명령은 성공해도 화면이 거의 안 바뀌는 경우가 있습니다. 특히 검수 '판정 보류'는
 * 슬롯 상태가 그대로라, 알림이 없으면 눌린 건지 아닌지 알 수 없습니다.
 * 실패는 더 중요합니다 — 409 로 거절됐는데 조용히 닫히면 관리자가 바뀐 줄 착각합니다.
 *
 * 외부 라이브러리를 쓰지 않고 직접 둡니다. 시안 색 토큰을 그대로 쓰고 의존성도 안 늘립니다.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
    id: number;
    tone: ToastTone;
    message: string;
    /** 본문 아래 회색 보조 줄 (오류 코드 등) */
    detail?: string;
}

/** 자동으로 사라지기까지의 시간. 오류는 읽을 시간이 더 필요합니다. */
const DURATION: Record<ToastTone, number> = {
    success: 3200,
    info: 3200,
    error: 6000,
};

interface ToastState {
    toasts: Toast[];
    push: (toast: Omit<Toast, 'id'>) => void;
    dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
    toasts: [],
    push: (toast) => {
        const id = nextId++;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

        // 타이머는 스토어가 들고 있습니다. 컴포넌트가 언마운트돼도 목록은 정리됩니다.
        setTimeout(() => get().dismiss(id), DURATION[toast.tone]);
    },
    dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * 컴포넌트 밖(뮤테이션 콜백 등)에서도 부를 수 있게 함수로 노출합니다.
 * 훅이 아니라 스토어를 직접 건드리므로 렌더 순서와 무관합니다.
 */
export const toast = {
    success: (message: string, detail?: string) =>
        useToastStore.getState().push({ tone: 'success', message, detail }),
    error: (message: string, detail?: string) =>
        useToastStore.getState().push({ tone: 'error', message, detail }),
    info: (message: string, detail?: string) =>
        useToastStore.getState().push({ tone: 'info', message, detail }),
};
