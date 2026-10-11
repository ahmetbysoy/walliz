import { TIMEFRAMES } from '@/shared/config/coins'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function TimeframeChips({
  value,
  onChange,
}: {
  value: string
  onChange: (tf: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Mum süresi"
      className="flex rounded-xl border border-line bg-surface-2/60 p-0.5"
    >
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.id}
          type="button"
          role="tab"
          aria-selected={value === tf.id}
          aria-label={`${tf.label} mum`}
          onClick={() => onChange(tf.id)}
          className={twMerge(
            clsx(
              'h-8 rounded-[10px] px-2.5 text-xs font-medium tabular-nums transition-colors',
              value === tf.id ? 'bg-surface text-mint' : 'text-muted hover:text-text',
            ),
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  )
}
