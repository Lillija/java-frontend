import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PostCard from '../../src/components/PostCard'
import type { Post, User } from '../../src/api'

const POST: Post = {
  id: 5,
  user_id: 1,
  title: 'Testa ieraksts',
  body: 'Saturs',
  created_at: '2026-10-01T10:00:00Z',
}
const AUTHOR: User = { id: 1, name: 'Admin' }
const GUEST: User = { id: 2, name: 'Cits' }

const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
})

describe('<PostCard />', () => {
  it('shows the delete button only to the author of the post', () => {
    const onDelete = vi.fn()
    const { rerender } = render(<PostCard post={POST} user={AUTHOR} onDelete={onDelete} />)
    expect(screen.getByText('Delete')).toBeInTheDocument()

    rerender(<PostCard post={POST} user={GUEST} onDelete={onDelete} />)
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()

    rerender(<PostCard post={POST} user={null} onDelete={onDelete} />)
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('calls onDelete with the post id and shows API errors', async () => {
    const onDelete = vi.fn(async () => {
      throw new Error('This post is not yours')
    })
    render(<PostCard post={POST} user={AUTHOR} onDelete={onDelete} />)

    fireEvent.click(screen.getByText('Delete'))

    await screen.findByText('This post is not yours')
    expect(onDelete).toHaveBeenCalledWith(5)
    // the button is re-enabled after the failed request
    await waitFor(() => expect(screen.getByText('Delete')).toBeEnabled())
  })

  it('loads comments on demand and appends a new one locally', async () => {
    vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
      const method = options.method || 'GET'
      if (method === 'GET' && /\/comments$/.test(url)) {
        return json([{ id: 10, user_id: 1, content: 'Skaisti!' }])
      }
      if (method === 'POST' && /\/comments$/.test(url)) {
        const body = JSON.parse(options.body as string) as { content: string }
        return json({ id: 77, user_id: 1, content: body.content }, 201)
      }
      return json({ message: 'not found' }, 404)
    })
    render(<PostCard post={POST} user={AUTHOR} onDelete={vi.fn()} />)

    fireEvent.click(screen.getByText(/Comments \(0\)/))
    expect(await screen.findByText('Skaisti!')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Write a comment…'), {
      target: { value: 'Paldies!' },
    })
    fireEvent.submit(document.querySelector('.comment-form') as HTMLElement)

    expect(await screen.findByText('Paldies!')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('deletes a single comment and calls DELETE /posts/{id}/comments/{cid}', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
      const method = options.method || 'GET'
      calls.push(`${method} ${url}`)
      if (method === 'GET' && /\/comments$/.test(url)) {
        return json([
          { id: 10, user_id: 1, content: 'Jauki!' },
          { id: 11, user_id: 2, content: 'Svešs komentārs' },
        ])
      }
      if (method === 'DELETE' && /\/comments\/\d+$/.test(url)) return json(null, 204)
      return json({ message: 'not found' }, 404)
    })
    render(<PostCard post={POST} user={AUTHOR} onDelete={vi.fn()} />)

    fireEvent.click(screen.getByText(/Comments \(0\)/))
    await screen.findByText('Jauki!')

    // own comment (user_id 1) shows a delete button, the other one does not
    fireEvent.click(screen.getByLabelText('Delete comment 10'))

    await waitFor(() => expect(screen.queryByText('Jauki!')).not.toBeInTheDocument())
    expect(screen.getByText('Svešs komentārs')).toBeInTheDocument()
    expect(calls).toContain('DELETE http://localhost:8000/api/posts/5/comments/10')
    vi.unstubAllGlobals()
  })
})
