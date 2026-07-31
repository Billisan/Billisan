import { Eye, EyeOff } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { useLogin } from '@/features/auth/hooks/useLogin';
import { errorCodeOf, errorStatusOf } from '@/lib/api-error';
import { cn } from '@/lib/utils';

/**
 * 관리자 로그인 폼 — `SCR-WEB-AUTH-001`.
 *
 * 금지 사항을 그대로 지킵니다 (화면흐름 §7.1):
 *   비밀번호 평문 저장·로그 출력 금지, `password_hash` 조회·노출 금지,
 *   일반 사용자 토큰 재사용 금지, **내부 인증 실패 사유 과다 노출 금지**.
 * 그래서 자격 실패 문구는 아이디·비밀번호를 구분하지 않는 한 줄뿐입니다.
 */

/**
 * 실패 사유 → 화면 문구. 화면흐름 §7.1 이 `401·403·429` 를 구분하라고 정했습니다.
 *
 * `403 ADMIN_ACCOUNT_REQUIRED` 를 반드시 갈라야 합니다. 자격은 맞는데 **관리자 계정이
 * 아닌** 경우라, 여기에 "비밀번호가 올바르지 않습니다"를 띄우면 사용자가 맞는 비밀번호를
 * 계속 다시 칩니다. 반대로 자격 실패는 계정 존재 여부를 드러내지 않게 한 문장으로 고정합니다.
 *
 * **`429` 는 상태로 가릅니다.** 계약에 오류 코드 이름이 없습니다 — §15 가 "로그인 실패
 * 횟수 제한, 잠금 … 은 `DEFERRED_NOT_CONTRACTED`" 로 미뤘기 때문입니다. 이름이 정해지면
 * 위 `switch` 로 옮기세요.
 *
 * 429 를 안 가르면 피해가 큽니다. 속도 제한에 걸린 사람에게 "비밀번호가 틀렸다"고 하면
 * 그 사람은 비밀번호를 **더 열심히 다시 칩니다.** 그게 바로 제한이 막으려던 행동이라
 * 잠금이 길어지고, 화면은 끝까지 이유를 알려주지 않습니다.
 */
function loginErrorMessage(error: unknown): string {
    switch (errorCodeOf(error)) {
        case 'ADMIN_ACCOUNT_REQUIRED':
            return '관리자 계정이 아닙니다.';
        case 'ADMIN_SESSION_EXPIRED':
            return '세션이 만료되었습니다. 다시 로그인해 주세요.';
        default:
            break;
    }

    if (errorStatusOf(error) === 429) {
        // 남은 시간은 서버가 `Retry-After` 로 줄 수 있지만 계약에 없어 숫자를 지어내지 않습니다.
        return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }

    return '아이디 또는 비밀번호가 올바르지 않습니다';
}

/** 예시 문구(placeholder)는 두지 않습니다. 시안의 회색 글씨는 입력값 예시라 화면에 남기지 않습니다. */
const FIELD =
    'h-[46px] w-full rounded-[9px] px-4 text-[13px] font-semibold text-brand-ink outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand-blue/40';

export function LoginForm() {
    const login = useLogin();
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    // 기본은 가림. 누르고 **있는 동안만** 눈이 떠지고 평문이 보입니다. 손을 떼면 바로 다시 가립니다.
    const [revealed, setRevealed] = useState(false);

    // 서버가 401 을 주기 전에 프런트가 미리 판단하지 않습니다. 빈 값만 막습니다.
    const canSubmit = loginId.trim() !== '' && password !== '' && !login.isPending;
    const failed = login.isError;

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        // 요청 본문 필드명은 `loginId` 입니다 — `email` 이 아닙니다 (API명세 B-2).
        login.mutate({ loginId: loginId.trim(), password });
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="admin-login-id" className="block text-[12px] font-bold text-brand-body">
                아이디
            </label>
            <input
                id="admin-login-id"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                autoComplete="username"
                /*
                 * 이 화면에 입력칸 말고는 할 일이 없습니다. 관리자가 마우스로 칸을 한 번
                 * 짚고 시작해야 할 이유가 없어서 커서를 미리 넣어 둡니다.
                 *
                 * 화면 안에 폼이 하나뿐이라 autoFocus 의 흔한 부작용(여러 폼이 서로
                 * 포커스를 빼앗음, 스크롤이 갑자기 튐)이 없습니다.
                 */
                autoFocus
                className={cn(FIELD, 'mt-[9px] bg-brand-surface')}
            />

            <label
                htmlFor="admin-login-password"
                className="mt-[22px] block text-[12px] font-bold text-brand-body"
            >
                비밀번호
            </label>
            <div className="relative mt-[9px]">
                <input
                    id="admin-login-password"
                    type={revealed ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    aria-invalid={failed}
                    aria-describedby={failed ? 'admin-login-error' : undefined}
                    className={cn(
                        FIELD,
                        'border bg-white pr-[46px]',
                        failed ? 'border-[1.4px] border-tone-red-fg' : 'border-brand-border-soft',
                    )}
                />
                {/*
                 * 누르고 있는 동안만 보여주는 버튼(press-and-hold).
                 * setPointerCapture 를 걸어야 버튼 밖에서 손을 떼도 pointerup 이 여기로 와서 다시 가려집니다.
                 * 키보드에서는 Space/Enter 를 누르고 있는 동안 열립니다. 브라우저 기본 동작이 keydown 을
                 * click 으로 바꾸지 않도록 preventDefault 가 필요합니다.
                 *
                 * 표시 여부는 화면에만 머무는 상태입니다. 값 자체는 어디에도 따로 복사·저장·기록하지
                 * 않습니다 — 비밀번호 평문 저장·로그 출력 금지(§7.1).
                 */}
                <button
                    type="button"
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setRevealed(true);
                    }}
                    onPointerUp={() => setRevealed(false)}
                    onPointerCancel={() => setRevealed(false)}
                    onKeyDown={(event) => {
                        if (event.key !== ' ' && event.key !== 'Enter') return;
                        event.preventDefault();
                        setRevealed(true);
                    }}
                    onKeyUp={(event) => {
                        if (event.key === ' ' || event.key === 'Enter') setRevealed(false);
                    }}
                    // 포커스를 잃거나 탭이 가려지면 평문이 남지 않게 닫습니다.
                    onBlur={() => setRevealed(false)}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-pressed={revealed}
                    aria-controls="admin-login-password"
                    className="absolute right-[9px] top-1/2 flex size-[30px] -translate-y-1/2 touch-none select-none items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                >
                    <span className="sr-only">누르고 있는 동안 비밀번호 표시</span>
                    {revealed ? (
                        <Eye className="size-[18px]" strokeWidth={1.9} aria-hidden />
                    ) : (
                        <EyeOff className="size-[18px]" strokeWidth={1.9} aria-hidden />
                    )}
                </button>
            </div>

            {failed && (
                <p
                    id="admin-login-error"
                    role="alert"
                    className="mt-[11px] text-[11.5px] font-semibold text-tone-red-fg"
                >
                    {loginErrorMessage(login.error)}
                </p>
            )}

            <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                    'h-[48px] w-full rounded-[7px] bg-brand-blue text-[14px] font-bold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:bg-brand-border-soft disabled:text-brand-muted',
                    failed ? 'mt-[11px]' : 'mt-[32px]',
                )}
            >
                {login.isPending ? '로그인 중…' : '로그인'}
            </button>
        </form>
    );
}
