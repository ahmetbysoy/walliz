/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string
  readonly VITE_BINANCE_WS?: string
  readonly VITE_BINANCE_REST?: string
  readonly VITE_DEMO_SEED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
