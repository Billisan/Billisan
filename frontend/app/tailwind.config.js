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
        secondary: '#FFEDC0',
        background: '#F5F7FA',
        border: '#E9E9E9',
        text: '#000000',
        'text-secondary': '#5F5E5E',
        'text-tertiary': '#8A6416',
        'text-school': '#14468D',
        // 대여중 Chip 전용(미실측 — 목업 스크린샷 기준 근사치, 2026-08-04).
        'rented-bg': '#E8ECFB',
        'rented-text': '#4C5FD9',
        disabled: '#D9D9D9',
        'error-bg': '#FDEBEA',
        'error-cta': '#E4574C',
        'error-text': '#C34E4B',
      },
    },
  },
  plugins: [],
}
