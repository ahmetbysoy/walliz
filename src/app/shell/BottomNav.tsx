import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { TABS, type TabId } from './tabs'

export type { TabId }

export function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav
      aria-label="Ana menü"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={t.label}
              className={twMerge(
                clsx(
                  'relative flex h-14 landscape:h-9 min-h-[44px] landscape:min-h-[36px] flex-col landscape:flex-row items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-mint' : 'text-muted hover:text-text',
                ),
              )}
            >
              {active && (
                <span className="absolute top-0 landscape:bottom-0 landscape:top-auto h-0.5 w-10 rounded-full bg-mint" aria-hidden />
              )}
              <Icon className="size-5 landscape:size-4" aria-hidden />
              <span className="landscape:text-[10px]">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
