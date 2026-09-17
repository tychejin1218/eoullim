import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // 사내 배포: 빌드 결과를 파일로 열거나 아무 경로에나 올려도 동작하도록 상대 경로
  base: './',
  resolve: {
    // @/ → src/ (tsconfig.json 의 paths 와 반드시 같이 유지할 것)
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
