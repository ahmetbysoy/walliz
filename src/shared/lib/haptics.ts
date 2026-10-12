/** Haptic feedback — desteklemeyen cihazlarda sessiz no-op. */

let hapticsEnabled = true

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

export function haptic(pattern: number | number[] = 30): void {
  if (!hapticsEnabled || !canVibrate()) return
  try {
    navigator.vibrate(pattern)
  } catch {
    /* no-op */
  }
}
