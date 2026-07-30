import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    /*
     * `lint` 는 `eslint .` 라 이 폴더에 떨어진 건 무엇이든 검사합니다. flat config 는
     * `.gitignore` 를 읽지 않으므로, 여기 적지 않으면 도구가 만든 자리도 그대로 훑습니다.
     *
     * 실제로 겪은 일입니다. 컨테이너에서 `HOME` 을 작업 폴더로 두고 pnpm 을 돌렸더니
     * corepack 이 `.cache/node/corepack/…/pnpm.cjs` 에 pnpm 을 풀어 놨고, eslint 가
     * **그 22만 줄짜리 번들을 우리 코드로 알고 검사**해 오류 12개를 뱉었습니다.
     * 전부 번들 안에 문자열로 들어 있던 남의 규칙 이름이었습니다.
     *
     * `.vercel` 은 Vercel CLI 가, `coverage` 는 테스트 러너가 만듭니다. `.gitignore`
     * 에도 같은 목록이 있습니다 — 저장소에 안 들어가는 것과 lint 에서 빠지는 것은
     * 별개라 양쪽에 적어야 합니다.
     */
    { ignores: ['dist', 'node_modules', '.cache', '.local', '.npm', '.vercel', 'coverage'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    prettier,
);
