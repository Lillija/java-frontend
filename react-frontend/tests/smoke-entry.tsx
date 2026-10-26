import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import App from '../src/App.tsx'

// Same entry as src/main.tsx, built separately so the app can be mounted in jsdom.
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element is missing')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
