/**
 * Tiny REST client for the Laravel API (https://github.com/zirodev23/laravel-api)
 * Uses the Fetch API with async/await — the browser does the request in the
 * background, so the React tree is updated without reloading the page.
 */

export const API_BASE =
  import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

const TOKEN_KEY = 'react-blog.token'
const USER_KEY = 'react-blog.user'

/* --------------------------------------------------------------- session */

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/* ------------------------------------------------------------ network log */

let listeners = []
let entries = []
let entrySeq = 0

export function subscribeToLog(listener) {
  listeners.push(listener)
  listener(entries)
  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

function pushEntry(entry) {
  // `id` is stable, so the log rows keep their React key when new calls arrive.
  entries = [{ ...entry, id: ++entrySeq }, ...entries].slice(0, 40)
  listeners.forEach((listener) => listener(entries))
}

/* ------------------------------------------------------------ session sync */

let authListeners = []

/**
 * Lets React hear about a session that the client had to drop (HTTP 401),
 * otherwise the stored user would stay visible in the UI after the token died.
 */
export function subscribeToAuth(listener) {
  authListeners.push(listener)
  return () => {
    authListeners = authListeners.filter((item) => item !== listener)
  }
}

function sessionExpired() {
  clearSession()
  authListeners.forEach((listener) => listener())
}

/* --------------------------------------------------------------- requests */

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

function messageFromPayload(status, payload, fallback) {
  if (payload && typeof payload === 'object') {
    if (payload.errors) {
      const first = Object.values(payload.errors)[0]
      if (Array.isArray(first) && first.length) return first[0]
      if (typeof first === 'string') return first
    }
    if (typeof payload.message === 'string') return payload.message
  }
  return fallback || `Request failed (HTTP ${status})`
}

/**
 * @param {string} path  e.g. "/posts" — appended to API_BASE
 * @returns {Promise<any>} parsed JSON body
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const url = API_BASE + path
  const started = performance.now()

  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
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
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
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

  return payload
}

/* ------------------------------------------------------- resource helpers */

export const fetchPosts = () => api('/posts')
export const createPost = (data) => api('/posts', { method: 'POST', body: data })
export const deletePost = (id) => api(`/posts/${id}`, { method: 'DELETE' })
export const fetchComments = (postId) => api(`/posts/${postId}/comments`)
export const createComment = (postId, content) =>
  api(`/posts/${postId}/comments`, { method: 'POST', body: { content } })
export const login = (email, password) =>
  api('/login', { method: 'POST', body: { email, password } })
export const logout = () => api('/logout', { method: 'POST' })
