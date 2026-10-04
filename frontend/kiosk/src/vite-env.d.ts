/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CAMERA_STREAM_BASE_URL: string
  readonly VITE_PI_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
