/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACE_STREAM_TOKEN: string
  readonly VITE_CAMERA_STREAM_BASE_URL: string
  readonly VITE_MOCK_ELIGIBILITY?:
    | 'ELIGIBLE'
    | 'UNSETTLED_BLOCKED'
    | 'ACTIVE_RENTAL_EXISTS'
    | 'ACTIVE_RENTAL_NOT_FOUND'
  readonly VITE_KIOSK_STAGE_SOURCE?: 'mock' | 'websocket'
  readonly VITE_PI_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
