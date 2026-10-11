import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest globals kapalı olduğu için RTL temizliği elle
afterEach(() => {
  cleanup()
})
