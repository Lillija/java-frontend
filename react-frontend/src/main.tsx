import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// CSR in action: the server ships an empty <div id="root">, React builds the DOM here.
// Strict null checks: getElementById() returns HTMLElement | null, so we assert it exists.
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element is missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
