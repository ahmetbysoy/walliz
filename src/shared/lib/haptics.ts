/** Haptic feedback — desteklemeyen cihazlarda sessiz no-op. */

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

export function haptic(pattern: number | number[] = 30): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* no-op */
  }
}
