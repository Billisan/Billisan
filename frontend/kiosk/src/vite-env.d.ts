/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACE_STREAM_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
