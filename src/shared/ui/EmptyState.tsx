import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  className?: string
}) {
  return (
    <div
      role="status"
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center',
          className,
        ),
      )}
    >
      <Icon className="size-8 text-muted/60" aria-hidden="true" />
      <p className="text-sm font-medium text-text/80">{title}</p>
      {hint && <p className="max-w-[260px] text-xs text-muted">{hint}</p>}
    </div>
  )
}
