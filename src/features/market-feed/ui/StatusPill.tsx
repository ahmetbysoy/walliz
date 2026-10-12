import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { FeedStatus } from '@/entities'

/**
 * Feed durum göstergesi — yalnızca gerçek bağlantının hâlini bildirir.
 * Veri gelmiyorsa "veri var" izlenimi veren hiçbir gösterim yoktur.
 * Canlı iken kompakt renkli nokta; bağlantı yokken/kurulurken kısa metinli uyarı.
 * Dokunma alanı en az 44×44px (T-P1-7).
 */

const META: Record<FeedStatus, { label: string; dot: string; text: string; pulse?: boolean }> = {
  live: { label: 'CANLI', dot: 'bg-mint', text: 'text-mint' },
  connecting: { label: 'AÇILIYOR', dot: 'bg-muted', text: 'text-muted', pulse: true },
  reconnecting: { label: 'BAĞLANIYOR', dot: 'bg-amber', text: 'text-amber', pulse: true },
  offline: { label: 'ÇEVRİMDIŞI', dot: 'bg-coral', text: 'text-coral', pulse: true },
}

export function StatusPill({
  status,
  error,
  onTap,
}: {
  status: FeedStatus
  error?: string | null
  onTap?: () => void
}) {
  const m = META[status]
  const isLive = status === 'live'
  const interactive = Boolean(onTap)

  return (
    <button
      type="button"
      onClick={interactive ? onTap : undefined}
      aria-label={`Feed durumu: ${m.label}${error ? ` (${error})` : ''}${
        interactive ? ' — dokunun ve bağlantıyı hemen yeniden deneyin' : ''
      }`}
      title={error ? `${m.label}: ${error}` : m.label}
      className={twMerge(
        clsx(
          'relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center p-1.5 focus:outline-none',
          interactive && 'cursor-pointer',
        ),
      )}
    >
      <span
        className={twMerge(
          clsx(
            'inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface-2/80 px-2.5 text-[11px] font-semibold tracking-wide transition-all',
            m.text,
            isLive ? 'px-2' : 'px-2.5',
            interactive && 'active:scale-95',
          ),
        )}
      >
        <span className="relative flex size-2 shrink-0">
          {m.pulse && (
            <span
              className={twMerge(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                m.dot,
              )}
              aria-hidden
            />
          )}
          <span className={twMerge('relative inline-flex size-2 rounded-full', m.dot)} aria-hidden />
        </span>
        <span className={isLive ? 'sr-only sm:not-sr-only text-[10px]' : 'text-[11px]'}>
          {m.label}
        </span>
      </span>
    </button>
  )
}
