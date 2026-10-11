import * as RSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface SelectOption {
  value: string
  label: string
  hint?: string
}

export function Select({
  value,
  onValueChange,
  options,
  label,
  ariaLabel,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  options: SelectOption[]
  label?: string
  ariaLabel: string
  className?: string
}) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger
        aria-label={ariaLabel}
        className={twMerge(
          clsx(
            'inline-flex h-10 items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-text outline-none data-[state=open]:border-mint/50',
            className,
          ),
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {label && <span className="text-xs text-muted">{label}:</span>}
          <RSelect.Value />
        </span>
        <RSelect.Icon>
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        >
          <RSelect.Viewport className="p-1">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:text-mint"
              >
                <RSelect.ItemText>
                  {o.label}
                  {o.hint ? <span className="ml-2 text-xs text-muted">{o.hint}</span> : null}
                </RSelect.ItemText>
                <RSelect.ItemIndicator>
                  <Check className="size-4" aria-hidden />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}
