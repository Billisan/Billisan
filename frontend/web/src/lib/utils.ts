import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 병합 유틸 (shadcn/ui 표준).
 * 조건부 클래스 + 중복 클래스 정리를 한 번에 처리합니다.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
