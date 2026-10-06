import { useState } from 'react'
import Spinner from './Spinner'
import { createComment, fetchComments } from '../api'

function formatDate(value) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

export default function PostCard({ post, user, onDelete }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')

  const canDelete = user && user.id === post.user_id

  async function toggleComments() {
    setError(null)
    if (!open) {
      setLoading(true)
      try {
        setComments(await fetchComments(post.id))
        setOpen(true)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
      return
    }
    setOpen(false)
  }

  async function handleComment(event) {
    event.preventDefault()
    if (!draft.trim()) return
    setError(null)
    try {
      const created = await createComment(post.id, draft.trim())
      setComments((current) => [...current, created])
      setDraft('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <article className="card post-card">
      <header className="post-head">
        <h3>{post.title}</h3>
        {canDelete && (
          <button className="btn btn-ghost" onClick={() => onDelete(post.id)}>
            Delete
          </button>
        )}
      </header>
      <p className="post-body">{post.body}</p>
      <footer className="post-meta">
        <span>#{post.id} · author {post.user_id}</span>
        <span>{formatDate(post.created_at)}</span>
      </footer>

      <div className="post-actions">
        <button className="btn btn-ghost" onClick={toggleComments}>
          {open ? 'Hide comments' : `Comments (${comments.length})`}
        </button>
      </div>

      {loading && <Spinner small label="Loading comments…" />}
      {error && <p className="error">{error}</p>}

      {open && (
        <section className="comments">
          {comments.length === 0 && <p className="muted">No comments yet.</p>}
          <ul>
            {comments.map((comment) => (
              <li key={comment.id}>
                <strong>#{comment.user_id}</strong> {comment.content}
              </li>
            ))}
          </ul>

          {user ? (
            <form className="comment-form" onSubmit={handleComment}>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a comment…"
              />
              <button className="btn" type="submit">Send</button>
            </form>
          ) : (
            <p className="muted">Login to add a comment.</p>
          )}
        </section>
      )}
    </article>
  )
}
