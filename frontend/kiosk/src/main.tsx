// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 터치스크린 kiosk 대응 — 실기기에서 CSS :active가 터치 시 발동하지 않는 것을 확인해
// (Windows 터치스크린 브라우저의 알려진 동작 차이), Pointer Events로 직접 눌림 상태를
// 제어한다. 마우스 클릭·터치 모두 pointerdown/up/cancel 이벤트로 들어오므로 이 방식이
// 버튼 컴포넌트마다 손대지 않고도 앱 전체 버튼에 동일하게 적용된다.
function findPressableButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null
  const button = target.closest('button')
  return button && !button.disabled ? button : null
}

document.addEventListener(
  'pointerdown',
  (event) => {
    findPressableButton(event.target)?.classList.add('is-pressed')
  },
  true,
)

function releasePressed() {
  document
    .querySelectorAll('button.is-pressed')
    .forEach((button) => button.classList.remove('is-pressed'))
}

document.addEventListener('pointerup', releasePressed, true)
document.addEventListener('pointercancel', releasePressed, true)

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <App />
  // </StrictMode>,
)