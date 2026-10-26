import { useState } from 'react'
import { errorMessage } from '../api'

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<unknown>
  busy: boolean
}

export default function LoginForm({ onLogin, busy }: LoginFormProps) {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form className="card login-card" onSubmit={handleSubmit}>
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="muted">Demo: admin@example.com / password</p>
    </form>
  )
}
