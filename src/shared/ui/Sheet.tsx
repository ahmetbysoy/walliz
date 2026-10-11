import * as Vaul from 'vaul'

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
        <Vaul.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Vaul.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1.5 w-10 rounded-full bg-line" aria-hidden />
          </div>
          {title && <h2 className="px-5 pb-3 pt-1 text-sm font-semibold text-muted">{title}</h2>}
          <div className="px-5 pb-5">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  )
}
