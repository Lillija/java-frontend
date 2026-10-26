/// <reference types="vite/client" />

// Environment variables exposed to the browser must start with VITE_.
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
