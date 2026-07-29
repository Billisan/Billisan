import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * 전역 렌더 오류 안전망.
 *
 * 이게 없으면 어느 화면에서든 렌더 중 예외가 나는 순간 **흰 화면**이 됩니다.
 * 관리자가 무슨 일이 일어났는지 알 수 없고 새로고침 말고는 방법이 없습니다.
 *
 * React 의 오류 경계는 아직 클래스 컴포넌트로만 만들 수 있습니다.
 */
interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        /*
         * 화면에는 요약만 띄우고 상세는 콘솔에만 둡니다.
         * 스택 트레이스·내부 오류를 화면에 그대로 노출하지 않습니다 (12-R PART E).
         */
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="flex min-h-screen items-center justify-center bg-brand-canvas p-6">
                <div className="w-[420px] rounded-2xl bg-white px-10 py-9 text-center shadow-[0_10px_28px_rgba(11,18,32,0.08)]">
                    <p className="text-[15px] font-extrabold text-brand-ink">
                        화면을 표시하지 못했습니다
                    </p>
                    <p className="mt-[10px] text-[12.5px] font-medium leading-[1.6] text-brand-muted">
                        예기치 못한 오류가 발생했습니다. 다시 시도해도 같은 화면이 나오면
                        <br />
                        아래 내용을 개발팀에 전달해 주세요.
                    </p>
                    {/* 메시지만 보여줍니다. 스택은 콘솔에 있습니다. */}
                    <p className="mt-[14px] select-all rounded-lg bg-brand-surface px-3 py-[10px] font-mono text-[11px] leading-[1.5] text-brand-body">
                        {error.message}
                    </p>

                    <div className="mt-[18px] flex items-center justify-center gap-[10px]">
                        <button
                            type="button"
                            onClick={() => this.setState({ error: null })}
                            className="h-[38px] rounded-[7px] border border-brand-border-soft px-[16px] text-[12.5px] font-bold text-brand-body transition-colors hover:bg-brand-surface"
                        >
                            다시 시도
                        </button>
                        <button
                            type="button"
                            onClick={() => window.location.assign('/')}
                            className="h-[38px] rounded-[7px] bg-brand-blue px-[16px] text-[12.5px] font-bold text-white transition-colors hover:bg-brand-blue/90"
                        >
                            대시보드로
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
