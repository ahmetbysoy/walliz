import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { FeedStatus } from '@/entities'

/**
 * Feed durum göstergesi — yalnızca gerçek bağlantının hâlini bildirir.
 * Veri gelmiyorsa "veri var" izlenimi veren hiçbir gösterim yoktur.
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
  const interactive = Boolean(onTap) && status !== 'live'
  return (
    <button
      type="button"
      onClick={interactive ? onTap : undefined}
      aria-label={`Feed durumu: ${m.label}${error ? ` (${error})` : ''}${
        interactive ? ' — dokunun ve bağlantıyı hemen yeniden deneyin' : ''
      }`}
      title={error ?? undefined}
      className={twMerge(
        clsx(
          'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-2.5 text-[11px] font-semibold tracking-wide',
          m.text,
          interactive && 'cursor-pointer transition-transform active:scale-95',
        ),
      )}
    >
      <span className="relative flex size-2">
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
      {m.label}
    </button>
  )
}
