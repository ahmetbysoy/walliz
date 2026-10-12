import * as Vaul from 'vaul'
import { X } from 'lucide-react'

/** Bottom sheet (vaul) — mobil native his. */
export function Sheet({
  open,
  onOpenChange,
  children,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <Vaul.Root open={open} onOpenChange={onOpenChange}>
      <Vaul.Portal>
        <Vaul.Overlay
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />
        <Vaul.Content
          aria-label={title}
          role="dialog"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl"
        >
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1.5 w-10 rounded-full bg-line" aria-hidden />
          </div>
          {title && (
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 className="text-sm font-semibold text-text">{title}</h2>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => onOpenChange(false)}
                className="flex size-7 min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-muted hover:text-text transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )}
          <div className="px-5 pb-5">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  )
}
