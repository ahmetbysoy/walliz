import { motion, useReducedMotion } from 'framer-motion'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import type { Direction } from '@/entities'

const META: Record<
  Direction,
  { color: string; bg: string; icon: typeof TrendingUp; label: string }
> = {
  up: { color: 'text-mint', bg: 'border-mint/30 bg-mint/15', icon: TrendingUp, label: 'Yukarı' },
  down: {
    color: 'text-coral',
    bg: 'border-coral/30 bg-coral/15',
    icon: TrendingDown,
    label: 'Aşağı',
  },
  flat: { color: 'text-violet', bg: 'border-violet/30 bg-violet/15', icon: Minus, label: 'Yatay' },
}

export function SignalOrb({
  direction,
  confidence,
  size = 56,
}: {
  direction: Direction
  confidence: number
  size?: number
}) {
  const reduced = useReducedMotion()
  const m = META[direction]
  const Icon = m.icon
  return (
    <motion.div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full border',
        m.bg,
        m.color,
      )}
      style={{ width: size, height: size }}
      aria-label={`Model sinyali: ${m.label} (güven %${Math.round(confidence * 100)})`}
      animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
      transition={reduced ? undefined : { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
    >
      <Icon className={size >= 48 ? 'size-7' : 'size-5'} aria-hidden />
    </motion.div>
  )
}
