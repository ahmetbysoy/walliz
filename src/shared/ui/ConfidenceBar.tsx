import { motion, useReducedMotion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const reduced = useReducedMotion()
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`Güven %{pct}`}
      className={twMerge(clsx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className))}
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-violet to-mint"
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  )
}
