/** Requirement 4 (carried over): visual feedback while data is loading. */
export default function Spinner({ label = 'Loading…', small = false }) {
  return (
    <div className={`loader ${small ? 'loader-sm' : ''}`} role="status">
      <span className="loader-ring" aria-hidden="true" />
      <span className="loader-text">{label}</span>
    </div>
  )
}
