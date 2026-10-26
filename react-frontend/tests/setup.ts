import '@testing-library/jest-dom/vitest' // adds toBeInTheDocument(), toHaveValue() …
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup() // unmount React trees between tests
  localStorage.clear() // api.ts persists the session in localStorage
})
