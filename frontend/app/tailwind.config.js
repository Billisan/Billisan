/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Kiosk PROJECT_GUIDE.md §14.1 팔레트 재사용(App·Kiosk 공유 브랜드 컬러, 2026-07-31 사용자 확인).
        // primary는 픽셀 샘플링 실측값, 나머지 App 계열 값은 "기존 저장값(미실측)"으로 표기된 값이다.
        primary: '#FFD700',
        background: '#F5F7FA',
        text: '#1E2A38',
        'text-secondary': '#5C6B7A',
        cta: '#FFEA63',
        disabled: '#D9D9D9',
        'error-bg': '#FFD8D3',
        'error-text': '#C34E4B',
      },
    },
  },
  plugins: [],
}
