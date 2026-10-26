import { useState } from 'react'
import Spinner from './Spinner'
import {
  createComment,
  deleteComment,
  errorMessage,
  fetchComments,
  type Comment,
  type Post,
  type User,
} from '../api'

// Explicit prop types: in JS a forgotten prop or a typo (userd.id) is a runtime crash.
interface PostCardProps {
  post: Post
  user: User | null
  onDelete: (id: number) => Promise<void>
}

function formatDate(value: string): string {
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

export default function PostCard({ post, user, onDelete }: PostCardProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [sending, setSending] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null)

  const canDelete = user !== null && user.id === post.user_id

  async function toggleComments(): Promise<void> {
    setError(null)
    if (!open) {
      setLoading(true)
      try {
        setComments(await fetchComments(post.id))
        setOpen(true)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setLoading(false)
      }
      return
    }
    setOpen(false)
  }

  async function handleDeleteClick(): Promise<void> {
    if (deleting) return // ignore a second click while the DELETE is in flight
    setDeleting(true)
    setError(null)
    try {
      await onDelete(post.id)
    } catch (err) {
      // The request failed — show the reason instead of failing silently.
      setError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  /** Deletes a single comment from the list (requirement: remove any list item). */
  async function handleDeleteComment(comment: Comment): Promise<void> {
    if (deletingCommentId !== null) return // one DELETE at a time
    setDeletingCommentId(comment.id)
    setError(null)
    try {
      await deleteComment(post.id, comment.id)
      setComments((current) => current.filter((item) => item.id !== comment.id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDeletingCommentId(null)
    }
  }

  async function handleComment(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setError(null)
    setSending(true)
    try {
      const created = await createComment(post.id, content)
      setComments((current) => [...current, created])
      setDraft('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="card post-card">
      <header className="post-head">
        <h3>{post.title}</h3>
        {canDelete && (
          <button className="btn btn-ghost" onClick={handleDeleteClick} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
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
                {user !== null && user.id === comment.user_id && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDeleteComment(comment)}
                    disabled={deletingCommentId === comment.id}
                    aria-label={`Delete comment ${comment.id}`}
                  >
                    {deletingCommentId === comment.id ? 'Deleting…' : '✕'}
                  </button>
                )}
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
              <button className="btn" type="submit" disabled={sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          ) : (
            <p className="muted">Login to add a comment.</p>
          )}
        </section>
      )}
    </article>
  )
}
