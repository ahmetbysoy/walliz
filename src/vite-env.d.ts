/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Canlı WS kökü (varsayılan: wss://stream.binance.com:9443) */
  readonly VITE_BINANCE_WS?: string
  /** Virgülle ayrılmış yedek WS host'ları */
  readonly VITE_BINANCE_WS_FALLBACKS?: string
  /** REST kökü (varsayılan: https://api.binance.com) */
  readonly VITE_BINANCE_REST?: string
  /** Virgülle ayrılmış yedek REST host'ları */
  readonly VITE_BINANCE_REST_FALLBACKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
