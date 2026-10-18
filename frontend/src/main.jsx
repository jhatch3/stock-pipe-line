import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useHref, useNavigate } from 'react-router-dom'
import { RouterProvider } from 'react-aria-components'
import App from './App.jsx'
import './index.css'

// Route react-aria links (Untitled UI nav items, buttons with href) through react-router
function AriaRouter({ children }) {
  const navigate = useNavigate()
  return <RouterProvider navigate={navigate} useHref={useHref}>{children}</RouterProvider>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AriaRouter>
        <App />
      </AriaRouter>
    </BrowserRouter>
  </React.StrictMode>
)
