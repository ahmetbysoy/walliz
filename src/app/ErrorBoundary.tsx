import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
          <h1 className="text-lg font-semibold text-text">Beklenmedik bir hata oluştu</h1>
          <p className="max-w-sm text-sm text-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-line bg-surface-2 px-4 py-2 text-sm text-mint"
          >
            Yeniden dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
