import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../catchball.css'
import Upload from './Upload.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Upload />
  </StrictMode>,
)
