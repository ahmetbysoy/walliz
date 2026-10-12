import { TIMEFRAMES } from '@/shared/config/coins'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { haptic } from '@/shared/lib/haptics'

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
      className="flex items-center rounded-xl border border-line bg-surface-2/60 p-0.5"
    >
      {TIMEFRAMES.map((tf) => {
        const isSelected = value === tf.id
        return (
          <button
            key={tf.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={`${tf.label} mum`}
            onClick={() => {
              haptic(10)
              onChange(tf.id)
            }}
            className={twMerge(
              clsx(
                'relative flex h-8 min-h-[32px] min-w-[36px] items-center justify-center rounded-[10px] px-2.5 text-xs font-medium tabular-nums transition-colors',
                isSelected ? 'bg-surface text-mint shadow-xs' : 'text-muted hover:text-text',
              ),
            )}
          >
            {/* 44x44px minimum touch target */}
            <span className="absolute -inset-x-1 -inset-y-2" aria-hidden />
            <span className="relative z-1">{tf.label}</span>
          </button>
        )
      })}
    </div>
  )
}
