import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * 테스트 공통 준비.
 *
 * `cleanup` 은 테스트마다 붙은 DOM 을 떼어냅니다. 안 떼면 다음 테스트에서
 * `getByText` 가 앞 테스트의 잔재까지 같이 찾아 "여러 개가 걸렸다" 로 실패합니다.
 */
afterEach(() => {
    cleanup();
});
