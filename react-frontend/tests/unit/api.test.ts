import { describe, expect, it, vi } from 'vitest'
import {
  api,
  ApiError,
  clearSession,
  getToken,
  getStoredUser,
  saveSession,
  subscribeToAuth,
  subscribeToLog,
  type User,
} from '../../src/api'

const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
})

describe('session storage', () => {
  it('round-trips a user through localStorage', () => {
    const user: User = { id: 7, name: 'Anna' }
    saveSession('1|token', user)
    expect(getToken()).toBe('1|token')
    expect(getStoredUser()).toEqual(user)
    clearSession()
    expect(getToken()).toBeNull()
    expect(getStoredUser()).toBeNull()
  })

  it('returns null for corrupted JSON instead of crashing', () => {
    localStorage.setItem('react-blog.user', '{oops')
    expect(getStoredUser()).toBeNull()
  })
})

describe('api()', () => {
  it('sends the Bearer token when a session exists', async () => {
    saveSession('1|secret', { id: 1, name: 'Admin' })
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json([]))
    vi.stubGlobal('fetch', fetchMock)

    await api('/posts')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer 1|secret')
    vi.unstubAllGlobals()
  })

  it('throws ApiError with the first Laravel validation message', async () => {
    vi.stubGlobal('fetch', async () => json({ errors: { email: ['The email field is required.'] } }, 422))
    await expect(api('/login', { method: 'POST' })).rejects.toThrow('The email field is required.')
    vi.unstubAllGlobals()
  })

  it('reports network failure with a helpful message', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await api('/posts').catch((err: unknown) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
    expect((error as Error).message).toContain('Cannot reach the Laravel API')
    vi.unstubAllGlobals()
  })

  it('drops the session and notifies subscribers on 401', async () => {
    saveSession('1|dead', { id: 1, name: 'Admin' })
    const onExpired = vi.fn()
    const unsubscribe = subscribeToAuth(onExpired)
    vi.stubGlobal('fetch', async () => json({ message: 'Unauthenticated.' }, 401))

    await expect(api('/posts')).rejects.toThrow('Unauthenticated.')

    expect(getToken()).toBeNull()
    expect(onExpired).toHaveBeenCalledTimes(1)
    unsubscribe()
    vi.unstubAllGlobals()
  })

  it('records every call in the network log', async () => {
    vi.stubGlobal('fetch', async () => json([]))
    const seen: number[] = []
    const unsubscribe = subscribeToLog((entries) => seen.push(entries.length))
    await api('/posts')
    unsubscribe()
    vi.unstubAllGlobals()
    expect(seen.at(-1)).toBeGreaterThan(0)
  })
})
