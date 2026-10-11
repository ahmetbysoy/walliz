import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge(clsx('animate-pulse rounded-xl bg-surface-2/70', className))}
      aria-hidden="true"
    />
  )
}
