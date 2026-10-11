import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type Variant = 'default' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  default: 'bg-surface-2 border border-line text-text hover:bg-line/60 active:scale-[0.98]',
  ghost:
    'bg-transparent border border-transparent text-muted hover:text-text hover:bg-surface-2/60',
  danger: 'bg-coral/10 border border-coral/30 text-coral hover:bg-coral/20',
  subtle: 'bg-mint/10 border border-mint/25 text-mint hover:bg-mint/20',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={twMerge(
        clsx(
          'inline-flex select-none items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 touch-manipulation',
          variants[variant],
          sizes[size],
          className,
        ),
      )}
      {...rest}
    />
  )
})
