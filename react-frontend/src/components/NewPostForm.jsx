import { useState } from 'react'

export default function NewPostForm({ onCreate }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onCreate({ title: title.trim(), body: body.trim() })
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card new-post" onSubmit={handleSubmit}>
      <h3>Write a post</h3>
      {error && <p className="error">{error}</p>}
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        maxLength={255}
        required
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What's on your mind?"
        rows={4}
        required
      />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Publishing…' : 'Publish'}
      </button>
    </form>
  )
}
