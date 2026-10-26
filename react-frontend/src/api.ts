/**
 * Tiny REST client for the Laravel API (https://github.com/zirodev23/laravel-api)
 * Uses the Fetch API with async/await — the browser does the request in the
 * background, so the React tree is updated without reloading the page.
 *
 * TypeScript note: every shape that crosses the network boundary is declared
 * as an `interface` below. JS would just pass the raw JSON through and any
 * typo (post.userid vs post.user_id) would surface only at runtime.
 */

/* ------------------------------------------------------------------ types */

export interface User {
  id: number
  name: string
  email?: string // optional: the API does not always include it
}

export interface Post {
  id: number
  user_id: number
  title: string
  body: string
  created_at: string
}

export interface Comment {
  id: number
  user_id: number
  post_id?: number
  content: string
  created_at?: string
}

export interface LoginResponse {
  token: string
  user: User
  errors?: Record<string, string[]> // Laravel validation errors, e.g. { email: ["..."] }
}

export interface LogEntry {
  id: number
  method: string
  url: string
  status: number | 'ERR'
  ms: number
  at: string
}

export interface RequestOptions {
  method?: string
  body?: unknown // unknown = "we do not know, narrow it before use" (safer than any)
  signal?: AbortSignal
}

/** Consistent message for `catch (err)` — in strict TS `err` is `unknown`. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

/* --------------------------------------------------------------- session */

export const API_BASE: string =
  import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

const TOKEN_KEY = 'react-blog.token'
const USER_KEY = 'react-blog.user'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function saveSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/* ------------------------------------------------------------ network log */

let listeners: Array<(entries: LogEntry[]) => void> = []
let entries: LogEntry[] = []
let entrySeq = 0

export function subscribeToLog(listener: (entries: LogEntry[]) => void): () => void {
  listeners.push(listener)
  listener(entries)
  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

function pushEntry(entry: Omit<LogEntry, 'id'>): void {
  // `id` is stable, so the log rows keep their React key when new calls arrive.
  entries = [{ ...entry, id: ++entrySeq }, ...entries].slice(0, 40)
  listeners.forEach((listener) => listener(entries))
}

/* ------------------------------------------------------------ session sync */

let authListeners: Array<() => void> = []

/**
 * Lets React hear about a session that the client had to drop (HTTP 401),
 * otherwise the stored user would stay visible in the UI after the token died.
 */
export function subscribeToAuth(listener: () => void): () => void {
  authListeners.push(listener)
  return () => {
    authListeners = authListeners.filter((item) => item !== listener)
  }
}

function sessionExpired(): void {
  clearSession()
  authListeners.forEach((listener) => listener())
}

/* --------------------------------------------------------------- requests */

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status // JS: plain assignment, TS: also checked against the declared field
    this.payload = payload
  }
}

function messageFromPayload(status: number, payload: unknown, fallback?: string): string {
  if (payload && typeof payload === 'object') {
    const body = payload as { errors?: Record<string, unknown>; message?: unknown }
    if (body.errors) {
      const first = Object.values(body.errors)[0]
      if (Array.isArray(first) && first.length) return String(first[0])
      if (typeof first === 'string') return first
    }
    if (typeof body.message === 'string') return body.message
  }
  return fallback || `Request failed (HTTP ${status})`
}

/**
 * Generic request helper. `<T>` is the shape of the parsed JSON body, so
 * `await api<Post[]>('/posts')` is typed as Post[] all the way into React.
 */
export async function api<T = unknown>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<T> {
  const url = API_BASE + path
  const started = performance.now()

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch {
    pushEntry({
      method,
      url,
      status: 'ERR',
      ms: Math.round(performance.now() - started),
      at: new Date().toLocaleTimeString(),
    })
    throw new ApiError(
      `Cannot reach the Laravel API at ${API_BASE}. Is "php artisan serve" running?`,
      0,
      null,
    )
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = text
    }
  }

  pushEntry({
    method,
    url,
    status: response.status,
    ms: Math.round(performance.now() - started),
    at: new Date().toLocaleTimeString(),
  })

  if (!response.ok) {
    // 401 with a token we sent = the session is dead. Clear it here and let
    // subscribers (App) drop their user state, so the UI never lies.
    if (response.status === 401) {
      if (token) sessionExpired()
      else clearSession()
    }
    throw new ApiError(
      messageFromPayload(response.status, payload),
      response.status,
      payload,
    )
  }

  return payload as T // the only cast in this file: we trust the server contract
}

/* ------------------------------------------------------- resource helpers */

export const fetchPosts = () => api<Post[]>('/posts')

export const createPost = (data: { title: string; body: string }) =>
  api<Post>('/posts', { method: 'POST', body: data })

export const deletePost = (id: number) => api<null>(`/posts/${id}`, { method: 'DELETE' })

export const fetchComments = (postId: number) =>
  api<Comment[]>(`/posts/${postId}/comments`)

export const createComment = (postId: number, content: string) =>
  api<Comment>(`/posts/${postId}/comments`, { method: 'POST', body: { content } })

export const login = (email: string, password: string) =>
  api<LoginResponse>('/login', { method: 'POST', body: { email, password } })

export const logout = () => api<null>('/logout', { method: 'POST' })
