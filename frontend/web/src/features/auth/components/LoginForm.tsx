import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/features/auth/hooks/useLogin';

const loginSchema = z.object({
    email: z.string().min(1, '이메일을 입력하세요.').email('이메일 형식이 올바르지 않습니다.'),
    password: z.string().min(1, '비밀번호를 입력하세요.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
    const login = useLogin();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = (values: LoginFormValues) => {
        login.mutate(values);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="fixture-77f09adab247@example.invalid"
                    {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register('password')}
                />
                {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
            </div>

            {login.isError && (
                <p className="text-sm text-destructive">
                    {login.error instanceof Error ? login.error.message : '로그인에 실패했습니다.'}
                </p>
            )}

            <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? '로그인 중…' : '로그인'}
            </Button>
        </form>
    );
}
