import { useEffect, useState } from 'react'
import { subscribeToLog } from '../api'

/** Live list of AJAX calls — proof that data is fetched without page reload. */
export default function NetworkLog() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])

  useEffect(() => subscribeToLog(setEntries), [])

  return (
    <>
      <button className="netlog-toggle" onClick={() => setOpen((value) => !value)}>
        📶 Network log <span className="netlog-count">{entries.length}</span>
      </button>

      {open && (
        <aside className="netlog">
          <header className="netlog-head">
            <strong>Requests (no page reload)</strong>
            <button onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </header>
          <ul className="netlog-list">
            {entries.length === 0 && <li className="muted">No requests yet</li>}
            {entries.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="netlog-row">
                <span className={`method m-${entry.method}`}>{entry.method}</span>
                <span className="url">{entry.url.replace(/^https?:\/\//, '')}</span>
                <span className={`status ${entry.status === 'ERR' ? 'bad' : ''}`}>
                  {entry.status}
                </span>
                <span className="ms">{entry.ms} ms</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  )
}
