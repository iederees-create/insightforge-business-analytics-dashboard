import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// index.css chains in styles/globals.css via @import so Tailwind v4's @theme block
// (in globals.css) stays in the same processing graph as @import "tailwindcss" — a
// separate top-level import here would leave @theme unprocessed and no utilities generated.
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
