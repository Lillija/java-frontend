import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import type { Post } from '../../src/api'

const POSTS: Post[] = [
  { id: 1, user_id: 1, title: 'Pirmais ieraksts', body: 'Teksts Nr.1', created_at: '2026-10-01T10:00:00Z' },
  { id: 2, user_id: 2, title: 'Otrais ieraksts', body: 'Teksts Nr.2', created_at: '2026-10-02T10:00:00Z' },
]

const json = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(body),
})

/** Fake backend: GET /posts + POST /login + DELETE /posts/:id */
function stubFetch() {
  const calls: string[] = []
  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    const method = options.method || 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'GET' && /\/posts$/.test(url)) return json(POSTS)
    if (method === 'POST' && /\/login$/.test(url)) {
      return json({ token: '1|abc', user: { id: 1, name: 'Admin User' } })
    }
    if (method === 'POST' && /\/posts$/.test(url)) {
      const body = JSON.parse(options.body as string) as { title: string; body: string }
      return json({ id: 99, user_id: 1, ...body, created_at: new Date().toISOString() }, 201)
    }
    if (method === 'DELETE' && /\/posts\/\d+$/.test(url)) return json(null, 204)
    return json({ message: 'not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

describe('<App />', () => {
  it('renders the posts returned by the API', async () => {
    stubFetch()
    render(<App />)
    expect(await screen.findByText('Pirmais ieraksts')).toBeInTheDocument()
    expect(document.querySelectorAll('.post-card')).toHaveLength(2)
    vi.unstubAllGlobals()
  })

  it('shows an error block when the API is unreachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    render(<App />)
    const message = await screen.findByText(/Cannot reach the Laravel API/)
    expect(message).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('logs the user in and swaps the login form for the post form', async () => {
    stubFetch()
    render(<App />)
    await screen.findByText('Pirmais ieraksts')

    fireEvent.submit(document.querySelector('.login-card') as HTMLElement)

    expect(await screen.findByText(/Hello, Admin User/)).toBeInTheDocument()
    expect(document.querySelector('.new-post')).not.toBeNull()
    vi.unstubAllGlobals()
  })

  it('removes a post from the list after a successful DELETE', async () => {
    const calls = stubFetch()
    render(<App />)
    await screen.findByText('Pirmais ieraksts')

    fireEvent.submit(document.querySelector('.login-card') as HTMLElement)
    await screen.findByText(/Hello, Admin User/)

    // only the author (user_id 1) sees the delete button
    fireEvent.click(screen.getAllByText('Delete')[0])

    await waitFor(() => expect(document.querySelectorAll('.post-card')).toHaveLength(1))
    expect(calls).toContain('DELETE http://localhost:8000/api/posts/1')
    expect(screen.queryByText('Pirmais ieraksts')).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
