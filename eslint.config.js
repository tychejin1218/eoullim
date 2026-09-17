import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat['recommended-latest'], eslintPluginPrettierRecommended],
    plugins: {
      'simple-import-sort': simpleImportSort,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // 1. react 최우선
            ['^react', '^react-dom'],
            // 2. 외부 라이브러리
            ['^@?\\w'],
            // 3. @/ alias (내부 모듈)
            ['^@/'],
            // 4. 상대경로 — 같은 디렉토리 안에서만 사용
            ['^\\.'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  // 테스트와 빌드 설정은 node 환경에서 돈다
  {
    files: ['test/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
]);
