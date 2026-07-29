import { useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';

/**
 * 표 한 행을 통째로 눌러 상세로 보내는 클릭 핸들러.
 *
 * `<table>` 을 쓰는 화면은 `DataTable` 의 `Tr` 이 이미 같은 일을 합니다. 이 훅은 격자
 * `<div>` 로 그린 목록(재고·이력·사용자 이력)이 **같은 규칙**을 쓰도록 한 곳에 모아 둔 것입니다.
 * 화면마다 따로 만들면 "여기는 눌리는데 저기는 안 눌리네" 가 생깁니다.
 *
 * 두 가지를 비켜 갑니다.
 *   - 행 안의 링크·버튼은 자기 목적지로 갑니다. 안 막으면 '검수' 를 눌러도 상세로 새 버립니다.
 *   - 글자를 드래그해 고른 것뿐이면 이동하지 않습니다. 값을 복사하려던 사람을 끌고 가지 않습니다.
 *
 * 키보드는 행이 아니라 행 안의 링크로 다닙니다. 행에 따로 `tabIndex` 를 주면 이미 있는
 * 링크와 중복돼 탭 횟수만 두 배가 됩니다. 행 클릭은 마우스 편의 장치입니다.
 */
export function useRowNavigate() {
    const navigate = useNavigate();

    return (to: string) => (event: MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest('a,button,input,select,textarea')) return;
        if (window.getSelection()?.toString()) return;
        navigate(to);
    };
}

/** 행에 붙일 공통 클래스. 누를 수 있다는 걸 커서·배경으로 알립니다. */
export const ROW_CLICKABLE = 'cursor-pointer transition-colors hover:bg-brand-surface';
