import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LoginForm from '../../src/components/LoginForm'
import NewPostForm from '../../src/components/NewPostForm'
import Spinner from '../../src/components/Spinner'

describe('<LoginForm />', () => {
  it('sends the typed credentials to onLogin', async () => {
    const onLogin = vi.fn(async () => {})
    render(<LoginForm onLogin={onLogin} busy={false} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'anna@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'parole123' } })
    fireEvent.click(screen.getByText('Sign in'))

    expect(await screen.findByText('Sign in')).toBeInTheDocument()
    expect(onLogin).toHaveBeenCalledWith('anna@example.com', 'parole123')
  })

  it('shows the API error message', async () => {
    const onLogin = vi.fn(async () => {
      throw new Error('These credentials do not match our records.')
    })
    render(<LoginForm onLogin={onLogin} busy={false} />)

    fireEvent.click(screen.getByText('Sign in'))

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument()
  })
})

describe('<NewPostForm />', () => {
  it('trims the values and clears the fields after publishing', async () => {
    const onCreate = vi.fn(async () => {})
    render(<NewPostForm onCreate={onCreate} />)

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: '  Jauns ieraksts  ' } })
    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: '  Saturīgs teksts  ' },
    })
    fireEvent.click(screen.getByText('Publish'))

    expect(await screen.findByText('Publish')).toBeInTheDocument()
    expect(onCreate).toHaveBeenCalledWith({ title: 'Jauns ieraksts', body: 'Saturīgs teksts' })
    expect(screen.getByPlaceholderText('Title')).toHaveValue('')
  })
})

describe('<Spinner />', () => {
  it('renders the label and an accessible status role', () => {
    render(<Spinner label="Ielāde…" small />)
    expect(screen.getByText('Ielāde…')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveClass('loader-sm')
  })
})
