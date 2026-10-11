import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Card } from './Card'

type Variant = 'default' | 'price' | 'up' | 'down'

export function MetricCard({
  label,
  value,
  sub,
  variant = 'default',
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  variant?: Variant
  className?: string
}) {
  const tone = variant === 'up' ? 'text-mint' : variant === 'down' ? 'text-coral' : 'text-text'
  const valueClass = variant === 'price' ? 'text-2xl font-semibold' : 'text-lg font-semibold'
  return (
    <Card className={twMerge(clsx('flex min-w-0 flex-col gap-0.5 p-3', className))}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className={twMerge(clsx('tabular-nums', valueClass, tone))}>{value}</span>
      {sub != null && <span className="text-[11px] tabular-nums text-muted">{sub}</span>}
    </Card>
  )
}
