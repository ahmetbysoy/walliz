import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(clsx('rounded-2xl border border-line bg-surface p-4', className))}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <h3
      className={twMerge(
        clsx('text-xs font-semibold uppercase tracking-wider text-muted', className),
      )}
    >
      {children}
    </h3>
  )
}
