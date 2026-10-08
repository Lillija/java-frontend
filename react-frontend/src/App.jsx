import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearSession,
  createPost,
  deletePost,
  fetchPosts,
  getStoredUser,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  saveSession,
  subscribeToAuth,
} from './api'
import LoginForm from './components/LoginForm'
import NetworkLog from './components/NetworkLog'
import NewPostForm from './components/NewPostForm'
import PostCard from './components/PostCard'
import Spinner from './components/Spinner'

export default function App() {
  const [user, setUser] = useState(getStoredUser)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const firstLoad = useRef(true)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPosts(await fetchPosts())
    } catch (err) {
      setError(err.message)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Skip the duplicate call caused by <StrictMode> in development.
    if (!firstLoad.current) return
    firstLoad.current = false
    loadPosts()
  }, [loadPosts])

  useEffect(() => {
    // The API client drops an expired/invalid token on 401 — mirror that here
    // so the header, the login form and the stored session stay in sync.
    return subscribeToAuth(() => {
      setUser(null)
      setNotice('Session expired — please log in again.')
    })
  }, [])

  async function handleLogin(email, password) {
    setAuthBusy(true)
    try {
      const data = await apiLogin(email, password)
      if (data && data.errors) {
        throw new Error(Object.values(data.errors)[0][0])
      }
      if (!data || !data.token) throw new Error('The API did not return a token.')
      saveSession(data.token, data.user)
      setUser(data.user)
      setNotice(`Welcome back, ${data.user.name}!`)
      loadPosts()
      return data
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogout() {
    if (getToken()) {
      try {
        await apiLogout()
      } catch {
        // Token may already be invalid — the local session is cleared anyway.
      }
    }
    clearSession()
    setUser(null)
    setNotice('Logged out')
  }

  async function handleCreate(data) {
    const created = await createPost(data)
    setPosts((current) => [created, ...current])
    setNotice('Post published')
  }

  async function handleDelete(id) {
    await deletePost(id)
    setPosts((current) => current.filter((post) => post.id !== id))
    setNotice(`Post #${id} deleted`)
  }

  return (
    <div className="app">
      {loading && <div className="top-progress" />}

      <header className="navbar">
        <div className="brand">⚛️ React Blog</div>
        <div className="nav-right">
          <span className={`chip ${user ? 'chip-ok' : ''}`}>
            {user ? `Hello, ${user.name}` : 'Guest'}
          </span>
          {user ? (
            <button className="btn btn-ghost" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <a className="btn btn-ghost" href="#login">
              Login
            </a>
          )}
        </div>
      </header>

      <main className="container">
        <section className="hero card">
          <h1>Blog frontend — React</h1>
          <p>
            Every list below is rendered by React from JSON returned by the Laravel REST API{' '}
            <code>http://localhost:8000/api</code>. The request happens in the background with the
            <strong> Fetch API (async/await)</strong> — the page never reloads.
          </p>
          <p className="muted">
            This page is <strong>CSR</strong>: the server sends an empty <code>#root</code> shell,
            JavaScript builds the DOM. Compare it with the vanilla version in <code>public/</code>.
          </p>
        </section>

        <section id="login" className="auth-area">
          {user ? (
            <NewPostForm onCreate={handleCreate} />
          ) : (
            <LoginForm onLogin={handleLogin} busy={authBusy} />
          )}
        </section>

        {notice && (
          <p className="notice" onClick={() => setNotice(null)}>
            {notice}
          </p>
        )}

        <section className="posts-head">
          <h2>Posts</h2>
          <button className="btn btn-ghost" onClick={loadPosts} disabled={loading}>
            Refresh
          </button>
        </section>

        {loading && <Spinner label="Loading posts…" />}
        {error && (
          <div className="error">
            <p>{error}</p>
            <button className="btn" onClick={loadPosts}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <p className="muted">No posts yet.</p>
        )}

        <div className="posts">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </main>

      <NetworkLog />
    </div>
  )
}
