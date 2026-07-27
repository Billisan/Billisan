import { createContext, useContext, useEffect } from 'react';

interface PageTitleValue {
    title?: string;
    setTitle: (title?: string) => void;
}

/**
 * 헤더 제목 오버라이드용 컨텍스트.
 * 기본 제목은 네비게이션 메뉴명이지만, 상세 화면처럼 데이터에 따라 제목이 달라지는 곳에서 덮어씁니다.
 * Provider 는 AppShell 이 들고 있습니다.
 */
export const PageTitleContext = createContext<PageTitleValue>({
    setTitle: () => {},
});

/** 페이지에서 헤더 제목을 지정합니다. 언마운트되면 메뉴명 기본값으로 되돌아갑니다. */
export function usePageTitle(title: string | undefined) {
    const { setTitle } = useContext(PageTitleContext);

    useEffect(() => {
        setTitle(title);
        return () => setTitle(undefined);
    }, [title, setTitle]);
}

/** 헤더에서 현재 오버라이드된 제목을 읽습니다. */
export function usePageTitleValue() {
    return useContext(PageTitleContext).title;
}
